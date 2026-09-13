export type ActionCode = "BUY" | "HOLD" | "WAIT" | "REDUCE" | "DATA_BLOCKED";

export type DataFreshnessStatus = 
  | "CONFIRMED" 
  | "PROVISIONAL" 
  | "STALE" 
  | "UNAVAILABLE" 
  | "CONFLICT" 
  | "DEMO";

export interface SgovSignalItemDetailed {
  signalId: string;
  name: string;
  passed: boolean;
  currentValue: number | null;
  threshold: number | string;
  observedAt: string | null;
  status: "CONFIRMED" | "STALE" | "UNAVAILABLE";
  rationale: string;
}

export interface DailyStrategy {
  strategyId: string;
  userId: string;
  asOf: string; // KST ISO 8601 string e.g. 2026-09-12T07:30:00+09:00
  generatedAt: string;
  calculationVersion: string; // e.g. "v1.2.0-deterministic"

  // 1. Data Freshness & Pipeline Status
  dataStatus: DataFreshnessStatus;
  isStaleOrBlocked: boolean;
  staleMetrics: string[];

  // 2. Deterministic Regime Calculations
  regime: "Risk On" | "Neutral" | "Defensive" | "Unavailable";
  regimeScore: number | null; // 0 ~ 100
  confidence: number; // 0.0 ~ 1.0

  // 3. Portfolio Allocation State
  totalPortfolioKRW: number;
  currentStockWeight: number; // e.g. 0.384
  targetStockWeight: number; // e.g. 0.460
  allocationGapKRW: number; // Positive = shortage, Negative = overweight

  // 4. Risk Factors & Signal Constraints
  sgovSignalCount: number; // 0 ~ 7
  sgovSignals: SgovSignalItemDetailed[];
  eventRestrictionActive: boolean;
  activeEventName: string | null;
  fomoRestrictionActive: boolean;
  fomoScore: number;

  // 5. Final Deterministic Action Guidelines
  actionCode: ActionCode;
  dailyOrderLimitKRW: number; // Allowed order amount in KRW (0 if WAIT/DATA_BLOCKED)
  eligibleAssets: string[]; // Order of allocation priority
  blockedAssets: string[]; // Forbidden purchases (e.g. KT&G, QQQ overlap)

  // 6. Drivers, Counter-Scenarios & Invalidation
  positiveDrivers: string[];
  negativeDrivers: string[];
  counterScenario: string[];
  failureConditions: string[]; // Specific conditions that invalidate the thesis
  nextKeyEvents: string[];

  // 7. Verification Hash & AI Explanatory Layer
  deterministicResultHash: string; // SHA-256 for result immutability
  aiCommentary: {
    summary: string;
    whyThisAction: string;
    whatToWatchNext: string;
    counterThesis: string;
    modelUsed: string;
  } | null;
}

export interface WeeklyStrategy {
  weeklyStrategyId: string;
  userId: string;
  weekRange: string; // e.g. "2026-W37 (09.07 ~ 09.12)"
  generatedAt: string;
  regimeTrend: string;
  weeklyReturnPct: number;
  maxRiskBudgetKRW: number;
  priorityAssets: string[];
  sgovEstimatedRangePct: number;
  keyEventsNextWeek: string[];
  counterScenario: string;
  aiWeeklySummary: string;
}

export interface MonthlyStrategy {
  monthlyStrategyId: string;
  userId: string;
  monthLabel: string; // e.g. "2026년 9월 운용계획"
  generatedAt: string;
  mddPct: number;
  ruleComplianceRate: number;
  cashWeightAvgPct: number;
  targetAllocationPlan: Array<{
    regime: string;
    targetStockWeight: number;
    targetCashWeight: number;
    actionNote: string;
  }>;
  threeStageDeployPlan: Array<{
    stage: string;
    signalCondition: string;
    allocationRatioPct: number;
  }>;
  keyMacroEvents: string[];
  aiMonthlyPlan: string;
}

export interface StrategyNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  type: 
    | "REGIME_CHANGE" 
    | "ACTION_CHANGE" 
    | "LIMIT_CHANGE" 
    | "DEFENSIVE_ALERT" 
    | "EVENT_LOCK" 
    | "DATA_ALERT"
    | "TECH_CLUSTER_ALERT";
  read: boolean;
  previousAction?: ActionCode;
  newAction?: ActionCode;
  impactLevel: "HIGH" | "MEDIUM" | "INFO";
}

export interface StrategyEvaluation {
  strategyId: string;
  evaluationDate: string;
  decisionQualityScore: number; // 0 ~ 100
  ruleCompliancePassed: boolean;
  marketOutcome: "GAIN" | "FLAT" | "LOSS";
  evaluationNotes: string;
}
