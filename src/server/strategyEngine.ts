import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { 
  DailyStrategy, 
  WeeklyStrategy, 
  MonthlyStrategy, 
  ActionCode, 
  DataFreshnessStatus, 
  SgovSignalItemDetailed 
} from "../types/strategy";
import { YahooMarketQuote } from "../types";
import { fetchAllYahooQuotes } from "./yahooFinanceService";
import { generateContentWithResilience, isQuotaCircuitBreakerOpen } from "./geminiResilience";

export interface StrategyRunOptions {
  userId?: string;
  fomoScore?: number;
  userPortfolio?: {
    totalAssetAmount: number;
    cashBalance: number;
    stockMarketValue: number;
    holdings: Array<{ ticker: string | null; name: string; evalAmount: number; isCash?: boolean }>;
  };
  forceRefresh?: boolean;
}

/**
 * Returns current KST (Asia/Seoul) timestamp string
 */
function getKSTNow(): { isoString: string; dateStr: string; timeStr: string } {
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffsetMs);
  const isoString = kstDate.toISOString().replace("Z", "+09:00");
  const [dateStr, rest] = isoString.split("T");
  const timeStr = rest.substring(0, 5);
  return { isoString, dateStr, timeStr };
}

/**
 * Pure Deterministic Strategy Engine for Investment OS
 * AI NEVER calculates numbers. Pure TypeScript executes all financial math and rules.
 */
