import { ValidatedHolding, ValidatedPortfolioCapture } from "./schemas";

export interface ReconciliationResult {
  discrepancyPass: boolean;
  totalAssetAmount: number | null;
  stockSum: number;
  effectiveCash: number;
  calculatedTotal: number;
  discrepancy: number;
  allowedTolerance: number;
  hasPartialItems: boolean;
  requiresManualReview: boolean;
  auditNotes: string[];
}

// Inspect holding item name to detect if it's a cash line
export function isCashItem(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("예수금") ||
    lower.includes("출금가능") ||
    lower.includes("외화예수금") ||
    lower.includes("원화예수금") ||
    lower.includes("cma") ||
    lower.includes("usd 현금") ||
    lower.includes("달러 예수금")
  );
}

// Deterministic arithmetic verification
export function reconcilePortfolioCapture(
  input: ValidatedPortfolioCapture
): ReconciliationResult {
  const auditNotes: string[] = [...(input.auditNotes || [])];

  if (input.totalAssetAmount === null || input.totalAssetAmount === undefined || !Number.isSafeInteger(input.totalAssetAmount)) {
    auditNotes.push("화면 상단 총자산 숫자가 식별되지 않았습니다. 수동 검수가 필요합니다.");
    return {
      discrepancyPass: false,
      totalAssetAmount: null,
      stockSum: 0,
      effectiveCash: 0,
      calculatedTotal: 0,
      discrepancy: Infinity,
      allowedTolerance: 1000,
      hasPartialItems: false,
      requiresManualReview: true,
      auditNotes
    };
  }

  const holdings = input.holdings || [];
  let cashIncludedInHoldings = input.cashIncludedInHoldings ?? false;

  // Classify cash items within holdings
  const markedHoldings = holdings.map(h => ({
    ...h,
    isCash: h.isCash || isCashItem(h.name)
  }));

  const cashInHoldingRows = markedHoldings.filter(h => h.isCash);
  if (cashInHoldingRows.length > 0) {
    cashIncludedInHoldings = true;
  }

  // Only non-partial items are counted in the confirmed total
  const validHoldings = markedHoldings.filter(h => !h.isPartial);
  const stockSum = validHoldings.filter(h => !h.isCash).reduce((sum, h) => sum + (h.evalAmount || 0), 0);
  const holdingCashSum = validHoldings.filter(h => h.isCash).reduce((sum, h) => sum + (h.evalAmount || 0), 0);

  // If cash is in holdings, do not double-count with external cashBalance
  const effectiveCash = cashIncludedInHoldings ? holdingCashSum : (input.cashBalance || holdingCashSum);
  const calculatedTotal = stockSum + effectiveCash;
  const discrepancy = input.totalAssetAmount - calculatedTotal;
  const allowedTolerance = Math.max(1000, input.totalAssetAmount * 0.0001);
  const discrepancyPass = Math.abs(discrepancy) <= allowedTolerance;

  const hasPartialItems = holdings.some(h => h.isPartial);
  if (hasPartialItems) {
    auditNotes.push("화면에서 잘린 불완전 종목이 감지되었습니다. 확정 합계에서 제외되었으므로 검수가 필요합니다.");
  }

  if (discrepancyPass) {
    auditNotes.push(`검산 통과: 화면 총자산(${input.totalAssetAmount.toLocaleString()}원)과 산출합계(${calculatedTotal.toLocaleString()}원)의 오차(${Math.abs(discrepancy).toLocaleString()}원)가 허용범위(${allowedTolerance.toLocaleString()}원) 이내입니다.`);
  } else {
    auditNotes.push(`검산 불일치: 화면 총자산(${input.totalAssetAmount.toLocaleString()}원) 대비 산출합계(${calculatedTotal.toLocaleString()}원)의 차액이 ${Math.abs(discrepancy).toLocaleString()}원 발생하여 승인이 잠겼습니다.`);
  }

  return {
    discrepancyPass,
    totalAssetAmount: input.totalAssetAmount,
    stockSum,
    effectiveCash,
    calculatedTotal,
    discrepancy,
    allowedTolerance,
    hasPartialItems,
    requiresManualReview: !discrepancyPass || hasPartialItems,
    auditNotes
  };
}

// Calculate Whole Portfolio State from approved active snapshots
export function calculateInvestmentState(
  allApprovedSnapshots: Array<{
    totalAssetAmount: number;
    cashBalance: number;
    holdings: Array<{
      name: string;
      ticker?: string | null;
      evalAmount: number;
      isCash?: boolean;
    }>;
  }>,
  currentRegime: string = "Neutral",
  targetStockWeight: number = 0.46
) {
  let totalPortfolioKRW = 0;
  let totalStockKRW = 0;
  let totalCashBondKRW = 0;
  let totalGoldKRW = 0;

  for (const snapshot of allApprovedSnapshots) {
    totalPortfolioKRW += snapshot.totalAssetAmount;
    for (const h of snapshot.holdings) {
      const name = h.name.toLowerCase();
      const ticker = (h.ticker || "").toUpperCase();

      if (h.isCash || isCashItem(h.name) || ticker === "SGOV" || name.includes("treasury") || name.includes("채권") || name.includes("예수금")) {
        totalCashBondKRW += h.evalAmount;
      } else if (name.includes("골드") || name.includes("gold") || ticker === "IAU" || ticker === "GLD") {
        totalGoldKRW += h.evalAmount;
      } else {
        totalStockKRW += h.evalAmount;
      }
    }
  }

  if (totalPortfolioKRW === 0) {
    totalPortfolioKRW = 1; // prevent divide by zero
  }

  const currentStockWeight = Math.round((totalStockKRW / totalPortfolioKRW) * 1000) / 1000;
  const cashBondWeight = Math.round((totalCashBondKRW / totalPortfolioKRW) * 1000) / 1000;
  const goldWeight = Math.round((totalGoldKRW / totalPortfolioKRW) * 1000) / 1000;

  const shortagePct = Math.max(0, Math.round((targetStockWeight - currentStockWeight) * 1000) / 10);
  const deployableAmountKRW = Math.round(totalPortfolioKRW * (shortagePct / 100));
  const dailyMaxOrderKRW = Math.min(5000000, Math.round(deployableAmountKRW * 0.2));

  return {
    as_of: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    regime: currentRegime,
    regime_score: 56,
    confidence: 0.72,
    total_portfolio_krw: totalPortfolioKRW,
    current_stock_weight: currentStockWeight,
    target_stock_weight: targetStockWeight,
    cash_bond_weight: cashBondWeight,
    gold_weight: goldWeight,
    shortage_pct: shortagePct,
    deployable_amount_krw: deployableAmountKRW,
    daily_max_order_krw: dailyMaxOrderKRW,
    sgov_signal_count: 4,
    sgov_signal_total: 7,
    action: shortagePct > 0 ? "BUY_DIVIDED" : "WAIT",
    next_event: "FOMC (D-1)",
    event_lock: true,
    cooling_period_min: 30
  };
}
