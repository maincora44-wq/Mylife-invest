import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface AccountRecord {
  accountId: string;
  accountAlias: string;
  institution: string;
  accountType: string;
  accountFingerprint: string;
  currentSnapshotId: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface PortfolioSnapshot {
  snapshotId: string;
  accountId: string;
  approvedAt: string;
  asOfDate: string;
  captureDate: string | null;
  brokerName: string;
  accountType: string;
  detectedAccountIdMasked: string | null;
  totalAssetAmount: number;
  cashBalance: number;
  holdingsCount: number;
  dataStatus: "CONFIRMED" | "PROVISIONAL";
  holdings: Array<{
    name: string;
    ticker: string | null;
    quantity: number;
    evalAmount: number;
    costAmount: number;
    pnlAmount: number;
    pnlRate: number;
    isPartial: boolean;
    confidence: number;
    isCash?: boolean;
  }>;
}

export interface ImportJobRecord {
  importJobId: string;
  userId: string;
  createdAt: string;
  status: "PROVISIONAL" | "APPROVED" | "REJECTED";
  dataMode: "LIVE" | "DEMO";
  imageSha256?: string;
  accountFingerprint: string;
  reviewedData: {
    brokerName: string;
    accountType: string;
    captureDate?: string | null;
    currency: "KRW" | "USD";
    totalAssetAmount: number | null;
    cashBalance: number;
    cashIncludedInHoldings: boolean;
    isAggregatorScreen: boolean;
    detectedAccountIdMasked: string | null;
    holdings: Array<{
      name: string;
      ticker: string | null;
      quantity: number;
      evalAmount: number;
      costAmount: number;
      pnlAmount: number;
      pnlRate: number;
      isPartial: boolean;
      confidence: number;
      isCash?: boolean;
    }>;
  };
  reconciliation: {
    discrepancyPass: boolean;
    discrepancy: number;
    allowedTolerance: number;
    calculatedTotal: number;
    stockSum: number;
    effectiveCash: number;
    hasPartialItems: boolean;
    requiresManualReview: boolean;
    auditNotes: string[];
  };
  classification: "NEW_ACCOUNT" | "UPDATE_EXISTING" | "DUPLICATE_IMAGE" | "AGGREGATOR_OVERLAP" | "REVIEW_REQUIRED";
  duplicationWarning?: {
    isDuplicate: boolean;
    duplicateType: "SAME_ACCOUNT_RESNAPSHOT" | "AGGREGATOR_DOUBLE_COUNT" | "NONE";
    existingAccountName?: string;
    actionAdvice: string;
  };
}

export interface AuditLogEntry {
  auditId: string;
  timestamp: string;
  action: string;
  userId: string;
  details: Record<string, any>;
}

const DATA_ROOT = path.join(process.cwd(), ".data");

async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
  }
}

