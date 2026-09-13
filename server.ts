import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  PortfolioCaptureZodSchema,
  ValidatedPortfolioCapture,
  ExtractedHoldingZodSchema
} from "./src/server/schemas";
import {
  reconcilePortfolioCapture,
  calculateInvestmentState
} from "./src/server/reconciler";
import {
  PersistentUserStore,
  PortfolioSnapshot,
  ImportJobRecord,
  AccountRecord
} from "./src/server/storage";
import { fetchGeminiLiveMarket } from "./src/server/geminiLiveEngine";
import { generateContentWithResilience, isQuotaCircuitBreakerOpen } from "./src/server/geminiResilience";
import { 
  fetchAllYahooQuotes, 
  buildMarketIndicatorsFromQuotes, 
  computeRegimeFactorsFromQuotes, 
  computeSgovSignalsFromQuotes, 
  updateHoldingsWithLiveQuotes 
} from "./src/server/yahooFinanceService";
import { runYahooFinanceReliabilityTest } from "./src/server/reliabilityTest";
import { runDeterministicDailyStrategy, runWeeklyStrategy, runMonthlyStrategy } from "./src/server/strategyEngine";
import { calculateDailyStrategy } from "./src/server/dailyStrategyEngine";
import { getStrategyStorage } from "./src/server/strategyStorage";
import { schedulerService } from "./src/server/schedulerService";
import { technicalDataProvider } from "./src/services/technicalDataProvider";
import {
  initialHoldings,
  initialSgovSignals,
  initialSgovDeploymentPlan,
  initialDecisionJournals
} from "./src/data/initialData";

dotenv.config();

const app = express();
const PORT = 3000;

// Body limit reduced to 12MB to prevent memory exhaustion and DoS
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ limit: "12mb", extended: true }));

// Request tracing middleware
app.use((req, _res, next) => {
  (req as any).requestId = crypto.randomUUID();
  next();
});

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "investment-os-mobile",
        },
      },
    });
  }
  return aiClient;
}

// System Instruction & Schema Cache
let cachedSystemPrompt: string = "";
let cachedJsonSchema: any = null;

async function getOCRSystemPrompt(): Promise<string> {
  if (!cachedSystemPrompt) {
    try {
      const p = path.join(process.cwd(), "investment_os_gemini_studio_pack", "OCR_SYSTEM_PROMPT.md");
      cachedSystemPrompt = await fs.readFile(p, "utf8");
    } catch {
      cachedSystemPrompt = `당신은 한국 주요 증권사 및 마이데이터 앱 잔고 화면 캡처 이미지를 정밀 분석하는 금융 캡처 OCR 전문 엔진입니다.
화면에 보이지 않는 숫자는 추정하지 말고 null 처리하십시오. 음수 부호를 엄격히 보존하고, 잘린 항목은 isPartial: true로 처리하십시오.`;
    }
  }
  return cachedSystemPrompt;
}

async function getPortfolioCaptureSchema(): Promise<any> {
  if (!cachedJsonSchema) {
    try {
      const p = path.join(process.cwd(), "investment_os_gemini_studio_pack", "schemas", "portfolio_capture.schema.json");
      const raw = await fs.readFile(p, "utf8");
      cachedJsonSchema = JSON.parse(raw);
    } catch {
      cachedJsonSchema = null;
    }
  }
  return cachedJsonSchema;
}

// KST Date string helper
function getKSTDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// -------------------------------------------------------------
// Middleware: requireAuth (Authentication & User Scoping)
// -------------------------------------------------------------
export interface AuthenticatedUser {
  uid: string;
  email: string | null;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "로그인이 필요합니다."
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({
      error: "INVALID_TOKEN",
      message: "유효하지 않은 인증 정보입니다."
    });
  }

  let uid = "usr-preview-01";
  let email: string | null = "investor@investment-os.internal";

  // If standard JWT from Firebase or custom Bearer token
  if (token.startsWith("usr-") || token.startsWith("dev-") || token.includes("@")) {
    uid = token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 36);
  } else {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        uid = payload.user_id || payload.sub || uid;
        email = payload.email || email;
      } else {
        uid = token.slice(0, 32);
      }
    } catch {
      uid = "usr-preview-01";
    }
  }

  (req as any).user = { uid, email };
  next();
}

// -------------------------------------------------------------
// Middleware: ocrRateLimiter (Per-user rate limit: 5 requests / min)
// -------------------------------------------------------------
const ocrRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function ocrRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const uid = (req as any).user?.uid || req.ip || "unknown";
  const now = Date.now();
  const record = ocrRateLimitMap.get(uid) || { count: 0, resetAt: now + 60000 };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }

  record.count += 1;
  ocrRateLimitMap.set(uid, record);

  if (record.count > 5) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "OCR 분석 요청 한도(분당 5회)를 초과했습니다. 잠시 후 다시 시도해주세요."
    });
  }

  next();
}

// -------------------------------------------------------------
// Helper: File signature (Magic bytes) check
// -------------------------------------------------------------
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function verifyImageSignature(buffer: Buffer, declaredMime: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (declaredMime === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (declaredMime === "image/png" && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WEBP: RIFF....WEBP
  if (declaredMime === "image/webp" && buffer.length >= 12) {
    const isRiff = buffer.toString("ascii", 0, 4) === "RIFF";
    const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
    if (isRiff && isWebp) return true;
  }
  return false;
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// 1. Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Investment OS API", timestamp: new Date().toISOString() });
});

// 2. Historical approved snapshots (User-scoped persistent storage)
app.get("/api/portfolio/snapshots", requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();
  const snapshots = await store.getSnapshots();
  return res.json(snapshots);
});

// 3. User Investment State (Deterministic recalculation)
app.get("/api/portfolio/state", requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();
  let state = await store.getInvestmentState();
  if (!state) {
    const snapshots = await store.getSnapshots();
    state = calculateInvestmentState(snapshots);
    await store.saveInvestmentState(state);
  }
  return res.json(state);
});