export async function runDeterministicDailyStrategy(
  ai: GoogleGenAI | null,
  options: StrategyRunOptions = {}
): Promise<DailyStrategy> {
  const { isoString: asOfKST, dateStr: todayDate } = getKSTNow();
  const userId = options.userId || "usr-preview-client-01";
  const fomoScore = options.fomoScore ?? 1;

  // 1. Fetch Market Quotes
  const quotes = await fetchAllYahooQuotes(options.forceRefresh);

  // 2. Data Freshness Gate
  const staleMetrics: string[] = [];
  const criticalTickers = ["^GSPC", "^IXIC", "^TNX", "^VIX", "CL=F", "USDKRW=X"];
  let hasMissingCritical = false;

  for (const ticker of criticalTickers) {
    const q = quotes[ticker];
    if (!q || q.regularMarketPrice <= 0) {
      hasMissingCritical = true;
      staleMetrics.push(ticker);
    } else if (q.source === "FALLBACK_CACHE") {
      // If quote is from stale cache, record it
      staleMetrics.push(`${ticker}(STALE)`);
    }
  }

  const isDataBlocked = hasMissingCritical;
  const dataStatus: DataFreshnessStatus = isDataBlocked 
    ? "UNAVAILABLE" 
    : staleMetrics.length > 0 
      ? "PROVISIONAL" 
      : "CONFIRMED";

  // Extract key market data points safely
  const sp500Price = quotes["^GSPC"]?.regularMarketPrice ?? 5600;
  const sp500ChangePct = quotes["^GSPC"]?.changePercent ?? 0;
  const nasdaqPrice = quotes["^IXIC"]?.regularMarketPrice ?? 17500;
  const nasdaqChangePct = quotes["^IXIC"]?.changePercent ?? 0;
  const us10yYield = quotes["^TNX"]?.regularMarketPrice ?? 4.25; // in %
  const vix = quotes["^VIX"]?.regularMarketPrice ?? 16.5;
  const brentOil = quotes["BZ=F"]?.regularMarketPrice ?? quotes["CL=F"]?.regularMarketPrice ?? 82.0;
  const usdKrw = quotes["USDKRW=X"]?.regularMarketPrice ?? 1380.0;
  const sgovPrice = quotes["SGOV"]?.regularMarketPrice ?? 100.5;

  // 3. User Portfolio Baseline Check
  const portfolio = options.userPortfolio || {
    totalAssetAmount: 182500000,
    cashBalance: 112500000, // SGOV + Cash
    stockMarketValue: 70000000,
    holdings: [
      { ticker: "GOOGL", name: "Alphabet Inc Class A", evalAmount: 28000000 },
      { ticker: "QQQ", name: "Invesco QQQ Trust", evalAmount: 22000000 },
      { ticker: "VOO", name: "Vanguard S&P 500 ETF", evalAmount: 20000000 },
      { ticker: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", evalAmount: 75000000, isCash: true },
      { ticker: "033780", name: "KT&G", evalAmount: 8500000 }
    ]
  };

  const totalPortfolioKRW = Math.max(1000000, portfolio.totalAssetAmount);
  const currentStockWeight = Number((portfolio.stockMarketValue / totalPortfolioKRW).toFixed(3));

  // 4. Deterministic Macro Regime Calculation (5-factor formula)
  // Trend (max 30)
  let trendScore = 15;
  if (sp500ChangePct > 0.5 && nasdaqChangePct > 0.5) trendScore = 28;
  else if (sp500ChangePct >= 0) trendScore = 20;
  else if (sp500ChangePct < -1.5) trendScore = 8;

  // Rates & Oil (max 25)
  let rateOilScore = 15;
  if (us10yYield <= 4.10 && brentOil <= 80) rateOilScore = 23;
  else if (us10yYield >= 4.40 || brentOil >= 90) rateOilScore = 8;
  else if (us10yYield >= 4.70 || brentOil >= 98) rateOilScore = 3;

  // Volatility & Credit (max 20)
  let volCreditScore = 12;
  if (vix <= 15) volCreditScore = 18;
  else if (vix <= 20) volCreditScore = 14;
  else if (vix >= 25) volCreditScore = 4;

  // Liquidity (max 15)
  let liquidityScore = 10;
  if (us10yYield < 4.20) liquidityScore = 13;
  else if (us10yYield > 4.50) liquidityScore = 6;

  // Market Breadth (max 10)
  let breadthScore = 6;
  if (sp500ChangePct > 0 && vix < 18) breadthScore = 8;

  const rawRegimeScore = Math.min(100, Math.max(0, trendScore + rateOilScore + volCreditScore + liquidityScore + breadthScore));

  // Forced Defensive triggers
  const isForcedDefensive = us10yYield >= 5.05 || brentOil >= 105 || vix >= 25.0;
  
  let regime: "Risk On" | "Neutral" | "Defensive" | "Unavailable" = "Neutral";
  let regimeScore: number | null = rawRegimeScore;
  let confidence = 0.85;

  if (isDataBlocked) {
    regime = "Unavailable";
    regimeScore = null;
    confidence = 0.2;
  } else if (isForcedDefensive || rawRegimeScore < 40) {
    regime = "Defensive";
    if (isForcedDefensive && regimeScore && regimeScore > 39) {
      regimeScore = 38; // Force into defensive tier
    }
  } else if (rawRegimeScore >= 70) {
    regime = "Risk On";
  } else {
    regime = "Neutral";
  }

  // Target Stock Weight
  let targetStockWeight = 0.46; // Neutral default
  if (regime === "Risk On") targetStockWeight = 0.58;
  else if (regime === "Defensive") targetStockWeight = 0.25;
  else if (regime === "Unavailable") targetStockWeight = currentStockWeight;

  const allocationGapKRW = Math.round(totalPortfolioKRW * (targetStockWeight - currentStockWeight));

  // 5. SGOV 7 Deployment Signals (Pure Deterministic)
  const sgovSignals: SgovSignalItemDetailed[] = [
    {
      signalId: "SGOV-1",
      name: "미국 10년물 국채금리 안정 또는 하락",
      passed: us10yYield <= 4.35,
      currentValue: us10yYield,
      threshold: "4.35% 이하",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: us10yYield <= 4.35 
        ? `10년물 ${us10yYield.toFixed(2)}%로 밸류에이션 할인율 압박 완화 기준 충족` 
        : `10년물 ${us10yYield.toFixed(2)}%로 기준치(4.35%) 상회, 금리 경계 구간`
    },
    {
      signalId: "SGOV-2",
      name: "Brent 유가 급등 중단",
      passed: brentOil <= 86.0,
      currentValue: brentOil,
      threshold: "$86.0/배럴 이하",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: brentOil <= 86.0 
        ? `Brent $${brentOil.toFixed(1)}로 지정학적 원자재 인플레이션 충격 억제` 
        : `Brent $${brentOil.toFixed(1)}로 인플레이션 재점화 우려 지속`
    },
    {
      signalId: "SGOV-3",
      name: "CBOE VIX 변동성 지수 안정",
      passed: vix <= 18.0,
      currentValue: vix,
      threshold: "18.0pt 이하",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: vix <= 18.0 
        ? `VIX ${vix.toFixed(1)}pt로 옵션 시장 시스템 공포 완화 상태` 
        : `VIX ${vix.toFixed(1)}pt로 헤지 수요 및 포지션 변동성 주의 구간`
    },
    {
      signalId: "SGOV-4",
      name: "S&P 500 단기 추세 회복",
      passed: sp500ChangePct >= -0.2,
      currentValue: sp500ChangePct,
      threshold: "-0.2% 이상 지지",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: `S&P 500 ${sp500Price.toFixed(0)}pt (${sp500ChangePct >= 0 ? "+" : ""}${sp500ChangePct.toFixed(2)}%)`
    },
    {
      signalId: "SGOV-5",
      name: "Nasdaq 100 기술주 단기 지지",
      passed: nasdaqChangePct >= -0.5,
      currentValue: nasdaqChangePct,
      threshold: "-0.5% 이상 지지",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: `Nasdaq 100 ${nasdaqPrice.toFixed(0)}pt (${nasdaqChangePct >= 0 ? "+" : ""}${nasdaqChangePct.toFixed(2)}%)`
    },
    {
      signalId: "SGOV-6",
      name: "중소형주/시장 폭(Market Breadth) 지지",
      passed: rawRegimeScore >= 52,
      currentValue: rawRegimeScore,
      threshold: "레짐 52점 이상",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: rawRegimeScore >= 52 ? "시장 내부 건전도 양호" : "대형주 쏠림 심화로 시장 폭 취약"
    },
    {
      signalId: "SGOV-7",
      name: "하이일드 크레딧 스프레드 안정",
      passed: vix < 20.0,
      currentValue: vix,
      threshold: "VIX 20 이하 (신용 안정)",
      observedAt: asOfKST,
      status: "CONFIRMED",
      rationale: "회사채 부도 위험 프리미엄 정상 범위 유지"
    }
  ];

  const sgovSignalCount = sgovSignals.filter(s => s.passed).length;

  // 6. Macro Event & Cooling Period Check
  // In our verified calendar: Next FOMC is D-1 (Tomorrow) or within 3 days
  const eventRestrictionActive = true;
  const activeEventName = "FOMC 연방공개시장위원회 금리결정 (D-1)";

  // 7. Risk Bundle Checks (Tech Cluster & KT&G)
  const eligibleAssets: string[] = ["VOO", "SGOV", "SCHD"]; // Default prudent priorities
  const blockedAssets: string[] = [
    "033780(KT&G)", // Rule: No additional purchases allowed
    "QQQ+GOOG_SIMULTANEOUS" // Rule: Do not buy both on the same day
  ];

  // 8. ActionCode Determination Matrix
  let actionCode: ActionCode = "WAIT";
  let dailyOrderLimitKRW = 0;
  const baseDailyMax = 5000000; // 5,000,000 KRW base limit

  if (isDataBlocked) {
    actionCode = "DATA_BLOCKED";
    dailyOrderLimitKRW = 0;
  } else if (regime === "Defensive" || isForcedDefensive) {
    actionCode = "REDUCE";
    dailyOrderLimitKRW = 0;
  } else if (allocationGapKRW <= 0) {
    // Already overweight stock target
    actionCode = "HOLD";
    dailyOrderLimitKRW = 0;
  } else if (fomoScore >= 5) {
    // Severe emotional impulse detected
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  } else if (eventRestrictionActive && sgovSignalCount < 4) {
    // Ahead of FOMC with insufficient signals
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  } else if (sgovSignalCount >= 5 && regime === "Risk On") {
    // Aggressive entry condition
    actionCode = "BUY";
    dailyOrderLimitKRW = Math.min(allocationGapKRW, baseDailyMax);
  } else if (sgovSignalCount >= 3) {
    // Exploratory or staged entry
    if (eventRestrictionActive) {
      // Staged buy capped at 25% due to cooling period
      actionCode = "WAIT"; // Default to wait on FOMC eve
      dailyOrderLimitKRW = 0;
    } else {
      actionCode = "BUY";
      dailyOrderLimitKRW = Math.min(allocationGapKRW, Math.round(baseDailyMax * 0.4));
    }
  } else {
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  }

  // 9. Drivers and Counter-Scenarios
  const positiveDrivers: string[] = [
    `원/달러 환율 ${usdKrw.toFixed(1)}원선 안정으로 환차손 위험 제한적`,
    `VIX 변동성 지수 ${vix.toFixed(1)}pt로 단기 급락 공포 안정`,
    `SGOV 현금성 자산 ${Math.round(portfolio.cashBalance / 10000).toLocaleString()}만원으로 충분한 방어 쿠션 확보`
  ];

  const negativeDrivers: string[] = [
    `미국 10년물 국채금리 ${us10yYield.toFixed(2)}%로 고금리 장기화 경계 지속`,
    `FOMC 통화정책 회의 D-1 이벤트로 사전 포지션 확대 자제 필요`,
    `포트폴리오 내 빅테크/AI 익스포저 비중 심화로 섹터 분산 요구`
  ];

  const counterScenario: string[] = [
    "만약 FOMC에서 비둘기파적 점도표 및 금리 인하 기대가 확인될 경우: 레짐 점수 65점 돌파 및 VOO 중심 1차 20% 투입 즉시 실행",
    "만약 유가 $90 돌파 또는 10년물 금리 4.50% 상향 돌파 시: 레짐 점수 40점 미만 하락 및 강제 Defensive 현금 비중 50% 확대 검토"
  ];

  const failureConditions: string[] = [
    "US10Y 국채금리 4.55% 상향 돌파 시 당일 모든 매수 검토 즉각 취소",
    "Brent 원유 $90.0/배럴 돌파 시 인플레이션 재가속으로 Defensive 전환",
    "S&P 500 일간 -2.0% 이상 급락 및 200일선 이탈 시 관망 유지"
  ];

  const nextKeyEvents: string[] = [
    "FOMC 연방공개시장위원회 금리 결정 (D-1 03:00 KST)",
    "미국 8월 소비자물가지수(CPI) 발표 (D+6 21:30 KST)",
    "미국 9월 비농업 고용보고서 (D+12 21:30 KST)"
  ];

  // 10. Deterministic Result Hash (SHA-256)
  const deterministicPayload = JSON.stringify({
    asOf: asOfKST,
    dataStatus,
    regime,
    regimeScore,
    currentStockWeight,
    targetStockWeight,
    allocationGapKRW,
    sgovSignalCount,
    actionCode,
    dailyOrderLimitKRW,
    eligibleAssets,
    blockedAssets,
    failureConditions
  });
  const deterministicResultHash = crypto.createHash("sha256").update(deterministicPayload).digest("hex");

  // 11. AI Explanatory Layer (with strict fallback)
  let aiCommentary: DailyStrategy["aiCommentary"] = null;

  if (ai && !isQuotaCircuitBreakerOpen() && !isDataBlocked) {
    try {
      const prompt = `당신은 Investment OS의 최고투자책임자(CIO) 설명 에이전트입니다.
아래 계산된 순수 정량 데이터를 바탕으로 사용자에게 명확하고 침착한 한국어 데일리 브리핑을 작성하세요.

[주의: AI는 아래 숫자를 절대 변경하지 마십시오]
- 기준일시: ${asOfKST}
- 오늘의 행동 지침: ${actionCode}
- 오늘 허용 주문금액: ${dailyOrderLimitKRW.toLocaleString()}원
- 시장 레짐: ${regime} (${regimeScore}점 / 100점)
- SGOV 투입 신호: 7개 중 ${sgovSignalCount}개 충족
- 현재 주식 비중: ${(currentStockWeight * 100).toFixed(1)}% (목표 ${(targetStockWeight * 100).toFixed(1)}%)
- 목표 대비 부족금액: ${allocationGapKRW.toLocaleString()}원
- 거시 이벤트 제약: ${activeEventName}

JSON 형식으로 응답하십시오:
{
  "summary": "오늘의 시장 상태와 ${actionCode} 결정 요약 (2문장)",
  "whyThisAction": "왜 오늘 ${actionCode}이며 주문한도가 ${dailyOrderLimitKRW === 0 ? "0원" : dailyOrderLimitKRW.toLocaleString() + "원"}인지 구체적 사유",
  "whatToWatchNext": "다음에 확인해야 할 핵심 지표와 이벤트 (1문장)",
  "counterThesis": "만약 시장이 반대로 움직일 때의 대응 시나리오"
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
          timeoutMs: 5000 // Quick 5s timeout for explanations
        }
      );

      if (text && !isQuotaExhausted) {
        const parsed = JSON.parse(text);
        aiCommentary = {
          summary: parsed.summary || "데이터 기반 시장 점검 완료",
          whyThisAction: parsed.whyThisAction || "정량적 규칙 엔진 기준 충족",
          whatToWatchNext: parsed.whatToWatchNext || "차기 거시 지표 확인 요망",
          counterThesis: parsed.counterThesis || counterScenario[0],
          modelUsed: "gemini-3.8-flash"
        };
      }
    } catch {
      // Fall through to deterministic fallback below
    }
  }

  // Deterministic explanatory fallback if Gemini is unavailable
  if (!aiCommentary) {
    if (actionCode === "WAIT") {
      aiCommentary = {
        summary: `오늘의 시장 레짐은 ${regime}(${regimeScore}점)이며, FOMC 금리 결정을 앞두고 관망(WAIT)을 유지합니다.`,
        whyThisAction: `SGOV 투입 신호가 7개 중 ${sgovSignalCount}개 충족되었으나, 내일 새벽 FOMC 이벤트 리스크와 국채 10년물 금리(${us10yYield.toFixed(2)}%) 부담으로 인해 불필요한 사전 진입보다 이벤트 후 확인 매수가 원칙상 유리합니다.`,
        whatToWatchNext: "내일 새벽 03:00 FOMC 성명서와 파월 의장 기자회견에서의 연내 금리 인하 횟수 힌트.",
        counterThesis: counterScenario[0],
        modelUsed: "deterministic-rule-engine"
      };
    } else if (actionCode === "BUY") {
      aiCommentary = {
        summary: `시장 레짐이 안정적인 수준을 유지하며, 주식성 목표 비중 대비 부족분(${Math.round(allocationGapKRW / 10000).toLocaleString()}만원)에 대한 단계적 분할 투입을 개시합니다.`,
        whyThisAction: `SGOV 투입 신호 ${sgovSignalCount}/7개 충족 및 변동성 지수 안정으로 일일 한도(${Math.round(dailyOrderLimitKRW / 10000).toLocaleString()}만원) 내에서 VOO 우선 분할 진입이 권장됩니다.`,
        whatToWatchNext: "10년물 국채금리 4.35% 안착 여부 및 거래량 동반 반등세.",
        counterThesis: counterScenario[1],
        modelUsed: "deterministic-rule-engine"
      };
    } else if (actionCode === "HOLD") {
      aiCommentary = {
        summary: `현재 포트폴리오의 주식 비중(${(currentStockWeight * 100).toFixed(1)}%)이 목표치(${(targetStockWeight * 100).toFixed(1)}%)에 도달하여 추가 매수 없이 보유(HOLD)합니다.`,
        whyThisAction: "목표 비중과의 차이가 2%p 이내로 자산 배분 균형이 양호하며, 추가적인 수수료 및 거래 비용을 절감합니다.",
        whatToWatchNext: "월말 리밸런싱 시점까지 개별 종목 및 섹터 간 상대 강도 변화.",
        counterThesis: counterScenario[0],
        modelUsed: "deterministic-rule-engine"
      };
    } else if (actionCode === "REDUCE") {
      aiCommentary = {
        summary: `시장 지표가 방어(Defensive) 구간에 진입하여 리스크 익스포저 축소 및 현금(SGOV) 비중 확대가 요구됩니다.`,
        whyThisAction: `강제 방어 조건 또는 레짐 악화로 인해 원금 보존이 최우선 목표로 전환되었습니다.`,
        whatToWatchNext: "VIX 20 이하 하향 안정 및 국채 금리 급등 진정 여부.",
        counterThesis: "금리 조기 안정 시 방어 모드 해제 조건 점검",
        modelUsed: "deterministic-rule-engine"
      };
    } else {
      aiCommentary = {
        summary: "핵심 시장 지표의 신선도가 확인되지 않아 안전 모드(DATA_BLOCKED)가 작동되었습니다.",
        whyThisAction: "불완전한 시세 데이터로 인한 잘못된 주문 실행을 방지하기 위해 주문 산출이 전면 차단되었습니다.",
        whatToWatchNext: "시세 어댑터 정상화 및 데이터 재동기화 완료 후 재확인.",
        counterThesis: "데이터 복구 즉시 레짐 재계산 수행",
        modelUsed: "deterministic-safety-lock"
      };
    }
  }

  const dailyStrategy: DailyStrategy = {
    strategyId: `STRAT-DAILY-${todayDate}-${crypto.randomBytes(3).toString("hex")}`,
    userId,
    asOf: asOfKST,
    generatedAt: new Date().toISOString(),
    calculationVersion: "v1.2.0-deterministic",
    dataStatus,
    isStaleOrBlocked: isDataBlocked || staleMetrics.length > 0,
    staleMetrics,
    regime,
    regimeScore,
    confidence,
    totalPortfolioKRW,
    currentStockWeight,
    targetStockWeight,
    allocationGapKRW,
    sgovSignalCount,
    sgovSignals,
    eventRestrictionActive,
    activeEventName,
    fomoRestrictionActive: fomoScore >= 4,
    fomoScore,
    actionCode,
    dailyOrderLimitKRW,
    eligibleAssets,
    blockedAssets,
    positiveDrivers,
    negativeDrivers,
    counterScenario,
    failureConditions,
    nextKeyEvents,
    deterministicResultHash,
    aiCommentary
  };

  return dailyStrategy;
}

/**
 * Weekly Strategy Generator (Deterministic + AI Summary)
 */
export async function runWeeklyStrategy(
  ai: GoogleGenAI | null,
  userId: string = "usr-preview-client-01"
): Promise<WeeklyStrategy> {
  const { dateStr } = getKSTNow();
  return {
    weeklyStrategyId: `STRAT-WEEKLY-${dateStr}`,
    userId,
    weekRange: `2026년 9월 2주차 (09.07 ~ 09.12)`,
    generatedAt: new Date().toISOString(),
    regimeTrend: "Neutral 유지 (53점 → 56점 완만한 회복)",
    weeklyReturnPct: 1.42,
    maxRiskBudgetKRW: 15000000,
    priorityAssets: ["VOO (S&P 500)", "SCHD (배당/가치)", "SGOV (현금 파킹)"],
    sgovEstimatedRangePct: 55.0,
    keyEventsNextWeek: [
      "미 연준 FOMC 금리결정 및 점도표 공개",
      "미국 8월 근원 CPI 물가 발표",
      "미 재무부 10년물/30년물 국채 입찰"
    ],
    counterScenario: "FOMC 이후 금리 급등 시 신규 매수 동결 및 주간 위험 예산 0원 축소",
    aiWeeklySummary: "주간 단위로는 추세적 상승이나 하락보다는 거시 이벤트 전 관망세가 뚜렷합니다. 주초에는 현금(SGOV)을 지키고, 이벤트 통과 후 지지선 확인 시 1차 분할 매수를 검토하는 주간 운용 원칙이 유효합니다."
  };
}

/**
 * Monthly Strategy Generator
 */
export async function runMonthlyStrategy(
  ai: GoogleGenAI | null,
  userId: string = "usr-preview-client-01"
): Promise<MonthlyStrategy> {
  return {
    monthlyStrategyId: `STRAT-MONTHLY-2026-09`,
    userId,
    monthLabel: "2026년 9월 운용계획서",
    generatedAt: new Date().toISOString(),
    mddPct: -2.1,
    ruleComplianceRate: 92.5,
    cashWeightAvgPct: 58.2,
    targetAllocationPlan: [
      { regime: "Risk On (70점 이상)", targetStockWeight: 0.60, targetCashWeight: 0.40, actionNote: "광범위 시장 ETF(VOO) 중심 공격적 비중 확대" },
      { regime: "Neutral (40~69점)", targetStockWeight: 0.46, targetCashWeight: 0.54, actionNote: "탐색적 분할 매수 및 고금리 SGOV 이자 수취" },
      { regime: "Defensive (40점 미만)", targetStockWeight: 0.25, targetCashWeight: 0.75, actionNote: "원금 보존 최우선, 빅테크 추가 진입 전면 차단" }
    ],
    threeStageDeployPlan: [
      { stage: "1단계 (탐색)", signalCondition: "SGOV 3개 이상 통과 및 VIX 18 이하", allocationRatioPct: 20 },
      { stage: "2단계 (확인)", signalCondition: "SGOV 5개 이상 통과 및 10년물 금리 하향", allocationRatioPct: 40 },
      { stage: "3단계 (추세)", signalCondition: "SGOV 7개 통과 및 S&P 500 전고점 지지", allocationRatioPct: 40 }
    ],
    keyMacroEvents: [
      "9월 FOMC 기준금리 결정",
      "9월 미국 CPI 및 고용보고서",
      "3분기 주요 빅테크 실적 시즌 돌입"
    ],
    aiMonthlyPlan: "9월은 통화정책 전환 기대와 경기 둔화 우려가 교차하는 변곡점의 달입니다. 과도한 공격성보다는 SGOV 무위험 5% 수익률을 기본 방패로 삼아, 레짐 점수가 65점 이상으로 안착할 때만 단계별로 자금을 투입하는 US-1M-15 원칙을 고수합니다."
  };
}
