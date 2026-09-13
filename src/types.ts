export type RegimeType = "Risk On" | "Neutral" | "Defensive";
export type ActionType = "BUY" | "HOLD" | "WAIT" | "REDUCE";
export type GatekeeperVerdict = "APPROVE" | "APPROVE 50%" | "WAIT" | "REJECT" | "REVIEW TOMORROW";

export interface PortfolioHolding {
  holdingId: string;
  asOfDate: string;
  account: string;
  accountType: "위탁" | "연금저축" | "IRP" | "ISA";
  ticker: string;
  assetName: string;
  quantity: number;
  price: number;
  currency: "KRW" | "USD";
  fxRate: number;
  marketValueKRW: number;
  costKRW: number;
  assetClass: "주식" | "채권·현금" | "금" | "제한자산";
  sector: string;
  riskBucket: "GOOG 직접/간접" | "Nasdaq100" | "반도체" | "AI·성장" | "광범위 미국주식" | "금" | "KT&G 제한" | "현금성·SGOV";
  tradable: boolean;
  restricted: boolean;
  taxConstraint: string;
  lookThroughUnderlying?: {
    googExposurePct?: number;
    semisExposurePct?: number;
    notes?: string;
  };
}

export interface MarketIndicator {
  symbol: string;
  metric: string;
  value: string | number;
  unit?: string;
  change: string;
  status: "green" | "yellow" | "red";
  description: string;
  category: "trend" | "rate_oil" | "vol_credit" | "liquidity" | "breadth";
}

export interface RegimeFactorScore {
  name: string;
  score: number;
  maxScore: number;
  status: "green" | "yellow" | "red";
  drivers: string;
  dragReason?: string;
}

export interface RegimeState {
  asOf: string;
  regime: RegimeType;
  regimeScore: number;
  confidence: number;
  currentStockWeight: number; // e.g. 0.384
  targetStockWeight: number; // e.g. 0.460
  shortageWeightPct: number; // e.g. 7.6%p
  deployableAmountKRW: number; // 30,950,000
  dailyMaxOrderKRW: number; // 5,000,000
  action: ActionType;
  nextEvent: string;
  daysToEvent: number;
  reasonsWhyScoreChanged: string[];
  biggestDragFactor: string;
  whatNeededForRiskOn: string;
  failureConditionDefensive: string;
}

export interface SgovSignalItem {
  id: number;
  name: string;
  detail: string;
  threshold: string;
  currentVal: string;
  passed: boolean;
  explanation: string;
}

export interface SgovDeploymentPlan {
  satisfiedCount: number;
  totalSignals: number;
  recommendedStage: "관망 (0%)" | "1차 탐색 (40%)" | "2차 분할 (70%)" | "전액 투입 (100%)";
  allowedRatePct: number;
  todayLimitKRW: number;
  priorities: Array<{
    rank: number;
    asset: string;
    description: string;
    rationale: string;
  }>;
}

export interface TradeGatekeeperRequest {
  tradeId?: string;
  requestedAt?: string;
  account: string;
  ticker: string;
  side: "BUY" | "SELL";
  proposedAmountKRW: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  thesis: string;
  counterThesis: string;
  eventType: string;
  riskBucket: string;
  plannedLossKRW: number;
  fomoScore: number;
  checks: Array<{
    title: string;
    passed: boolean;
    warning?: boolean;
    reason: string;
  }>;
  verdict: GatekeeperVerdict;
  allowedAmountKRW: number;
  adjustmentNote: string;
  alternativeSuggestion: string;
}

export interface DecisionJournalEntry {
  journalId: string;
  tradeId: string;
  decisionDate: string;
  ticker: string;
  side: "BUY" | "SELL";
  amountKRW: number;
  thesis: string;
  counterThesis: string;
  regimeAtTrade: string;
  dataBacking: string;
  invalidationCondition: string;
  plannedLossKRW: number;
  fomoScore: number;
  actualOutcome?: "이익 실현" | "원칙 손절" | "보유 중" | "조기 매도";
  decisionQuality: "탁월" | "적정" | "결과 편향 오류" | "원칙 위반";
  outcomeQuality: "수익" | "약손실" | "손실" | "진행중";
  ruleCompliant: boolean;
  errorType?: "없음 (우수)" | "레짐 판단 오류" | "포지션 크기 오류" | "진입 시점 오류" | "조기 매도" | "추격매수(FOMO)" | "이벤트 오판" | "정상적인 확률 손실";
  lessonLearned: string;
}