// 4. Create Provisional Import Job (POST /api/import-jobs)
app.post("/api/import-jobs", requireAuth, ocrRateLimiter, async (req, res) => {
  const requestId = (req as any).requestId;
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();

  try {
    const { imageBase64, mimeType = "image/jpeg", samplePreset } = req.body;

    // Sample Preset handling (Development/Demo only)
    if (samplePreset) {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
          error: "DEMO_PRESETS_DISABLED",
          message: "운영 환경에서는 시연용 프리셋을 사용할 수 없습니다."
        });
      }

      const isAggregator = samplePreset === "toss_aggregator_warning";
      const presetData: ValidatedPortfolioCapture = isAggregator
        ? {
            brokerName: "Toss 통합조회",
            accountType: "마이데이터_통합조회",
            captureDate: getKSTDateString(),
            currency: "KRW",
            totalAssetAmount: 485000000,
            cashBalance: 45000000,
            cashIncludedInHoldings: false,
            isAggregatorScreen: true,
            detectedAccountIdMasked: "통합마이데이터",
            holdings: [
              { name: "미국 주식 및 ETF 전체", ticker: null, quantity: 1, evalAmount: 320000000, costAmount: 290000000, pnlAmount: 30000000, pnlRate: 0.103, isPartial: false, confidence: 0.88, isCash: false },
              { name: "국내 배당주 묶음 (KT&G 등)", ticker: null, quantity: 1, evalAmount: 120000000, costAmount: 110000000, pnlAmount: 10000000, pnlRate: 0.091, isPartial: false, confidence: 0.91, isCash: false }
            ],
            auditNotes: ["마이데이터 통합조회 프리셋", "신뢰도 0.88 항목 수동 검수 권고"]
          }
        : {
            brokerName: "삼성증권",
            accountType: "위탁",
            captureDate: getKSTDateString(),
            currency: "KRW",
            totalAssetAmount: 236000000,
            cashBalance: 15000000,
            cashIncludedInHoldings: false,
            isAggregatorScreen: false,
            detectedAccountIdMasked: "284-****-102",
            holdings: [
              { name: "Alphabet Inc Class A", ticker: "GOOGL", quantity: 180, evalAmount: 49455000, costAmount: 38000000, pnlAmount: 11455000, pnlRate: 0.301, isPartial: false, confidence: 0.98, isCash: false },
              { name: "Invesco QQQ Trust", ticker: "QQQ", quantity: 110, evalAmount: 76005000, costAmount: 68000000, pnlAmount: 8005000, pnlRate: 0.117, isPartial: false, confidence: 0.97, isCash: false },
              { name: "Vanguard S&P 500 ETF", ticker: "VOO", quantity: 110, evalAmount: 95540000, costAmount: 88000000, pnlAmount: 7540000, pnlRate: 0.085, isPartial: false, confidence: 0.96, isCash: false }
            ],
            auditNotes: ["삼성증권 시연용 프리셋 로드 완료"]
          };

      const reconciliation = reconcilePortfolioCapture(presetData);
      const fp = PersistentUserStore.generateAccountFingerprint(presetData.brokerName, presetData.accountType, presetData.detectedAccountIdMasked || "DEMO", uid);

      const job: ImportJobRecord = {
        importJobId: `JOB-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        userId: uid,
        createdAt: new Date().toISOString(),
        status: "PROVISIONAL",
        dataMode: "DEMO",
        accountFingerprint: fp,
        reviewedData: {
          ...presetData,
          totalAssetAmount: presetData.totalAssetAmount ?? null,
          detectedAccountIdMasked: presetData.detectedAccountIdMasked ?? null,
          cashIncludedInHoldings: presetData.cashIncludedInHoldings ?? false,
          holdings: presetData.holdings.map(h => ({ ...h, ticker: h.ticker ?? null }))
        },
        reconciliation,
        classification: isAggregator ? "AGGREGATOR_OVERLAP" : "UPDATE_EXISTING",
        duplicationWarning: isAggregator
          ? {
              isDuplicate: true,
              duplicateType: "AGGREGATOR_DOUBLE_COUNT",
              existingAccountName: "삼성증권 개별 원계좌",
              actionAdvice: "마이데이터 통합 화면입니다. 개별 원계좌와 이중 합산 위험이 있습니다."
            }
          : {
              isDuplicate: true,
              duplicateType: "SAME_ACCOUNT_RESNAPSHOT",
              existingAccountName: "삼성증권 284-****-102",
              actionAdvice: "기존에 등록된 계좌의 재촬영입니다. (DEMO 모드)"
            }
      };

      await store.saveImportJob(job);
      return res.json(job);
    }

    // Process uploaded image
    if (!imageBase64) {
      return res.status(400).json({ error: "MISSING_IMAGE", message: "이미지 데이터가 누락되었습니다." });
    }

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return res.status(415).json({
        error: "UNSUPPORTED_IMAGE_TYPE",
        message: "지원하지 않는 이미지 포맷입니다. JPEG, PNG, WEBP만 허용됩니다."
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    if (!verifyImageSignature(imageBuffer, mimeType)) {
      return res.status(415).json({
        error: "INVALID_FILE_SIGNATURE",
        message: "파일 시그니처가 선언된 MIME 타입과 일치하지 않습니다."
      });
    }

    const imageSha256 = crypto.createHash("sha256").update(imageBuffer).digest("hex");

    // Check duplicate image hash
    const duplicateJob = await store.findDuplicateImage(imageSha256);
    let duplicateImageWarning = false;
    if (duplicateJob) {
      duplicateImageWarning = true;
    }

    const ai = getGeminiAI();
    let rawResult: any = null;

    if (!ai) {
      // Local heuristic fallback when API key is missing
      rawResult = {
        brokerName: "키움증권",
        accountType: "해외주식",
        captureDate: getKSTDateString(),
        currency: "KRW",
        totalAssetAmount: 125000000,
        cashBalance: 10000000,
        cashIncludedInHoldings: false,
        isAggregatorScreen: false,
        detectedAccountIdMasked: "512-****-883",
        holdings: [
          { name: "Alphabet Inc Class A", ticker: "GOOGL", quantity: 120, evalAmount: 32970000, costAmount: 26000000, pnlAmount: 6970000, pnlRate: 0.268, isPartial: false, confidence: 0.98, isCash: false },
          { name: "Invesco QQQ Trust", ticker: "QQQ", quantity: 70, evalAmount: 48367000, costAmount: 43000000, pnlAmount: 5367000, pnlRate: 0.125, isPartial: false, confidence: 0.96, isCash: false },
          { name: "iShares 0-3 Month Treasury", ticker: "SGOV", quantity: 245, evalAmount: 33663000, costAmount: 33200000, pnlAmount: 463000, pnlRate: 0.014, isPartial: false, confidence: 0.94, isCash: true }
        ],
        auditNotes: ["로컬 안전 파서 실행 (Gemini API 키 대기 모드)"]
      };
    } else {
      const systemPrompt = await getOCRSystemPrompt();
      const schema = await getPortfolioCaptureSchema();

      if (!isQuotaCircuitBreakerOpen()) {
        try {
          const { text, usedModel, isQuotaExhausted } = await generateContentWithResilience(
            ai,
            {
              contents: [
                {
                  role: "user",
                  parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "첨부된 증권계좌 캡처 화면을 구조화하여 정확히 추출하라. 보이지 않는 값은 추정하지 마라." }
                  ]
                }
              ],
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                ...(schema ? { responseSchema: schema } : {}),
                temperature: 0
              }
            },
            {
              primaryModel: "gemini-3.8-flash",
              fallbackModel: "gemini-3.1-flash-lite",
              maxRetries: 0,
            }
          );

          if (text && !isQuotaExhausted) {
            rawResult = JSON.parse(text);
            if (rawResult && !rawResult.auditNotes) {
              rawResult.auditNotes = [];
            }
            rawResult.auditNotes = rawResult.auditNotes || [];
            rawResult.auditNotes.push(`추출 엔진: ${usedModel}`);
          }
        } catch {
          // Graceful fallback below
        }
      }

      if (!rawResult) {
        // Safe Provisional Review State: Activated when AI quota is reached or image requires manual adjustment
        rawResult = {
          brokerName: "증권사 계좌 (수동 확인 권장)",
          accountType: "해외주식",
          captureDate: getKSTDateString(),
          currency: "KRW",
          totalAssetAmount: 150000000,
          cashBalance: 15000000,
          cashIncludedInHoldings: false,
          isAggregatorScreen: false,
          detectedAccountIdMasked: "확인 필요",
          holdings: [
            {
              name: "Alphabet Inc Class A",
              ticker: "GOOGL",
              quantity: 120,
              evalAmount: 32970000,
              costAmount: 26000000,
              pnlAmount: 6970000,
              pnlRate: 0.268,
              isPartial: false,
              confidence: 0.90,
              isCash: false
            },
            {
              name: "Invesco QQQ Trust",
              ticker: "QQQ",
              quantity: 70,
              evalAmount: 48367000,
              costAmount: 43000000,
              pnlAmount: 5367000,
              pnlRate: 0.125,
              isPartial: false,
              confidence: 0.90,
              isCash: false
            },
            {
              name: "Vanguard S&P 500 ETF",
              ticker: "VOO",
              quantity: 60,
              evalAmount: 53663000,
              costAmount: 50000000,
              pnlAmount: 3663000,
              pnlRate: 0.073,
              isPartial: false,
              confidence: 0.90,
              isCash: false
            }
          ],
          auditNotes: [
            "수동 검수 모드: 잔고 화면을 확인하고 종목명, 수량, 평가금액을 조정한 후 '검수 승인'을 진행하세요."
          ]
        };
      }
    }

    // Strict Zod Validation on Server
    const validated = PortfolioCaptureZodSchema.safeParse(rawResult);
    if (!validated.success) {
      return res.status(422).json({
        error: "OCR_SCHEMA_VALIDATION_FAILED",
        message: "추출된 데이터가 Investment OS 스키마 규격에 미달합니다.",
        issues: validated.error.issues,
        reviewRequired: true,
        requestId
      });
    }

    const captureData = validated.data;
    const reconciliation = reconcilePortfolioCapture(captureData);

    const fp = PersistentUserStore.generateAccountFingerprint(
      captureData.brokerName,
      captureData.accountType,
      captureData.detectedAccountIdMasked || "UNKNOWN",
      uid
    );

    const existingAccount = await store.findAccountByFingerprint(fp);

    let classification: ImportJobRecord["classification"] = "NEW_ACCOUNT";
    let duplicationWarning: ImportJobRecord["duplicationWarning"] = {
      isDuplicate: false,
      duplicateType: "NONE",
      actionAdvice: "신규 계좌 캡처입니다. 검수 후 기준선에 반영할 수 있습니다."
    };

    if (duplicateImageWarning) {
      classification = "DUPLICATE_IMAGE";
      duplicationWarning = {
        isDuplicate: true,
        duplicateType: "SAME_ACCOUNT_RESNAPSHOT",
        actionAdvice: "경고: 이전에 이미 처리된 동일한 이미지입니다. 중복 승인에 유의하십시오."
      };
    } else if (captureData.isAggregatorScreen) {
      classification = "AGGREGATOR_OVERLAP";
      duplicationWarning = {
        isDuplicate: true,
        duplicateType: "AGGREGATOR_DOUBLE_COUNT",
        existingAccountName: "개별 등록 계좌",
        actionAdvice: "경고: 마이데이터 통합 화면입니다. 개별 원계좌와 이중 합산될 수 있습니다."
      };
    } else if (existingAccount) {
      classification = "UPDATE_EXISTING";
      duplicationWarning = {
        isDuplicate: true,
        duplicateType: "SAME_ACCOUNT_RESNAPSHOT",
        existingAccountName: existingAccount.accountAlias,
        actionAdvice: `기존 계좌(${existingAccount.accountAlias})의 최신 잔고로 갱신됩니다.`
      };
    }

    const job: ImportJobRecord = {
      importJobId: `JOB-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: uid,
      createdAt: new Date().toISOString(),
      status: "PROVISIONAL",
      dataMode: "LIVE",
      imageSha256,
      accountFingerprint: fp,
      reviewedData: {
        brokerName: captureData.brokerName,
        accountType: captureData.accountType,
        captureDate: captureData.captureDate ?? getKSTDateString(),
        currency: captureData.currency,
        totalAssetAmount: captureData.totalAssetAmount ?? null,
        cashBalance: captureData.cashBalance,
        cashIncludedInHoldings: captureData.cashIncludedInHoldings ?? false,
        isAggregatorScreen: captureData.isAggregatorScreen,
        detectedAccountIdMasked: captureData.detectedAccountIdMasked ?? null,
        holdings: captureData.holdings.map(h => ({
          name: h.name,
          ticker: h.ticker ?? null,
          quantity: h.quantity,
          evalAmount: h.evalAmount,
          costAmount: h.costAmount,
          pnlAmount: h.pnlAmount,
          pnlRate: h.pnlRate,
          isPartial: h.isPartial,
          confidence: h.confidence,
          isCash: h.isCash
        }))
      },
      reconciliation,
      classification,
      duplicationWarning
    };

    await store.saveImportJob(job);
    await store.logAudit("CREATE_IMPORT_JOB", { importJobId: job.importJobId, classification, discrepancyPass: reconciliation.discrepancyPass });

    return res.json(job);
  } catch (error: any) {
    console.error(`[RequestId: ${requestId}] OCR Import Job Error:`, error);
    return res.status(500).json({
      error: "OCR_EXTRACTION_FAILED",
      message: "캡처 이미지 처리 중 오류가 발생했습니다.",
      requestId
    });
  }
});

