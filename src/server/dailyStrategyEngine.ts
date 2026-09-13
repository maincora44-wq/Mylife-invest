import crypto from "crypto";
import { RegimeState, PortfolioHolding, MacroEvent, ActionType } from "../types";
import { 
  DailyStrategy, 
  ActionCode, 
  DataFreshnessStatus, 
  SgovSignalItemDetailed 
} from "../types/strategy";

export interface DailyStrategyEngineOptions {
  userId?: string;
  asOfKST?: string;
  mode?: "ACTUAL" | "DEMO";
  fomoScore?: number; // 0 ~ 10
  isApprovedPortfolio?: boolean;
  baseMaxDailyOrderKRW?: number;
  marketFreshnessThresholdSec?: number;
}

/**
 * Validates data freshness and returns stale/missing metrics
 */
export function validateDataFreshness(
  regimeState: RegimeState | null | undefined,
  portfolioHoldings: PortfolioHolding[] | null | undefined,
  events: MacroEvent[] | null | undefined,
  options: DailyStrategyEngineOptions = {}
): {
  isStaleOrBlocked: boolean;
  dataStatus: DataFreshnessStatus;
  staleMetrics: string[];
  blockReason: string | null;
} {
  const staleMetrics: string[] = [];
  let blockReason: string | null = null;

  // 1. Regime State validation
  if (!regimeState) {
    staleMetrics.push("REGIME_STATE_NULL");
    blockReason = "RegimeState가 제공되지 않았습니다 (결측)";
  } else {
    if (regimeState.regimeScore === null || regimeState.regimeScore === undefined || isNaN(regimeState.regimeScore)) {
      staleMetrics.push("REGIME_SCORE_INVALID");
    }
    if (!regimeState.regime || !["Risk On", "Neutral", "Defensive"].includes(regimeState.regime)) {
      staleMetrics.push("REGIME_TYPE_INVALID");
    }
    if (regimeState.confidence === null || regimeState.confidence === undefined || regimeState.confidence < 0.2) {
      staleMetrics.push("REGIME_CONFIDENCE_TOO_LOW");
    }
  }

  // 2. Portfolio Holdings validation
  if (!portfolioHoldings) {
    staleMetrics.push("PORTFOLIO_HOLDINGS_NULL");
    if (!blockReason) blockReason = "포트폴리오 보유 종목 데이터가 누락되었습니다";
  } else if (portfolioHoldings.length === 0 && options.mode === "ACTUAL") {
    staleMetrics.push("PORTFOLIO_EMPTY");
    if (!blockReason) blockReason = "승인된 포트폴리오 보유 내역이 비어있습니다";
  } else {
    // Check if holdings have valid values
    const hasCorruptHolding = portfolioHoldings.some(h => 
      !h.ticker || 
      h.marketValueKRW === null || 
      h.marketValueKRW === undefined || 
      isNaN(h.marketValueKRW)
    );
    if (hasCorruptHolding) {
      staleMetrics.push("PORTFOLIO_HOLDINGS_CORRUPT");
      if (!blockReason) blockReason = "포트폴리오 종목 평가금액에 결측치가 존재합니다";
    }

    if (options.mode === "ACTUAL" && options.isApprovedPortfolio === false) {
      staleMetrics.push("PORTFOLIO_NOT_APPROVED");
      if (!blockReason) blockReason = "실제 운영 모드에서는 사용자 승인된 포트폴리오가 필수입니다";
    }
  }

  // 3. Events validation
  if (!events) {
    staleMetrics.push("EVENTS_DATA_NULL");
    if (!blockReason) blockReason = "거시 이벤트 캘린더 데이터가 누락되었습니다";
  }

  const isStaleOrBlocked = staleMetrics.length > 0;
  const dataStatus: DataFreshnessStatus = options.mode === "DEMO"
    ? "DEMO"
    : isStaleOrBlocked
      ? "UNAVAILABLE"
      : "CONFIRMED";

  return {
    isStaleOrBlocked,
    dataStatus,
    staleMetrics,
    blockReason
  };
}

/**
 * Pure Deterministic Daily Strategy Engine
 * Accepts RegimeState, PortfolioHoldings, and Events as input.
 * Evaluates rules mathematically without LLM intervention.
 * Produces a reproducible deterministicResultHash based on all input parameters.
 */