export interface MacroEvent {
  eventId: string;
  eventType: "FOMC" | "CPI" | "PCE" | "고용" | "실적" | "IPO";
  eventName: string;
  eventTimeKST: string;
  importance: "HIGH" | "MEDIUM" | "CRITICAL";
  isLocked: boolean;
  coolingPeriodMin: number;
  firstDayCapPct: number;
  highBetaRiskBudgetPct: number;
  baseScenario: string;
  bullScenario: string;
  bearScenario: string;
  allowedOrderKRW: number;
}

export interface IPOWatchItem {
  id: string;
  companyName: string;
  ticker: string;
  expectedDate: string;
  expectedValuation: string;
  revenueGrowth: string;
  grossMargin: string;
  fcfStatus: string;
  aiBucketOverlap: boolean;
  officialS1Confirmed: boolean;
  dayOneTradingBan: boolean;
  fiveDayObservationMet: boolean;
  initialMaxAllocationKRW: number;
  preEarningsMaxCapKRW: number;
  verdict: "관찰 대기" | "심사 통과" | "위험 한도 초과(금지)";
}

export interface TeamsAdaptiveCardNotification {
  id: string;
  time: string;
  category: "DAILY_CHECK" | "RISK_ALERT" | "FOMO_WARN" | "CASH_SURPLUS" | "MONTHLY_REVIEW";
  title: string;
  summary: string;
  details: string[];
  actions: string[];
  timestamp: string;
  read: boolean;
}

export type PlatformOptionId = "powerapps_sharepoint" | "powerapps_dataverse" | "pwa_react_fastapi" | "teams_bot";

export interface PlatformOption {
  id: PlatformOptionId;
  title: string;
  subtitle: string;
  stage: string;
  fit: string;
  pros: string[];
  cons: string[];
  techStack: string;
  recommendation: string;
}

// -------------------------------------------------------------
// Capture OCR & Baseline Verification Pipeline Types
// -------------------------------------------------------------

export interface ExtractedHoldingItem {
  name: string;
  ticker: string | null;
  quantity: number;
  evalAmount: number;
  costAmount: number;
  pnlAmount: number;
  pnlRate: number; // e.g. 0.052 for 5.2%
  isPartial: boolean;
  confidence: number; // 0.0 ~ 1.0
}

export interface CaptureExtractionResult {
  captureId: string;
  brokerName: string;
  accountType: "위탁" | "연금저축/IRP" | "ISA" | "CMA" | "해외주식" | "마이데이터_통합조회" | "기타";
  captureDate: string;
  currency: "KRW" | "USD";
  totalAssetAmount: number;
  cashBalance: number;
  isAggregatorScreen: boolean;
  detectedAccountIdMasked: string;
  holdings: ExtractedHoldingItem[];
  calculatedSumEval: number;
  discrepancy: number;
  discrepancyPass: boolean;
  requiresManualReview: boolean;
  auditNotes: string[];
  duplicationWarning?: {
    isDuplicate: boolean;
    duplicateType: "SAME_ACCOUNT_RESNAPSHOT" | "AGGREGATOR_DOUBLE_COUNT" | "NONE";
    existingAccountName?: string;
    actionAdvice: string;
  };
  isSimulated?: boolean;
}

export interface HistoricalSnapshot {
  snapshotId: string;
  approvedAt: string;
  asOfDate?: string;
  captureDate?: string | null;
  brokerName: string;
  accountType: string;
  detectedAccountIdMasked: string;
  totalAssetAmount: number;
  cashBalance: number;
  holdingsCount: number;
  holdings: ExtractedHoldingItem[];
}