async function atomicWriteJson(filePath: string, data: any) {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function readJsonOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export class PersistentUserStore {
  private uid: string;
  private userDir: string;

  constructor(uid: string) {
    this.uid = uid;
    this.userDir = path.join(DATA_ROOT, "users", uid);
  }

  static generateAccountFingerprint(institution: string, accountType: string, maskedSuffix: string, userId: string): string {
    return crypto
      .createHmac("sha256", "investment-os-salt-v1")
      .update(`${institution}|${accountType}|${maskedSuffix}|${userId}`)
      .digest("hex")
      .slice(0, 16);
  }

  async initStore() {
    await ensureDir(this.userDir);
    // Seed initial account & snapshot if empty
    const snapshots = await this.getSnapshots();
    if (snapshots.length === 0) {
      const initialFp = PersistentUserStore.generateAccountFingerprint("삼성증권", "위탁", "102", this.uid);
      const initialSnapshot: PortfolioSnapshot = {
        snapshotId: "SNAP-SEED-01",
        accountId: "ACC-SEED-01",
        approvedAt: "2026-09-01T09:00:00Z",
        asOfDate: "2026-09-01",
        captureDate: "2026-09-01",
        brokerName: "삼성증권",
        accountType: "위탁",
        detectedAccountIdMasked: "284-****-102",
        totalAssetAmount: 236000000,
        cashBalance: 15000000,
        holdingsCount: 3,
        dataStatus: "CONFIRMED",
        holdings: [
          { name: "Alphabet Inc Class A", ticker: "GOOGL", quantity: 180, evalAmount: 49455000, costAmount: 38000000, pnlAmount: 11455000, pnlRate: 0.301, isPartial: false, confidence: 0.98 },
          { name: "Invesco QQQ Trust", ticker: "QQQ", quantity: 110, evalAmount: 76005000, costAmount: 68000000, pnlAmount: 8005000, pnlRate: 0.117, isPartial: false, confidence: 0.99 },
          { name: "Vanguard S&P 500 ETF", ticker: "VOO", quantity: 110, evalAmount: 95540000, costAmount: 88000000, pnlAmount: 7540000, pnlRate: 0.085, isPartial: false, confidence: 0.99 },
          { name: "원화 예수금", ticker: null, quantity: 1, evalAmount: 15000000, costAmount: 15000000, pnlAmount: 0, pnlRate: 0, isPartial: false, confidence: 1.0, isCash: true }
        ]
      };
      await this.saveSnapshot(initialSnapshot);

      const accounts: Record<string, AccountRecord> = {
        "ACC-SEED-01": {
          accountId: "ACC-SEED-01",
          accountAlias: "삼성증권 284-****-102",
          institution: "삼성증권",
          accountType: "위탁",
          accountFingerprint: initialFp,
          currentSnapshotId: "SNAP-SEED-01",
          isActive: true,
          updatedAt: "2026-09-01T09:00:00Z"
        }
      };
      await atomicWriteJson(path.join(this.userDir, "accounts.json"), accounts);
    }
  }

  async getAccounts(): Promise<Record<string, AccountRecord>> {
    return readJsonOrDefault<Record<string, AccountRecord>>(path.join(this.userDir, "accounts.json"), {});
  }

  async saveAccounts(accounts: Record<string, AccountRecord>): Promise<void> {
    await atomicWriteJson(path.join(this.userDir, "accounts.json"), accounts);
  }

  async getSnapshots(): Promise<PortfolioSnapshot[]> {
    return readJsonOrDefault<PortfolioSnapshot[]>(path.join(this.userDir, "portfolioSnapshots.json"), []);
  }

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    const list = await this.getSnapshots();
    const filtered = list.filter(s => s.snapshotId !== snapshot.snapshotId);
    filtered.unshift(snapshot);
    await atomicWriteJson(path.join(this.userDir, "portfolioSnapshots.json"), filtered);
  }

  async getImportJobs(): Promise<Record<string, ImportJobRecord>> {
    return readJsonOrDefault<Record<string, ImportJobRecord>>(path.join(this.userDir, "importJobs.json"), {});
  }

  async getImportJob(jobId: string): Promise<ImportJobRecord | null> {
    const jobs = await this.getImportJobs();
    return jobs[jobId] || null;
  }

  async saveImportJob(job: ImportJobRecord): Promise<void> {
    const jobs = await this.getImportJobs();
    jobs[job.importJobId] = job;
    await atomicWriteJson(path.join(this.userDir, "importJobs.json"), jobs);
  }

  async getInvestmentState(): Promise<any> {
    return readJsonOrDefault<any>(path.join(this.userDir, "investmentState.json"), null);
  }

  async saveInvestmentState(state: any): Promise<void> {
    await atomicWriteJson(path.join(this.userDir, "investmentState.json"), state);
  }

  async logAudit(action: string, details: Record<string, any>): Promise<void> {
    const logs = await readJsonOrDefault<AuditLogEntry[]>(path.join(this.userDir, "auditLogs.json"), []);
    const entry: AuditLogEntry = {
      auditId: `AUDIT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      timestamp: new Date().toISOString(),
      action,
      userId: this.uid,
      details
    };
    logs.unshift(entry);
    await atomicWriteJson(path.join(this.userDir, "auditLogs.json"), logs.slice(0, 500));
  }

  async findDuplicateImage(sha256: string): Promise<ImportJobRecord | null> {
    const jobs = await this.getImportJobs();
    for (const job of Object.values(jobs)) {
      if (job.imageSha256 === sha256) {
        return job;
      }
    }
    return null;
  }

  async findAccountByFingerprint(fingerprint: string): Promise<AccountRecord | null> {
    const accounts = await this.getAccounts();
    for (const acc of Object.values(accounts)) {
      if (acc.accountFingerprint === fingerprint && acc.isActive) {
        return acc;
      }
    }
    return null;
  }
}