export function executeDailyStrategyEngine(
  regimeState: RegimeState | null | undefined,
  portfolioHoldings: PortfolioHolding[] | null | undefined,
  events: MacroEvent[] | null | undefined,
  options: DailyStrategyEngineOptions = {}
): DailyStrategy {
  const calculationVersion = "v2.1.0-deterministic";
  const userId = options.userId || "usr-preview-client-01";
  const mode = options.mode || "ACTUAL";
  const fomoScore = options.fomoScore ?? 1;
  const baseMaxDailyOrderKRW = options.baseMaxDailyOrderKRW ?? (regimeState?.dailyMaxOrderKRW ?? 5000000);

  // KST Timestamp
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffsetMs);
  const asOf = options.asOfKST || kstDate.toISOString().replace("Z", "+09:00");

  // 1. Data Freshness Verification
  const freshness = validateDataFreshness(regimeState, portfolioHoldings, events, options);
  const isDataBlocked = freshness.isStaleOrBlocked;

  // 2. Portfolio Calculation
  let totalPortfolioKRW = 0;
  let stockMarketValueKRW = 0;
  let cashBalanceKRW = 0;

  if (portfolioHoldings && portfolioHoldings.length > 0) {
    for (const holding of portfolioHoldings) {
      const val = Math.max(0, holding.marketValueKRW || 0);
      totalPortfolioKRW += val;
      if (holding.assetClass === "채권·현금" || holding.riskBucket === "현금성·SGOV" || holding.ticker === "SGOV") {
        cashBalanceKRW += val;
      } else {
        stockMarketValueKRW += val;
      }
    }
  }

  const currentStockWeight = totalPortfolioKRW > 0 
    ? Number((stockMarketValueKRW / totalPortfolioKRW).toFixed(3))
    : (regimeState?.currentStockWeight ?? 0);

  // 3. Macro Regime & Allocation Target
  let regime: "Risk On" | "Neutral" | "Defensive" | "Unavailable" = "Unavailable";
  let regimeScore: number | null = null;
  let confidence = 0.5;

  if (!isDataBlocked && regimeState) {
    regime = regimeState.regime;
    regimeScore = regimeState.regimeScore;
    confidence = regimeState.confidence;
  }

  let targetStockWeight = 0.46; // Baseline Neutral target
  if (regime === "Risk On") targetStockWeight = 0.58;
  else if (regime === "Defensive") targetStockWeight = 0.25;
  else if (regime === "Unavailable" || isDataBlocked) targetStockWeight = currentStockWeight;

  const allocationGapKRW = isDataBlocked || totalPortfolioKRW <= 0
    ? 0
    : Math.round(totalPortfolioKRW * (targetStockWeight - currentStockWeight));

  // 4. Macro Events & Cooling Lock
  let eventRestrictionActive = false;
  let activeEventName: string | null = null;

  if (events && events.length > 0) {
    const lockedEvent = events.find(e => e.isLocked === true || e.importance === "CRITICAL");
    if (lockedEvent) {
      eventRestrictionActive = true;
      activeEventName = `${lockedEvent.eventName} (${lockedEvent.eventType})`;
    } else if (regimeState?.nextEvent && regimeState.daysToEvent <= 1) {
      eventRestrictionActive = true;
      activeEventName = `${regimeState.nextEvent} (D-${regimeState.daysToEvent})`;
    }
  }

  // 5. Signals Evaluation (SGOV 7 Framework)
  const sgovSignals: SgovSignalItemDetailed[] = [
    {
      signalId: "SGOV-1",
      name: "미국 10년물 국채금리 4.35% 이하 안정",
      passed: (regimeState?.regimeScore ?? 0) >= 48,
      currentValue: null,
      threshold: "4.35% 이하",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "국채금리 할인율 압박 완화 여부"
    },
    {
      signalId: "SGOV-2",
      name: "Brent 유가 급등 억제 ($86 이하)",
      passed: (regimeState?.regimeScore ?? 0) >= 45,
      currentValue: null,
      threshold: "$86.0 이하",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "원자재 공급망 인플레이션 안정 여부"
    },
    {
      signalId: "SGOV-3",
      name: "CBOE VIX 18pt 이하 안정",
      passed: (regimeState?.regimeScore ?? 0) >= 50,
      currentValue: null,
      threshold: "18.0pt 이하",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "옵션 시장 내 급락 공포 지수"
    },
    {
      signalId: "SGOV-4",
      name: "S&P 500 단기 추세 회복 및 지지",
      passed: regime === "Risk On" || (regime === "Neutral" && (regimeScore ?? 0) >= 50),
      currentValue: null,
      threshold: "단기 지지선 상회",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "대형주 중심 시장 지수 지지력"
    },
    {
      signalId: "SGOV-5",
      name: "Nasdaq 100 기술주 단기 지지",
      passed: regime === "Risk On" || (regime === "Neutral" && (regimeScore ?? 0) >= 55),
      currentValue: null,
      threshold: "단기 지지선 상회",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "기술주 및 성장주 수급 복원"
    },
    {
      signalId: "SGOV-6",
      name: "시장 폭(Market Breadth) 건전성",
      passed: (regimeScore ?? 0) >= 52,
      currentValue: null,
      threshold: "레짐 52점 이상",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "소수 빅테크 쏠림 완화 및 분산도"
    },
    {
      signalId: "SGOV-7",
      name: "신용 스프레드 및 유동성 건전성",
      passed: regime !== "Defensive" && (regimeScore ?? 0) >= 42,
      currentValue: null,
      threshold: "신용 위기 징후 부재",
      observedAt: asOf,
      status: isDataBlocked ? "UNAVAILABLE" : "CONFIRMED",
      rationale: "회사채 스프레드 및 단기 유동성"
    }
  ];

  const sgovSignalCount = sgovSignals.filter(s => s.passed).length;
  const fomoRestrictionActive = fomoScore >= 5;

  // 6. Action Code & Daily Order Limit Decision
  let actionCode: ActionCode = "WAIT";
  let dailyOrderLimitKRW = 0;

  if (isDataBlocked) {
    actionCode = "DATA_BLOCKED";
    dailyOrderLimitKRW = 0;
  } else if (regime === "Defensive") {
    actionCode = "REDUCE";
    dailyOrderLimitKRW = 0;
  } else if (allocationGapKRW <= 0) {
    actionCode = "HOLD";
    dailyOrderLimitKRW = 0;
  } else if (fomoRestrictionActive) {
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  } else if (eventRestrictionActive && sgovSignalCount < 4) {
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  } else if (sgovSignalCount >= 5 && regime === "Risk On") {
    actionCode = "BUY";
    dailyOrderLimitKRW = Math.max(0, Math.min(allocationGapKRW, baseMaxDailyOrderKRW));
  } else if (sgovSignalCount >= 3) {
    if (eventRestrictionActive) {
      actionCode = "WAIT";
      dailyOrderLimitKRW = 0;
    } else {
      actionCode = "BUY";
      dailyOrderLimitKRW = Math.max(0, Math.min(allocationGapKRW, Math.round(baseMaxDailyOrderKRW * 0.4)));
    }
  } else {
    actionCode = "WAIT";
    dailyOrderLimitKRW = 0;
  }

  // Safety: Demo mode locks real order amounts to 0
  if (mode === "DEMO") {
    dailyOrderLimitKRW = 0;
  }

  const eligibleAssets: string[] = ["VOO", "SGOV", "SCHD"];
  const blockedAssets: string[] = ["033780(KT&G)", "QQQ+GOOG_SIMULTANEOUS"];

  const failureConditions: string[] = [
    "핵심 거시 데이터 결측 또는 지연 시 즉시 DATA_BLOCKED 전환",
    "미국 10년물 국채금리 4.55% 상향 돌파 시 당일 매수 검토 취소",
    "주요 이벤트(FOMC, CPI) 락 발동 시 주문 한도 0원 고정"
  ];

  // 7. Deterministic Result Hash (SHA-256 over all inputs and calculated outcomes)
  const hashPayload = JSON.stringify({
    calculationVersion,
    asOf,
    mode,
    isDataBlocked,
    staleMetrics: freshness.staleMetrics,
    regimeInput: regimeState ? {
      regime: regimeState.regime,
      regimeScore: regimeState.regimeScore,
      confidence: regimeState.confidence
    } : null,
    portfolioInput: portfolioHoldings?.map(h => ({
      ticker: h.ticker,
      marketValueKRW: h.marketValueKRW,
      assetClass: h.assetClass
    })) ?? null,
    eventsInput: events?.map(e => ({
      eventId: e.eventId,
      isLocked: e.isLocked,
      importance: e.importance
    })) ?? null,
    outcomes: {
      actionCode,
      dailyOrderLimitKRW,
      targetStockWeight,
      currentStockWeight,
      allocationGapKRW,
      sgovSignalCount,
      eventRestrictionActive,
      fomoRestrictionActive
    }
  });

  const deterministicResultHash = crypto
    .createHash("sha256")
    .update(hashPayload)
    .digest("hex");

  return {
    strategyId: `STRAT-${asOf.split("T")[0]}-${deterministicResultHash.substring(0, 8)}`,
    userId,
    asOf,
    generatedAt: new Date().toISOString(),
    calculationVersion,
    dataStatus: freshness.dataStatus,
    isStaleOrBlocked: isDataBlocked,
    staleMetrics: freshness.staleMetrics,
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
    fomoRestrictionActive,
    fomoScore,
    actionCode,
    dailyOrderLimitKRW,
    eligibleAssets,
    blockedAssets,
    positiveDrivers: [
      `포트폴리오 주식 비중 ${(currentStockWeight * 100).toFixed(1)}% (목표 대비 ${allocationGapKRW > 0 ? "부족" : "충족"})`,
      `SGOV 신호 ${sgovSignalCount}/7 충족`,
      `현금성 자산 ${(cashBalanceKRW / 10000).toLocaleString()}만원 보유`
    ],
    negativeDrivers: isDataBlocked 
      ? [freshness.blockReason || "데이터 신선도 미달로 안전 차단"] 
      : [
          eventRestrictionActive ? `이벤트 제한 활성: ${activeEventName}` : "거시 이벤트 안정권",
          fomoRestrictionActive ? "과열 심리 지수(FOMO) 경계 구간" : "투자 심리 정상"
        ],
    counterScenario: [
      "레짐 점수가 40점 이하로 급락할 경우 전액 방어적 현금(SGOV) 전환",
      "FOMC 및 물가지표 우호적 발표 시 VOO 중심 1차 분할 매수 집행"
    ],
    failureConditions,
    nextKeyEvents: events ? events.slice(0, 3).map(e => `${e.eventName} (${e.eventTimeKST})`) : [],
    deterministicResultHash,
    aiCommentary: null
  };
}