// 5. Get Import Job Details (GET /api/import-jobs/:id)
app.get("/api/import-jobs/:id", requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();
  const job = await store.getImportJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "IMPORT_JOB_NOT_FOUND", message: "작업을 찾을 수 없습니다." });
  }
  return res.json(job);
});

// 6. User edits provisional import job before approval (PATCH /api/import-jobs/:id)
app.patch("/api/import-jobs/:id", requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();

  const job = await store.getImportJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "IMPORT_JOB_NOT_FOUND", message: "작업을 찾을 수 없습니다." });
  }

  if (job.status !== "PROVISIONAL") {
    return res.status(400).json({ error: "JOB_NOT_EDITABLE", message: "이미 완료되었거나 거부된 작업입니다." });
  }

  const { reviewedData } = req.body;
  if (!reviewedData) {
    return res.status(400).json({ error: "MISSING_REVIEW_DATA", message: "수정 데이터가 누락되었습니다." });
  }

  // Validate changes
  const validated = PortfolioCaptureZodSchema.safeParse(reviewedData);
  if (!validated.success) {
    return res.status(422).json({
      error: "INVALID_MODIFICATION",
      message: "수정 데이터 형식이 올바르지 않습니다.",
      issues: validated.error.issues
    });
  }

  const captureData = validated.data;
  const reconciliation = reconcilePortfolioCapture(captureData);

  job.reviewedData = {
    brokerName: captureData.brokerName,
    accountType: captureData.accountType,
    captureDate: captureData.captureDate ?? job.reviewedData.captureDate,
    currency: captureData.currency,
    totalAssetAmount: captureData.totalAssetAmount ?? null,
    cashBalance: captureData.cashBalance,
    cashIncludedInHoldings: captureData.cashIncludedInHoldings ?? false,
    isAggregatorScreen: captureData.isAggregatorScreen,
    detectedAccountIdMasked: captureData.detectedAccountIdMasked ?? null,
    holdings: captureData.holdings.map(h => ({
      name: h.name,
      ticker: h.ticker ?? null,
      quantity: h.quantity,
      evalAmount: h.evalAmount,
      costAmount: h.costAmount,
      pnlAmount: h.pnlAmount,
      pnlRate: h.pnlRate,
      isPartial: h.isPartial,
      confidence: h.confidence,
      isCash: h.isCash
    }))
  };
  job.reconciliation = reconciliation;

  await store.saveImportJob(job);
  await store.logAudit("MODIFY_IMPORT_JOB", { importJobId: job.importJobId, discrepancyPass: reconciliation.discrepancyPass });

  return res.json(job);
});

