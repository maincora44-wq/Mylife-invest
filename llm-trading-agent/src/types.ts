/**
 * 페이퍼 트레이딩 실험의 입출력 형태.
 *
 * 주문 실행, 브로커 연동, 자격 증명을 포함하지 않는다.
 * 앱 엔트리에서 import하지 않으며, 한도 숫자는 이 파일에 두지 않는다.
 * 예시 한도는 prompts/risk.md에만 있고 실험 한도가 아니다.
 */

export type PaperMode = "PAPER_ONLY";

/** ISO 8601. 시간대 오프셋을 포함한다. 예: 2026-01-15T09:30:00+09:00 */
export type IsoDateTime = string;

export type PaperAction = "BUY" | "SELL" | "HOLD" | "WAIT";

export interface CitedFact {
  id: string;
  statement: string;
  source: string;
  asOf: IsoDateTime;
  value: string | number | null;
  unit: string | null;
}

export interface LabeledEstimate {
  id: string;
  statement: string;
  method: string;
  asOf: IsoDateTime;
  uncertainty: string;
}

export type ScenarioName = "bull" | "base" | "bear";

export interface ScenarioCase {
  name: ScenarioName;
  summary: string;
  drivers: string[];
  /** 추정이다. 사실로 적지 않는다. 근거가 없으면 null. */
  subjectiveProbability: number | null;
}

export interface InvalidationCondition {
  id: string;
  observable: string;
  threshold: string;
  source: string;
}

/** 분석 역할 출력. recommendation은 항상 null이다. */
export interface AnalysisMemo {
  schemaVersion: "paper-analysis-v1";
  mode: PaperMode;
  experimentId: string;
  symbol: string;
  asOf: IsoDateTime;
  facts: CitedFact[];
  estimates: LabeledEstimate[];
  scenarios: {
    bull: ScenarioCase;
    base: ScenarioCase;
    bear: ScenarioCase;
  };
  invalidation: InvalidationCondition[];
  unknowns: string[];
  recommendation: null;
}

export interface PaperSizingProposal {
  /**
   * 포트폴리오 대비 비중 변화 제안.
   * +0.02는 2%p 확대, -0.02는 2%p 축소.
   * WAIT와 HOLD는 0이다. 주문 수량이 아니다.
   */
  proposedWeightDelta: number;
  proposedNotional: number | null;
  currency: "KRW" | "USD";
  rationale: string;
}

/** 의사결정 역할 출력. execution은 페이퍼 기록용이며 주문을 만들지 않는다. */
export interface PaperDecision {
  schemaVersion: "paper-decision-v1";
  mode: PaperMode;
  experimentId: string;
  symbol: string;
  asOf: IsoDateTime;
  analysisAsOf: IsoDateTime;
  action: PaperAction;
  /** 0 이상 1 이하. 약하면 action은 WAIT다. */
  conviction: number;
  sizing: PaperSizingProposal;
  rationale: {
    summary: string;
    factIds: string[];
    estimateIds: string[];
    /** WAIT이면 null. 그 외에는 왜 WAIT가 아닌지를 적는다. */
    whyNotWait: string | null;
  };
  invalidationIds: string[];
  horizon: string;
  execution: {
    autoExecute: false;
    broker: null;
    order: null;
  };
}

export interface PaperLookThrough {
  issuer: string;
  weight: number;
}

export interface PaperPosition {
  symbol: string;
  weight: number;
  lookThrough: PaperLookThrough[] | null;
  avgDailyNotional20d: number | null;
  avgDailyNotionalCurrency: "KRW" | "USD" | null;
}

/** 운영자가 붙여 넣는 가상 잔고. 브로커 조회 결과가 아니다. */
export interface PaperPortfolioSnapshot {
  asOf: IsoDateTime;
  currency: "KRW" | "USD";
  equity: number;
  cashWeight: number;
  peakEquity: number;
  positions: PaperPosition[];
}

/**
 * 트랙에 고정하는 한도표.
 * 숫자의 예시 값은 prompts/risk.md에만 있다.
 * allowLeverage와 allowShort는 이 버전에서 false만 허용한다.
 */
export interface RiskLimitSheet {
  schemaVersion: "paper-risk-limits-v1";
  experimentId: string;
  confirmedForExperiment: boolean;
  maxPositionWeight: number;
  maxSingleTradeWeight: number;
  maxDrawdownStop: number;
  cashFloorWeight: number;
  maxLookThroughWeight: number;
  minAvgDailyNotional: number;
  minAvgDailyNotionalCurrency: "KRW" | "USD";
  maxParticipationOfAdv: number;
  allowLeverage: false;
  allowShort: false;
}

export type RiskCheckId =
  | "LIMITS_NOT_CONFIRMED"
  | "STALE_OR_LOOKAHEAD"
  | "MAX_POSITION_WEIGHT"
  | "MAX_SINGLE_TRADE"
  | "MAX_DRAWDOWN_STOP"
  | "CASH_FLOOR"
  | "CONCENTRATION"
  | "LIQUIDITY"
  | "NO_LEVERAGE"
  | "NO_SHORT";

export interface RiskCheck {
  id: RiskCheckId;
  hard: true;
  passed: boolean;
  limit: string;
  observed: string;
}

export type RiskReasonCode = RiskCheckId | "ACTION_NOT_ALLOWED";

interface RiskReviewBase {
  schemaVersion: "paper-risk-v1";
  mode: PaperMode;
  experimentId: string;
  symbol: string;
  asOf: IsoDateTime;
  proposalAction: PaperAction;
  checks: RiskCheck[];
  reasonCodes: RiskReasonCode[];
  reasons: string[];
  execution: {
    autoExecute: false;
    broker: null;
    order: null;
  };
}

/**
 * APPROVE: 제안을 그대로 기록한다. veto는 false.
 * REDUCE: 하드 리밋 안으로 줄인 뒤에만 기록한다. veto는 false. BUY를 새로 만들지 않고, 기존 BUY/SELL의 절대 크기만 줄인다.
 * VETO: 제안을 거부한다. adjustedAction은 BUY가 될 수 없다.
 */
export type RiskReview =
  | (RiskReviewBase & {
      verdict: "APPROVE";
      veto: false;
      adjustedAction: PaperAction;
      adjustedWeightDelta: number;
    })
  | (RiskReviewBase & {
      verdict: "REDUCE";
      veto: false;
      adjustedAction: "BUY" | "SELL";
      adjustedWeightDelta: number;
    })
  | (RiskReviewBase & {
      verdict: "VETO";
      veto: true;
      adjustedAction: "SELL" | "HOLD" | "WAIT";
      adjustedWeightDelta: number;
    });