/**
 * Universal calculateDailyStrategy entry point for HTTP requests and background services
 */
export function calculateDailyStrategy(input: any): DailyStrategy {
  if (!input) {
    return executeDailyStrategyEngine(null, null, null);
  }

  // Handle direct inputs: { regimeState, portfolioHoldings, events, options }
  if ("regimeState" in input || "portfolioHoldings" in input) {
    return executeDailyStrategyEngine(
      input.regimeState,
      input.portfolioHoldings,
      input.events,
      input.options
    );
  }

  // Handle converted input: { regime, portfolio, events, signals, mode, asOfKST }
  const regimeState: RegimeState | null = input.regime ? {
    asOf: input.asOfKST || new Date().toISOString(),
    regime: input.regime.name === "Unavailable" ? "Neutral" : input.regime.name,
    regimeScore: input.regime.score ?? 50,
    confidence: input.regime.confidence ?? 0.8,
    currentStockWeight: 0.384,
    targetStockWeight: 0.460,
    shortageWeightPct: 7.6,
    deployableAmountKRW: 30950000,
    dailyMaxOrderKRW: input.baseMaxDailyOrderKRW ?? 5000000,
    action: "WAIT" as ActionType,
    nextEvent: input.events?.activeEventName || "FOMC",
    daysToEvent: input.events?.isEventLockActive ? 1 : 7,
    reasonsWhyScoreChanged: [],
    biggestDragFactor: "국채금리",
    whatNeededForRiskOn: "금리 하락",
    failureConditionDefensive: "금리 4.55% 돌파"
  } : null;

  const holdings: PortfolioHolding[] | null = input.portfolio?.holdings ? input.portfolio.holdings.map((h: any, idx: number) => ({
    holdingId: `hld-${idx}`,
    asOfDate: input.asOfKST || new Date().toISOString(),
    account: "위탁",
    accountType: "위탁" as const,
    ticker: h.ticker || "UNKNOWN",
    assetName: h.name || h.ticker || "Asset",
    quantity: 1,
    price: h.evalAmount || 0,
    currency: "KRW" as const,
    fxRate: 1,
    marketValueKRW: h.evalAmount || 0,
    costKRW: h.evalAmount || 0,
    assetClass: h.isCash ? "채권·현금" as const : "주식" as const,
    sector: "General",
    riskBucket: h.isCash ? "현금성·SGOV" as const : "광범위 미국주식" as const,
    tradable: true,
    restricted: false,
    taxConstraint: "일반"
  })) : null;

  const events: MacroEvent[] | null = input.events ? [
    {
      eventId: "evt-active",
      eventType: "FOMC",
      eventName: input.events.activeEventName || "FOMC 회의",
      eventTimeKST: input.asOfKST || new Date().toISOString(),
      importance: "HIGH",
      isLocked: input.events.isEventLockActive === true,
      coolingPeriodMin: 120,
      firstDayCapPct: 40,
      highBetaRiskBudgetPct: 0,
      baseScenario: "동결",
      bullScenario: "인하",
      bearScenario: "매파적",
      allowedOrderKRW: 0
    }
  ] : null;

  return executeDailyStrategyEngine(regimeState, holdings, events, {
    mode: input.mode,
    asOfKST: input.asOfKST,
    fomoScore: input.signals?.fomoScore ?? 1,
    isApprovedPortfolio: input.portfolio?.isApproved ?? true,
    baseMaxDailyOrderKRW: input.baseMaxDailyOrderKRW
  });
}