// -------------------------------------------------------------
// Yahoo Finance Real-Time & Reliability Verification Types
// -------------------------------------------------------------

export interface YahooMarketQuote {
  symbol: string;
  name: string;
  regularMarketPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency: string;
  marketState?: string;
  timestamp: number;
  source: "YAHOO_FINANCE_OFFICIAL" | "FALLBACK_CACHE";
}

export interface ReliabilityTestCase {
  id: string;
  name: string;
  category: "CONNECTIVITY" | "SCHEMA_INTEGRITY" | "RANGE_SANITY" | "FALLBACK_RESILIENCE" | "PORTFOLIO_MATH";
  status: "PASSED" | "FAILED" | "WARNING";
  latencyMs: number;
  details: string;
  dataPoints?: Record<string, any>;
}

export interface ReliabilityTestSuiteResult {
  executedAt: string;
  overallStatus: "PASSED" | "FAILED" | "WARNING";
  scorePct: number; // 0 ~ 100
  totalDurationMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testCases: ReliabilityTestCase[];
  quotesSnapshot: Record<string, YahooMarketQuote>;
}

// -------------------------------------------------------------
// Technical Analysis & Regime Indicator Provider Types
// -------------------------------------------------------------

export interface TechnicalPricePoint {
  date: string;
  rawDate: string;
  price: number;
  volume: number;
  ma20: number;
  ma60: number;
  ma200: number;
  rsi5: number;
  rsi14?: number;
  bbUpper?: number;
  bbLower?: number;
}

export type TechnicalAlignmentType = "BULLISH_ORDER" | "BEARISH_ORDER" | "MIXED";
export type Rsi5ConditionType = "EXTREME_OVERSOLD" | "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT" | "EXTREME_OVERBOUGHT";

export interface TechnicalIndicatorSummary {
  ticker: string;
  name: string;
  currentPrice: number;
  ma20: number;
  ma60: number;
  ma200: number;
  rsi5: number;
  isAboveMa20: boolean;
  isAboveMa60: boolean;
  isAboveMa200: boolean;
  disparityMa200Pct: number;
  disparityMa20Pct: number;
  alignment: TechnicalAlignmentType;
  rsi5Status: Rsi5ConditionType;
  supportLevel: number;
  resistanceLevel: number;
}

export interface RegimeTechnicalSignal {
  ticker: string;
  scoreContribution: number; // -8 ~ +8 score adjustment for regime engine
  regimeContributionLabel: string;
  trendVerdict: string;
  verdictBadgeColor: string;
  verdictDescription: string;
  shortTermMomentum: string;
  tacticalAction: ActionType;
  gatekeeperEligibility: boolean;
  rationale: string;
  favorableForSgovDeployment: boolean;
}

export interface TechnicalAssetItem {
  ticker: string;
  name: string;
  market: string;
  basePrice: number;
  currency: string;
  isCustom?: boolean;
}

export interface ITechnicalDataProvider {
  getAvailableAssets(): TechnicalAssetItem[];
  calculateTechnicalSeries(ticker: string, timeframe: "1M" | "3M" | "6M" | "1Y"): TechnicalPricePoint[];
  getTechnicalSummary(ticker: string, timeframe?: "1M" | "3M" | "6M" | "1Y"): TechnicalIndicatorSummary;
  evaluateRegimeSignal(ticker: string): RegimeTechnicalSignal;
  getMarketAggregateTechnicalRegime(): {
    aggregateScoreContribution: number;
    regimeAdjustmentText: string;
    macroAlignment: string;
    assetSignals: Record<string, RegimeTechnicalSignal>;
  };
  addCustomAsset?(asset: {
    ticker: string;
    name: string;
    market?: "US_ETF" | "US_STOCK" | "MACRO_INDEX";
    basePrice?: number;
    currency?: "USD" | "PT" | "%";
    description?: string;
    sgovCompatibility?: "OPTIMAL" | "MODERATE" | "RESTRICTED";
    sgovNote?: string;
  }): void;
  removeCustomAsset?(ticker: string): boolean;
}

export * from "./types/strategy";