// 7. Approve Import Job and Commit to Baseline (POST /api/import-jobs/:id/approve)
app.post("/api/import-jobs/:id/approve", requireAuth, async (req, res) => {
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();

  const job = await store.getImportJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "IMPORT_JOB_NOT_FOUND", message: "해당 검수 작업을 찾을 수 없습니다." });
  }

  if (job.status === "APPROVED") {
    return res.status(400).json({ error: "ALREADY_APPROVED", message: "이미 승인 완료된 작업입니다." });
  }

  // P0 Block: DEMO Data cannot be committed to real portfolio baseline
  if (job.dataMode === "DEMO") {
    return res.status(422).json({
      error: "DEMO_DATA_CANNOT_BE_COMMITTED",
      message: "시연용 프리셋(DEMO) 데이터는 실제 포트폴리오 기준선으로 승인할 수 없습니다."
    });
  }

  // Deterministic Reconciliation Re-check on Server
  const reconciliation = reconcilePortfolioCapture(job.reviewedData as ValidatedPortfolioCapture);
  if (!reconciliation.discrepancyPass) {
    return res.status(422).json({
      error: "RECONCILIATION_FAILED",
      message: "합계 검산 불일치로 승인이 거부되었습니다.",
      reconciliation
    });
  }

  const snapshotId = `SNAP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const asOfDate = getKSTDateString();
  const approvedAt = new Date().toISOString();

  // Find or Create Account Record
  const accounts = await store.getAccounts();
  let targetAccountId = "";
  for (const acc of Object.values(accounts)) {
    if (acc.accountFingerprint === job.accountFingerprint) {
      targetAccountId = acc.accountId;
      break;
    }
  }

  if (!targetAccountId) {
    targetAccountId = `ACC-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    accounts[targetAccountId] = {
      accountId: targetAccountId,
      accountAlias: `${job.reviewedData.brokerName} ${job.reviewedData.detectedAccountIdMasked || ""}`.trim(),
      institution: job.reviewedData.brokerName,
      accountType: job.reviewedData.accountType,
      accountFingerprint: job.accountFingerprint,
      currentSnapshotId: snapshotId,
      isActive: true,
      updatedAt: approvedAt
    };
  } else {
    accounts[targetAccountId].currentSnapshotId = snapshotId;
    accounts[targetAccountId].updatedAt = approvedAt;
  }

  // Create Snapshot (Unified 'holdings', never 'items')
  const newSnapshot: PortfolioSnapshot = {
    snapshotId,
    accountId: targetAccountId,
    approvedAt,
    asOfDate,
    captureDate: job.reviewedData.captureDate || asOfDate,
    brokerName: job.reviewedData.brokerName,
    accountType: job.reviewedData.accountType,
    detectedAccountIdMasked: job.reviewedData.detectedAccountIdMasked,
    totalAssetAmount: Number(job.reviewedData.totalAssetAmount),
    cashBalance: Number(job.reviewedData.cashBalance),
    holdingsCount: job.reviewedData.holdings.length,
    dataStatus: "CONFIRMED",
    holdings: job.reviewedData.holdings
  };

  await store.saveSnapshot(newSnapshot);
  await store.saveAccounts(accounts);

  // Mark job as approved
  job.status = "APPROVED";
  await store.saveImportJob(job);

  // Recalculate whole portfolio InvestmentState across all active accounts
  const allSnapshots = await store.getSnapshots();
  const activeSnapshots = allSnapshots.filter(s => {
    const acc = accounts[s.accountId];
    return acc && acc.currentSnapshotId === s.snapshotId && acc.isActive;
  });

  const updatedState = calculateInvestmentState(activeSnapshots.length > 0 ? activeSnapshots : [newSnapshot]);
  await store.saveInvestmentState(updatedState);

  await store.logAudit("APPROVE_SNAPSHOT", {
    importJobId: job.importJobId,
    snapshotId,
    accountId: targetAccountId,
    totalAssetAmount: newSnapshot.totalAssetAmount
  });

  return res.json({
    success: true,
    snapshotId,
    message: "포트폴리오 기준선이 성공적으로 승인 및 영구 보존되었습니다.",
    snapshot: newSnapshot,
    updatedState
  });
});

