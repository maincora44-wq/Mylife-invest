import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { 
  DailyStrategy, 
  WeeklyStrategy, 
  MonthlyStrategy, 
  StrategyNotification, 
  StrategyEvaluation 
} from "../types/strategy";

const BASE_DATA_DIR = path.join(process.cwd(), ".data", "strategies");

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Already exists
  }
}

async function atomicWriteJson(filePath: string, data: any): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmpPath = `${filePath}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readJsonOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export class StrategyStorage {
  private userDir: string;
  private userId: string;

  constructor(userId: string = "usr-preview-client-01") {
    this.userId = userId;
    const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    this.userDir = path.join(BASE_DATA_DIR, safeUid);
  }

  async getDailyStrategies(): Promise<DailyStrategy[]> {
    return readJsonOrDefault<DailyStrategy[]>(path.join(this.userDir, "dailyStrategies.json"), []);
  }

  async getLatestDailyStrategy(): Promise<DailyStrategy | null> {
    const list = await this.getDailyStrategies();
    return list.length > 0 ? list[0] : null;
  }

  async saveDailyStrategy(strategy: DailyStrategy): Promise<StrategyNotification[]> {
    const list = await this.getDailyStrategies();
    const previous = list.length > 0 ? list[0] : null;

    // Filter out if same strategyId
    const filtered = list.filter(s => s.strategyId !== strategy.strategyId);
    filtered.unshift(strategy);
    // Keep last 60 daily records
    await atomicWriteJson(path.join(this.userDir, "dailyStrategies.json"), filtered.slice(0, 60));

    // Detect significant strategy changes and generate notifications
    const newNotifications = this.detectStrategyChanges(previous, strategy);
    if (newNotifications.length > 0) {
      const existing = await this.getNotifications();
      const updated = [...newNotifications, ...existing].slice(0, 100);
      await atomicWriteJson(path.join(this.userDir, "notifications.json"), updated);
    }

    return newNotifications;
  }

  async getWeeklyStrategies(): Promise<WeeklyStrategy[]> {
    return readJsonOrDefault<WeeklyStrategy[]>(path.join(this.userDir, "weeklyStrategies.json"), []);
  }

  async getLatestWeeklyStrategy(): Promise<WeeklyStrategy | null> {
    const list = await this.getWeeklyStrategies();
    return list.length > 0 ? list[0] : null;
  }

  async saveWeeklyStrategy(strategy: WeeklyStrategy): Promise<void> {
    const list = await this.getWeeklyStrategies();
    const filtered = list.filter(w => w.weeklyStrategyId !== strategy.weeklyStrategyId);
    filtered.unshift(strategy);
    await atomicWriteJson(path.join(this.userDir, "weeklyStrategies.json"), filtered.slice(0, 24));
  }

  async getMonthlyStrategies(): Promise<MonthlyStrategy[]> {
    return readJsonOrDefault<MonthlyStrategy[]>(path.join(this.userDir, "monthlyStrategies.json"), []);
  }

  async getLatestMonthlyStrategy(): Promise<MonthlyStrategy | null> {
    const list = await this.getMonthlyStrategies();
    return list.length > 0 ? list[0] : null;
  }

  async saveMonthlyStrategy(strategy: MonthlyStrategy): Promise<void> {
    const list = await this.getMonthlyStrategies();
    const filtered = list.filter(m => m.monthlyStrategyId !== strategy.monthlyStrategyId);
    filtered.unshift(strategy);
    await atomicWriteJson(path.join(this.userDir, "monthlyStrategies.json"), filtered.slice(0, 12));
  }

  async getNotifications(): Promise<StrategyNotification[]> {
    return readJsonOrDefault<StrategyNotification[]>(path.join(this.userDir, "notifications.json"), []);
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const list = await this.getNotifications();
    let found = false;
    for (const n of list) {
      if (n.id === id) {
        n.read = true;
        found = true;
      }
    }
    if (found) {
      await atomicWriteJson(path.join(this.userDir, "notifications.json"), list);
    }
    return found;
  }

  async markAllNotificationsRead(): Promise<void> {
    const list = await this.getNotifications();
    for (const n of list) {
      n.read = true;
    }
    await atomicWriteJson(path.join(this.userDir, "notifications.json"), list);
  }

  /**
   * Only generates notifications for significant state transitions to prevent spam:
   * 1. Regime change
   * 2. ActionCode change
   * 3. Order limit change
   * 4. Forced defensive conditions
   * 5. Event lock engagement
   * 6. Data block/unblock
   */
  private detectStrategyChanges(prev: DailyStrategy | null, curr: DailyStrategy): StrategyNotification[] {
    const notifications: StrategyNotification[] = [];
    const now = new Date().toISOString();

    if (!prev) {
      notifications.push({
        id: `NOTIF-${Date.now()}-INIT`,
        userId: this.userId,
        title: `일일 전략 가동 (${curr.actionCode})`,
        message: `초기 시장 레짐: ${curr.regime} (${curr.regimeScore ?? "-"}점), 오늘 허용 주문금액: ${(curr.dailyOrderLimitKRW / 10000).toLocaleString()}만원`,
        timestamp: now,
        type: "ACTION_CHANGE",
        read: false,
        newAction: curr.actionCode,
        impactLevel: "INFO"
      });
      return notifications;
    }

    // 1. Data Blocked Alert
    if (curr.actionCode === "DATA_BLOCKED" && prev.actionCode !== "DATA_BLOCKED") {
      notifications.push({
        id: `NOTIF-${Date.now()}-DATA_BLOCK`,
        userId: this.userId,
        title: "시장 데이터 지연 경보 (주문 산출 차단)",
        message: `핵심 데이터(${curr.staleMetrics.join(", ") || "일부 지표"})의 신선도 미달로 주문 가능액 계산이 안전 차단(WAIT)되었습니다.`,
        timestamp: now,
        type: "DATA_ALERT",
        read: false,
        previousAction: prev.actionCode,
        newAction: "DATA_BLOCKED",
        impactLevel: "HIGH"
      });
    }

    // 2. Action Code Change
    if (curr.actionCode !== prev.actionCode && curr.actionCode !== "DATA_BLOCKED") {
      const isPositive = curr.actionCode === "BUY";
      notifications.push({
        id: `NOTIF-${Date.now()}-ACTION_CHANGE`,
        userId: this.userId,
        title: `행동 지침 변경: ${prev.actionCode} → ${curr.actionCode}`,
        message: `이전: ${prev.actionCode} (${(prev.dailyOrderLimitKRW / 10000).toLocaleString()}만원) → 현재: ${curr.actionCode} (${(curr.dailyOrderLimitKRW / 10000).toLocaleString()}만원)`,
        timestamp: now,
        type: "ACTION_CHANGE",
        read: false,
        previousAction: prev.actionCode,
        newAction: curr.actionCode,
        impactLevel: isPositive ? "MEDIUM" : "HIGH"
      });
    }

    // 3. Regime Change
    if (curr.regime !== prev.regime) {
      notifications.push({
        id: `NOTIF-${Date.now()}-REGIME_CHANGE`,
        userId: this.userId,
        title: `거시 레짐 전환: ${prev.regime} → ${curr.regime}`,
        message: `레짐 점수 ${prev.regimeScore ?? "-"}점 → ${curr.regimeScore ?? "-"}점으로 변동되었습니다. (신뢰도: ${Math.round(curr.confidence * 100)}%)`,
        timestamp: now,
        type: "REGIME_CHANGE",
        read: false,
        impactLevel: curr.regime === "Defensive" ? "HIGH" : "MEDIUM"
      });
    }

    // 4. Defensive Alert
    if (curr.regime === "Defensive" && prev.regime !== "Defensive") {
      notifications.push({
        id: `NOTIF-${Date.now()}-DEFENSIVE`,
        userId: this.userId,
        title: "강제 방어 레짐(Defensive) 발동 경보",
        message: "미국 국채 10년물 부담, 유가 또는 VIX 변동성 확대로 신규 진입이 전면 억제되고 현금 방어 모드로 전환되었습니다.",
        timestamp: now,
        type: "DEFENSIVE_ALERT",
        read: false,
        impactLevel: "HIGH"
      });
    }

    // 5. Event Lock Activation
    if (curr.eventRestrictionActive && !prev.eventRestrictionActive) {
      notifications.push({
        id: `NOTIF-${Date.now()}-EVENT_LOCK`,
        userId: this.userId,
        title: `거시 이벤트 냉각 잠금 시작 (${curr.activeEventName ?? "주요 이벤트"})`,
        message: "주요 경제지표(FOMC/CPI) 발표 전 변동성 관리를 위해 오늘 1회 허용 주문금액이 최대 25%로 축소 제한됩니다.",
        timestamp: now,
        type: "EVENT_LOCK",
        read: false,
        impactLevel: "MEDIUM"
      });
    }

    return notifications;
  }
}

export function getStrategyStorage(userId: string = "usr-preview-client-01"): StrategyStorage {
  return new StrategyStorage(userId);
}
