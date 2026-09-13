import { GoogleGenAI } from "@google/genai";
import { runDeterministicDailyStrategy, runWeeklyStrategy, runMonthlyStrategy } from "./strategyEngine";
import { getStrategyStorage } from "./strategyStorage";

export interface SchedulerStatus {
  isRunning: boolean;
  kstTime: string;
  isUsDaylightSaving: boolean;
  marketOpenKST: string;
  preMarketCheckKST: string;
  postMarketCheckKST: string;
  lastDailyRunKST: string | null;
  lastWeeklyRunKST: string | null;
  lastMonthlyRunKST: string | null;
  nextScheduledSlot: string;
}

class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private ai: GoogleGenAI | null = null;
  private isRunning: boolean = false;
  private executedSlots: Set<string> = new Set();
  private lastDailyRunKST: string | null = null;
  private lastWeeklyRunKST: string | null = null;
  private lastMonthlyRunKST: string | null = null;

  setAIClient(ai: GoogleGenAI | null) {
    this.ai = ai;
  }

  /**
   * Checks if US is currently in Daylight Saving Time (EDT vs EST)
   */
  isUSDaylightSaving(): boolean {
    try {
      const nyDateStr = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "short"
      }).format(new Date());
      return nyDateStr.includes("EDT");
    } catch {
      return true; // Safe default for summer/autumn
    }
  }

  getKSTDetails(): {
    dateStr: string;
    hours: number;
    minutes: number;
    dayOfWeek: number; // 0 = Sun, 6 = Sat
    dayOfMonth: number;
    formatted: string;
  } {
    const now = new Date();
    const kstOffsetMs = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffsetMs);
    const dateStr = kst.toISOString().split("T")[0];
    const hours = kst.getUTCHours();
    const minutes = kst.getUTCMinutes();
    const dayOfWeek = kst.getUTCDay();
    const dayOfMonth = kst.getUTCDate();
    const formatted = `${dateStr} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} KST`;
    return { dateStr, hours, minutes, dayOfWeek, dayOfMonth, formatted };
  }

  getStatus(): SchedulerStatus {
    const isDst = this.isUSDaylightSaving();
    const kst = this.getKSTDetails();

    return {
      isRunning: this.isRunning,
      kstTime: kst.formatted,
      isUsDaylightSaving: isDst,
      marketOpenKST: isDst ? "22:30 KST" : "23:30 KST",
      preMarketCheckKST: isDst ? "21:30 KST" : "22:30 KST",
      postMarketCheckKST: "07:30 KST",
      lastDailyRunKST: this.lastDailyRunKST,
      lastWeeklyRunKST: this.lastWeeklyRunKST,
      lastMonthlyRunKST: this.lastMonthlyRunKST,
      nextScheduledSlot: isDst 
        ? "매일 07:30 KST (정규 DAILY CHECK) & 21:30 KST (개장 전 점검)" 
        : "매일 07:30 KST (정규 DAILY CHECK) & 22:30 KST (개장 전 점검)"
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Scheduler] Investment OS Daily Check Scheduler started.");

    // Initial check right after start
    this.triggerDailyCheck("SYSTEM_BOOT").catch(err => console.warn("[Scheduler] Initial run err:", err));

    // Tick every 60 seconds
    this.timer = setInterval(() => {
      this.tick();
    }, 60 * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[Scheduler] Scheduler stopped.");
  }

  private tick() {
    const kst = this.getKSTDetails();
    const isDst = this.isUSDaylightSaving();
    const preMarketHour = isDst ? 21 : 22;

    // 1. Post-Market Morning Check: 07:30 KST (Daily)
    if (kst.hours === 7 && kst.minutes === 30) {
      const slotId = `DAILY-0730-${kst.dateStr}`;
      if (!this.executedSlots.has(slotId)) {
        this.executedSlots.add(slotId);
        this.triggerDailyCheck("SCHEDULED_MORNING_0730");
      }
    }

    // 2. Pre-Market Evening Check: 21:30 (EDT) or 22:30 (EST) (Mon-Fri)
    if (kst.dayOfWeek >= 1 && kst.dayOfWeek <= 5 && kst.hours === preMarketHour && kst.minutes === 30) {
      const slotId = `PREMARKET-${preMarketHour}30-${kst.dateStr}`;
      if (!this.executedSlots.has(slotId)) {
        this.executedSlots.add(slotId);
        this.triggerDailyCheck("SCHEDULED_PREMARKET");
      }
    }

    // 3. Weekly Review: Saturday 09:00 KST
    if (kst.dayOfWeek === 6 && kst.hours === 9 && kst.minutes === 0) {
      const slotId = `WEEKLY-${kst.dateStr}`;
      if (!this.executedSlots.has(slotId)) {
        this.executedSlots.add(slotId);
        this.triggerWeeklyReview("SCHEDULED_SATURDAY_0900");
      }
    }

    // 4. Monthly Review: 1st of month 09:00 KST
    if (kst.dayOfMonth === 1 && kst.hours === 9 && kst.minutes === 0) {
      const slotId = `MONTHLY-${kst.dateStr}`;
      if (!this.executedSlots.has(slotId)) {
        this.executedSlots.add(slotId);
        this.triggerMonthlyReview("SCHEDULED_MONTH_1ST");
      }
    }
  }

  async triggerDailyCheck(reason: string = "MANUAL"): Promise<any> {
    const kst = this.getKSTDetails();
    console.log(`[Scheduler] Executing Daily Check (${reason}) at ${kst.formatted}`);
    
    try {
      const strategy = await runDeterministicDailyStrategy(this.ai, {
        userId: "usr-preview-client-01"
      });

      const storage = getStrategyStorage("usr-preview-client-01");
      const newNotifications = await storage.saveDailyStrategy(strategy);
      
      this.lastDailyRunKST = kst.formatted;
      console.log(`[Scheduler] Daily Strategy saved: action=${strategy.actionCode}, limit=${strategy.dailyOrderLimitKRW}, notifications=${newNotifications.length}`);
      
      return strategy;
    } catch (err: any) {
      console.error("[Scheduler] Error in triggerDailyCheck:", err?.message || err);
      throw err;
    }
  }

  async triggerWeeklyReview(reason: string = "MANUAL"): Promise<any> {
    const kst = this.getKSTDetails();
    console.log(`[Scheduler] Executing Weekly Review (${reason}) at ${kst.formatted}`);
    try {
      const weekly = await runWeeklyStrategy(this.ai, "usr-preview-client-01");
      const storage = getStrategyStorage("usr-preview-client-01");
      await storage.saveWeeklyStrategy(weekly);
      this.lastWeeklyRunKST = kst.formatted;
      return weekly;
    } catch (err: any) {
      console.error("[Scheduler] Error in triggerWeeklyReview:", err);
      throw err;
    }
  }

  async triggerMonthlyReview(reason: string = "MANUAL"): Promise<any> {
    const kst = this.getKSTDetails();
    console.log(`[Scheduler] Executing Monthly Review (${reason}) at ${kst.formatted}`);
    try {
      const monthly = await runMonthlyStrategy(this.ai, "usr-preview-client-01");
      const storage = getStrategyStorage("usr-preview-client-01");
      await storage.saveMonthlyStrategy(monthly);
      this.lastMonthlyRunKST = kst.formatted;
      return monthly;
    } catch (err: any) {
      console.error("[Scheduler] Error in triggerMonthlyReview:", err);
      throw err;
    }
  }
}

export const schedulerService = new SchedulerService();