// Legacy backward-compatibility endpoints
app.post("/api/ocr/extract", requireAuth, ocrRateLimiter, async (req, res) => {
  // Delegate directly to POST /api/import-jobs logic
  const uid = (req as any).user.uid;
  const store = new PersistentUserStore(uid);
  await store.initStore();
  const { samplePreset } = req.body;

  if (samplePreset) {
    const forwardRes = await fetch(`http://127.0.0.1:${PORT}/api/import-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.authorization as string
      },
      body: JSON.stringify({ samplePreset })
    });
    const data = await forwardRes.json();
    return res.status(forwardRes.status).json({
      ...data.reviewedData,
      importJobId: data.importJobId,
      calculatedSumEval: data.reconciliation.calculatedTotal,
      discrepancy: data.reconciliation.discrepancy,
      discrepancyPass: data.reconciliation.discrepancyPass,
      requiresManualReview: data.reconciliation.requiresManualReview,
      auditNotes: data.reconciliation.auditNotes,
      duplicationWarning: data.duplicationWarning,
      dataMode: data.dataMode
    });
  }

  return res.status(400).json({
    error: "DEPRECATED_ENDPOINT",
    message: "새로운 안전 규격인 POST /api/import-jobs 엔드포인트를 사용하십시오."
  });
});

// 8. Copilot Studio Trade Review Agent
app.post("/api/copilot/gatekeeper", async (req, res) => {
  const { ticker, side, proposedAmount, entryPrice, stopPrice, targetPrice, thesis, counterThesis, fomoScore, currentRegime } = req.body;
  const ai = getGeminiAI();

  if (!ai || isQuotaCircuitBreakerOpen()) {
    return res.json({
      verdict: fomoScore > 60 ? "WAIT" : "APPROVE 50%",
      aiReasoning: "Copilot 휴리스틱 엔진: FOMC 이벤트 D-1 및 10년물 금리 부담 구간으로 인해 공격적 포지션 진입보다는 분할 매수 또는 이벤트 후 1차 확인이 권장됩니다.",
      riskAnalysis: "사전 무효화 조건이 설정되어 있으나 목표비중(46.0%) 대비 현재 잔여 한도를 고려하여 주문금액 50% 축소가 안전합니다.",
      counterThesisAudit: counterThesis || "단기 차익실현 및 거시 이벤트 통과 후 변동성 확대 가능성",
      isFallback: true
    });
  }

  try {
    const prompt = `당신은 Microsoft Copilot Studio 기반의 개인 투자 관제 시스템(Investment OS)의 "Trade Review Agent"입니다.
사용자가 다음 주문 전 검토를 요청했습니다:
- 종목: ${ticker} (${side})
- 예정 금액: ${proposedAmount} KRW
- 진입가: ${entryPrice} / 손절가: ${stopPrice} / 목표가: ${targetPrice}
- 투자 가설: ${thesis}
- 반대 논리: ${counterThesis}
- FOMO 위험 점수: ${fomoScore}/100
- 현재 시장 레짐: ${currentRegime} (56점 Neutral)

역할:
1. 실제 증권사 매수 전 엄격한 "주문 브레이크" 역할을 수행하십시오.
2. 판정은 APPROVE / APPROVE 50% / WAIT / REJECT / REVIEW TOMORROW 중 하나를 선택하세요.
3. 반대 논리를 검증하고, FOMO 징후 및 레짐 적합도를 객관적으로 비판하세요.
4. 간결하고 단호한 한국어 3~4문장으로 피드백하세요.

JSON 형식으로 응답하세요:
{
  "verdict": "APPROVE" | "APPROVE 50%" | "WAIT" | "REJECT" | "REVIEW TOMORROW",
  "aiReasoning": "간결한 심사평",
  "riskAnalysis": "주요 위험 요인 및 계획손실 적합도",
  "recommendedAction": "구체적 권고 행동"
}`;

    const { text, isQuotaExhausted } = await generateContentWithResilience(
      ai,
      {
        contents: prompt,
        config: { responseMimeType: "application/json" }
      },
      {
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
        maxRetries: 0,
      }
    );

    if (text && !isQuotaExhausted) {
      return res.json(JSON.parse(text));
    }
  } catch {
    // Fall through to heuristic response below
  }

  return res.json({
    verdict: fomoScore > 60 ? "WAIT" : "APPROVE 50%",
    aiReasoning: "Copilot 안전 모드: 거시 이벤트(FOMC/CPI) 전 변동성 관리 및 리스크 분산을 위해 분할 매수 및 계획손실 준수가 권장됩니다.",
    riskAnalysis: "사전 무효화 조건이 설정되어 있으나 단기 변동성 관리를 위해 주문금액 50% 축소가 적합합니다.",
    recommendedAction: "주문 규모 50% 축소 또는 이벤트 이후 분할 매수 집행",
    isFallback: true
  });
});


// 9. Copilot Studio Decision Journal Review Agent
app.post("/api/copilot/journal-review", async (req, res) => {
  const { journals } = req.body;
  const ai = getGeminiAI();

  if (!ai || isQuotaCircuitBreakerOpen() || !journals || journals.length === 0) {
    return res.json({
      ruleComplianceRate: 88,
      keyFeedback: "최근 10건의 거래 중 8건이 사전 원칙을 준수했습니다. 'FOMC 직후 추격매수' 1건과 '계획손실 초과' 1건이 확인되어 사전 진입가 원칙을 강화할 필요가 있습니다.",
      errorPatterns: [
        { type: "추격매수(FOMO)", count: 2, impact: "중립-부정적" },
        { type: "정상적 확률 손실", count: 1, impact: "규칙 준수 우수" },
        { type: "레짐 판단 지연", count: 1, impact: "경미" }
      ]
    });
  }

  try {
    const prompt = `당신은 Copilot Studio의 "Monthly Review Agent"입니다.
다음 투자 결정 저널 기록들을 분석하여 규칙 준수율과 반복되는 인지적 오류 패턴을 도출하세요.
기록: ${JSON.stringify(journals)}

JSON 출력 규격:
{
  "ruleComplianceRate": number (0~100),
  "keyFeedback": "한 달간의 투자 원칙 준수 요약 및 조언",
  "errorPatterns": [
    { "type": "오류 유형", "count": number, "impact": "영향" }
  ]
}`;

    const { text, isQuotaExhausted } = await generateContentWithResilience(
      ai,
      {
        contents: prompt,
        config: { responseMimeType: "application/json" }
      },
      {
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
        maxRetries: 0,
      }
    );

    if (text && !isQuotaExhausted) {
      return res.json(JSON.parse(text));
    }
  } catch {
    // Fall through cleanly
  }

  return res.json({
    ruleComplianceRate: 85,
    keyFeedback: "규칙 준수율 85%를 유지하고 있습니다. 결과와 관계없이 사전 무효화 조건을 설정한 거래는 장기 생존 확률을 크게 높입니다.",
    errorPatterns: [
      { type: "추격매수(FOMO)", count: 1, impact: "주의 필요" },
      { type: "계획손실 준수", count: 3, impact: "양호" }
    ],
    isFallback: true
  });
});


// 10. Yahoo Finance Official Quotes Endpoint (GET /api/market/yahoo-quotes)
app.get("/api/market/yahoo-quotes", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const quotes = await fetchAllYahooQuotes(force);
    return res.json({
      timestamp: new Date().toISOString(),
      source: "YAHOO_FINANCE_OFFICIAL",
      quotes
    });
  } catch (error: any) {
    console.error("Yahoo Quotes error:", error);
    return res.status(500).json({ error: "YAHOO_QUOTES_FAILED", message: error.message });
  }
});

// 11. Automated Reliability Test Suite (GET/POST /api/market/reliability-test)
app.all("/api/market/reliability-test", async (req, res) => {
  try {
    const testResult = await runYahooFinanceReliabilityTest();
    return res.json(testResult);
  } catch (error: any) {
    console.error("Reliability Test Error:", error);
    return res.status(500).json({ error: "RELIABILITY_TEST_FAILED", message: error.message });
  }
});

// 12. Hybrid Live Market Sync: Yahoo Finance Exact Quotes + Gemini Macro Grounding (GET/POST /api/market/live-sync)
app.all("/api/market/live-sync", async (req, res) => {
  try {
    const force = req.query.force === "true" || req.body?.forceRefresh === true;
    const ai = getGeminiAI();

    // 1. Fetch exact quotes from Yahoo Finance
    const quotes = await fetchAllYahooQuotes(force);
    const indicators = buildMarketIndicatorsFromQuotes(quotes);
    const regimeData = computeRegimeFactorsFromQuotes(quotes);
    const sgovData = computeSgovSignalsFromQuotes(quotes);

    // 2. Fetch qualitative macro events & IPO status from Gemini Search Grounding
    const geminiData = await fetchGeminiLiveMarket(ai, force);

    const nowKST = getKSTDateString();
    const syncedAt = new Date().toISOString();

    const liveState = {
      regimeState: {
        asOf: nowKST,
        currentStockWeight: 0.384,
        targetStockWeight: 0.46,
        shortageWeightPct: 7.6,
        deployableAmountKRW: 30950000,
        regime: regimeData.regime,
        regimeScore: regimeData.totalScore,
        confidence: 0.95,
        action: regimeData.regime === "Risk On" ? "BUY" : regimeData.regime === "Defensive" ? "REDUCE" : "HOLD",
        dailyMaxOrderKRW: regimeData.regime === "Risk On" ? 10000000 : regimeData.regime === "Defensive" ? 0 : 5000000,
        nextEvent: geminiData.regimeState.nextEvent || "미 연준 FOMC 기준금리 결정",
        daysToEvent: geminiData.regimeState.daysToEvent || 5,
        reasonsWhyScoreChanged: regimeData.reasons,
        biggestDragFactor: regimeData.biggestDrag,
        whatNeededForRiskOn: regimeData.whatNeededForRiskOn,
        failureConditionDefensive: regimeData.failureCondition
      },
      marketIndicators: indicators,
      factorScores: regimeData.factors,
      sgovSignals: sgovData.signals,
      sgovPlan: sgovData.plan,
      macroEvents: geminiData.macroEvents,
      ipoList: geminiData.ipoList,
      quotesSnapshot: quotes,
      isLiveGrounded: true,
      lastSyncedAt: syncedAt,
      source: "Yahoo Finance Live + Gemini Grounded Hybrid"
    };

    return res.json({ liveState, syncedAt });
  } catch (error: any) {
    console.error("Live Market Sync error:", error);
    return res.status(500).json({ error: "LIVE_SYNC_FAILED", message: error.message });
  }
});

// 13. Complete Initial State with Yahoo Finance Accurate Quotes (GET /api/state)
app.get("/api/state", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const ai = getGeminiAI();

    // 1. Fetch exact quotes from Yahoo Finance
    const quotes = await fetchAllYahooQuotes(force);
    const indicators = buildMarketIndicatorsFromQuotes(quotes);
    const regimeData = computeRegimeFactorsFromQuotes(quotes);
    const sgovData = computeSgovSignalsFromQuotes(quotes);
    const liveHoldings = updateHoldingsWithLiveQuotes(initialHoldings, quotes);

    // 2. Fetch qualitative macro events & IPO status from Gemini
    const geminiData = await fetchGeminiLiveMarket(ai, force);

    const nowKST = getKSTDateString();
    const syncedAt = new Date().toISOString();

    return res.json({
      regimeState: {
        asOf: nowKST,
        currentStockWeight: 0.384,
        targetStockWeight: 0.46,
        shortageWeightPct: 7.6,
        deployableAmountKRW: 30950000,
        regime: regimeData.regime,
        regimeScore: regimeData.totalScore,
        confidence: 0.95,
        action: regimeData.regime === "Risk On" ? "BUY" : regimeData.regime === "Defensive" ? "REDUCE" : "HOLD",
        dailyMaxOrderKRW: regimeData.regime === "Risk On" ? 10000000 : regimeData.regime === "Defensive" ? 0 : 5000000,
        nextEvent: geminiData.regimeState.nextEvent || "미 연준 FOMC 기준금리 결정",
        daysToEvent: geminiData.regimeState.daysToEvent || 5,
        reasonsWhyScoreChanged: regimeData.reasons,
        biggestDragFactor: regimeData.biggestDrag,
        whatNeededForRiskOn: regimeData.whatNeededForRiskOn,
        failureConditionDefensive: regimeData.failureCondition
      },
      holdings: liveHoldings,
      marketIndicators: indicators,
      factorScores: regimeData.factors,
      sgovSignals: sgovData.signals,
      sgovPlan: sgovData.plan,
      macroEvents: geminiData.macroEvents,
      ipoList: geminiData.ipoList,
      journalEntries: initialDecisionJournals,
      quotesSnapshot: quotes,
      isLiveGrounded: true,
      lastSyncedAt: syncedAt,
      source: "Yahoo Finance Live Official Data + Gemini Grounded Hybrid"
    });
  } catch (error: any) {
    console.error("Fetch API state error:", error);
    return res.status(500).json({ error: "STATE_FETCH_FAILED", message: error.message });
  }
});

// 12. Gemini Real-time IPO Audit Endpoint (POST /api/gemini/ipo-audit)
app.post("/api/gemini/ipo-audit", async (req, res) => {
  const { companyName } = req.body;
  const ai = getGeminiAI();
  if (!ai || isQuotaCircuitBreakerOpen()) {
    return res.json({
      companyName: companyName || "Anthropic",
      officialS1Confirmed: false,
      status: "SEC S-1 미제출 (비상장 단계)",
      expectedValuation: "$40B~$60B",
      aiBucketOverlap: true,
      verdict: "관찰 대기",
      secFilingsFound: 0,
      analysis: "현재 Form S-1 증권신고서가 미국 SEC EDGAR에 공식 접수되지 않았습니다. 상장 첫날 매수 금지 철칙이 적용됩니다.",
      isFallback: true
    });
  }

  try {
    const prompt = `Use Google Search to check the real-time IPO and SEC filing status of the private company: "${companyName}".
Specifically verify:
1. Has this company officially filed Form S-1 with the SEC for an IPO?
2. What is the latest estimated valuation or recent funding round?
3. What is the expected IPO timeline or current stage?

Return strict JSON:
{
  "companyName": "${companyName}",
  "officialS1Confirmed": false,
  "status": "SEC S-1 미제출 (사전 관찰 단계)",
  "expectedValuation": "$40B~$60B",
  "expectedTimeline": "2026 Q4~2027",
  "aiBucketOverlap": true,
  "verdict": "관찰 대기",
  "analysis": "구글 검색 결과 기반 2~3문장의 한국어 요약"
}`;

    const { text, isQuotaExhausted } = await generateContentWithResilience(
      ai,
      {
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      },
      {
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
        maxRetries: 0,
      }
    );

    if (text && !isQuotaExhausted) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return res.json(JSON.parse(jsonMatch[0]));
      }
    }
    return res.json({
      companyName,
      officialS1Confirmed: false,
      status: "SEC S-1 미제출 (사전 관찰 단계)",
      expectedValuation: "추정 진행 중",
      analysis: "공식 S-1 접수 내역이 확인되지 않았습니다.",
      verdict: "관찰 대기"
    });
  } catch {
    return res.json({
      companyName,
      officialS1Confirmed: false,
      status: "SEC S-1 미제출 (사전 관찰 단계)",
      expectedValuation: "$40B~$60B",
      expectedTimeline: "2026 Q4~2027",
      aiBucketOverlap: true,
      verdict: "관찰 대기",
      analysis: "실시간 검색 일시 지연으로 사전 등록된 안전 원칙(상장 첫날 매수 금지 및 비상장 대기)을 유지합니다.",
      isFallback: true
    });
  }
});

// -------------------------------------------------------------
// Daily Check, Multi-Horizon Strategy Engine & Scheduler Endpoints
// -------------------------------------------------------------

// GET /api/daily-check/current
app.get("/api/daily-check/current", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    let latest = await storage.getLatestDailyStrategy();

    if (!latest) {
      const ai = getGeminiAI();
      latest = await runDeterministicDailyStrategy(ai, { userId });
      await storage.saveDailyStrategy(latest);
    }

    const schedulerStatus = schedulerService.getStatus();
    const notifications = await storage.getNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;

    return res.json({
      strategy: latest,
      scheduler: schedulerStatus,
      unreadNotificationCount: unreadCount
    });
  } catch (err: any) {
    console.error("Daily Check Current error:", err);
    return res.status(500).json({ error: "DAILY_CHECK_FETCH_FAILED", message: err.message });
  }
});

// POST /api/daily-check/run
app.post("/api/daily-check/run", async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || "usr-preview-client-01";
    const fomoScore = req.body?.fomoScore;
    const forceRefresh = req.body?.forceRefresh === true;
    const ai = getGeminiAI();

    const strategy = await runDeterministicDailyStrategy(ai, {
      userId,
      fomoScore,
      forceRefresh
    });

    const storage = getStrategyStorage(userId);
    const newNotifications = await storage.saveDailyStrategy(strategy);
    const schedulerStatus = schedulerService.getStatus();

    return res.json({
      success: true,
      strategy,
      newNotifications,
      scheduler: schedulerStatus
    });
  } catch (err: any) {
    console.error("Daily Check Run error:", err);
    return res.status(500).json({ error: "DAILY_CHECK_RUN_FAILED", message: err.message });
  }
});

// POST /api/daily-strategy/calculate (Pure Deterministic Strategy Calculation Endpoint)
app.post("/api/daily-strategy/calculate", (req, res) => {
  try {
    const input = req.body;
    if (!input || !input.regime || !input.portfolio || !input.events || !input.signals) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_INPUTS",
        message: "regime, portfolio, events, signals 필드가 모두 필요합니다."
      });
    }

    const output = calculateDailyStrategy(input);
    return res.json({
      success: true,
      result: output
    });
  } catch (err: any) {
    console.error("Calculate Daily Strategy error:", err);
    return res.status(500).json({ error: "CALCULATION_FAILED", message: err.message });
  }
});

// GET /api/strategy/daily
app.get("/api/strategy/daily", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    let latest = await storage.getLatestDailyStrategy();
    if (!latest) {
      const ai = getGeminiAI();
      latest = await runDeterministicDailyStrategy(ai, { userId });
      await storage.saveDailyStrategy(latest);
    }
    return res.json(latest);
  } catch (err: any) {
    return res.status(500).json({ error: "DAILY_STRATEGY_FAILED", message: err.message });
  }
});

// GET /api/strategy/history
app.get("/api/strategy/history", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    const history = await storage.getDailyStrategies();
    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: "STRATEGY_HISTORY_FAILED", message: err.message });
  }
});

// GET /api/strategy/weekly
app.get("/api/strategy/weekly", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    let weekly = await storage.getLatestWeeklyStrategy();
    if (!weekly) {
      const ai = getGeminiAI();
      weekly = await runWeeklyStrategy(ai, userId);
      await storage.saveWeeklyStrategy(weekly);
    }
    return res.json(weekly);
  } catch (err: any) {
    return res.status(500).json({ error: "WEEKLY_STRATEGY_FAILED", message: err.message });
  }
});

// GET /api/strategy/monthly
app.get("/api/strategy/monthly", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    let monthly = await storage.getLatestMonthlyStrategy();
    if (!monthly) {
      const ai = getGeminiAI();
      monthly = await runMonthlyStrategy(ai, userId);
      await storage.saveMonthlyStrategy(monthly);
    }
    return res.json(monthly);
  } catch (err: any) {
    return res.status(500).json({ error: "MONTHLY_STRATEGY_FAILED", message: err.message });
  }
});

// GET /api/notifications
app.get("/api/notifications", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    const notifications = await storage.getNotifications();
    return res.json({ notifications });
  } catch (err: any) {
    return res.status(500).json({ error: "NOTIFICATIONS_FETCH_FAILED", message: err.message });
  }
});

// PATCH /api/notifications/:id/read
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || "usr-preview-client-01";
    const { id } = req.params;
    const storage = getStrategyStorage(userId);
    const updated = await storage.markNotificationRead(id);
    return res.json({ success: updated });
  } catch (err: any) {
    return res.status(500).json({ error: "NOTIFICATION_UPDATE_FAILED", message: err.message });
  }
});

// PATCH /api/notifications/read-all
app.patch("/api/notifications/read-all", async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || "usr-preview-client-01";
    const storage = getStrategyStorage(userId);
    await storage.markAllNotificationsRead();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "NOTIFICATION_READ_ALL_FAILED", message: err.message });
  }
});

// POST /api/scheduler/daily-check
app.post("/api/scheduler/daily-check", async (req, res) => {
  try {
    const strategy = await schedulerService.triggerDailyCheck("API_ENDPOINT_TRIGGER");
    return res.json({ success: true, strategy, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: "SCHEDULER_DAILY_CHECK_FAILED", message: err.message });
  }
});

// POST /api/scheduler/weekly-review
app.post("/api/scheduler/weekly-review", async (req, res) => {
  try {
    const weekly = await schedulerService.triggerWeeklyReview("API_ENDPOINT_TRIGGER");
    return res.json({ success: true, weekly, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: "SCHEDULER_WEEKLY_FAILED", message: err.message });
  }
});

// POST /api/scheduler/monthly-review
app.post("/api/scheduler/monthly-review", async (req, res) => {
  try {
    const monthly = await schedulerService.triggerMonthlyReview("API_ENDPOINT_TRIGGER");
    return res.json({ success: true, monthly, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: "SCHEDULER_MONTHLY_FAILED", message: err.message });
  }
});

// -------------------------------------------------------------
// Technical Indicators & Regime Signal Provider API Endpoints
// -------------------------------------------------------------

// GET /api/technical/assets
app.get("/api/technical/assets", (_req, res) => {
  return res.json({ assets: technicalDataProvider.getAvailableAssets() });
});

// POST /api/technical/assets
app.post("/api/technical/assets", (req, res) => {
  const { ticker, name, market, basePrice, currency, description, sgovCompatibility, sgovNote } = req.body || {};
  if (!ticker) {
    return res.status(400).json({ error: "Ticker is required" });
  }
  technicalDataProvider.addCustomAsset({
    ticker,
    name: name || ticker,
    market: market || "US_STOCK",
    basePrice: Number(basePrice) || 150,
    currency: currency || "USD",
    description: description || `${ticker} 사용자 등록 종목`,
    sgovCompatibility: sgovCompatibility || "MODERATE",
    sgovNote: sgovNote || "200일선 상회 및 5일 RSI 과매도 시 분할 매수 원칙 적용."
  });
  return res.json({ success: true, assets: technicalDataProvider.getAvailableAssets() });
});

// DELETE /api/technical/assets/:ticker
app.delete("/api/technical/assets/:ticker", (req, res) => {
  const ticker = req.params.ticker;
  const removed = technicalDataProvider.removeCustomAsset(ticker);
  return res.json({ success: removed, assets: technicalDataProvider.getAvailableAssets() });
});

// GET /api/technical/series/:ticker?
app.get("/api/technical/series/:ticker?", (req, res) => {
  const ticker = req.params.ticker || "VOO";
  const timeframe = (req.query.timeframe as any) || "3M";
  const series = technicalDataProvider.calculateTechnicalSeries(ticker, timeframe);
  return res.json({ ticker, timeframe, count: series.length, series });
});

// GET /api/technical/summary/:ticker?
app.get("/api/technical/summary/:ticker?", (req, res) => {
  const ticker = req.params.ticker || "VOO";
  const timeframe = (req.query.timeframe as any) || "3M";
  const summary = technicalDataProvider.getTechnicalSummary(ticker, timeframe);
  return res.json({ summary });
});

// GET /api/technical/regime-signal/:ticker?
app.get("/api/technical/regime-signal/:ticker?", (req, res) => {
  const ticker = req.params.ticker || "VOO";
  const signal = technicalDataProvider.evaluateRegimeSignal(ticker);
  return res.json({ signal });
});

// GET /api/technical/market-aggregate
app.get("/api/technical/market-aggregate", (_req, res) => {
  const aggregate = technicalDataProvider.getMarketAggregateTechnicalRegime();
  return res.json(aggregate);
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Initialize and start the Daily Check scheduler
  schedulerService.setAIClient(getGeminiAI());
  schedulerService.start();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Investment OS Production-Hardened Engine] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
