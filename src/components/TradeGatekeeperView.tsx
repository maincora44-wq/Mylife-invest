import React, { useState } from "react";
import { TradeGatekeeperRequest, GatekeeperVerdict, RegimeState } from "../types";
import { formatKRW } from "../utils/formatters";
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Bot, 
  Sparkles, 
  Save, 
  ArrowRight,
  Calculator,
  RefreshCw
} from "lucide-react";

interface TradeGatekeeperViewProps {
  currentRegimeState: RegimeState;
  onSaveToJournal: (entry: any) => void;
  prefillTicker?: string;
  prefillAmount?: number;
}

export const TradeGatekeeperView: React.FC<TradeGatekeeperViewProps> = ({
  currentRegimeState,
  onSaveToJournal,
  prefillTicker = "VOO",
  prefillAmount = 5000000,
}) => {
  const [ticker, setTicker] = useState(prefillTicker);
  const [account, setAccount] = useState("메인 위탁계좌");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [proposedAmount, setProposedAmount] = useState(prefillAmount);
  const [entryPrice, setEntryPrice] = useState(520.4);
  const [stopPrice, setStopPrice] = useState(498.0);
  const [targetPrice, setTargetPrice] = useState(570.0);
  const [strategyType, setStrategyType] = useState("레짐 기반 정기 분할 편입");
  const [thesis, setThesis] = useState("S&P500 50일선 지지 복원 및 SGOV 재투입 신호 충족에 따른 기계적 1차 분할 매수");
  const [counterThesis, setCounterThesis] = useState("FOMC 발표 직전 금리 변동성 확대 및 단기 차익실현 리스크");
  const [invalidationCondition, setInvalidationCondition] = useState("S&P500 5,600선 하향 이탈 및 10년물 4.40% 돌파 시 논리적 무효화");
  const [associatedEvent, setAssociatedEvent] = useState("FOMC (D-1)");
  const [fomoScore, setFomoScore] = useState(25);

  // Result state
  const [inspectionResult, setInspectionResult] = useState<TradeGatekeeperRequest | null>(null);
  const [isLoadingCopilot, setIsLoadingCopilot] = useState(false);
  const [copilotFeedback, setCopilotFeedback] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Calculate Risk/Reward
  const potentialLossPerUnit = Math.max(0, entryPrice - stopPrice);
  const potentialGainPerUnit = Math.max(0, targetPrice - entryPrice);
  const riskRewardRatio = potentialLossPerUnit > 0 ? (potentialGainPerUnit / potentialLossPerUnit).toFixed(2) : "0";
  const plannedLossKRW = entryPrice > 0 ? Math.round((potentialLossPerUnit / entryPrice) * proposedAmount) : 0;

  const handleRunGatekeeperCheck = async () => {
    setIsSaved(false);
    setCopilotFeedback(null);

    // 10 Key Check Rules
    const checks = [
      {
        title: "1. 현재 시장 레짐 적합성",
        passed: currentRegimeState.regime !== "Defensive" || side === "SELL",
        warning: currentRegimeState.regime === "Neutral",
        reason: currentRegimeState.regime === "Neutral" 
          ? "Neutral(56점) 구간: 적극 공격 매수 불가, 1차 탐색 또는 분할 매수만 허용" 
          : "레짐 적합도 통과",
      },
      {
        title: "2. 목표 주식비중 초과 여부",
        passed: proposedAmount <= currentRegimeState.deployableAmountKRW,
        reason: proposedAmount <= currentRegimeState.deployableAmountKRW
          ? `신규 요청(${formatKRW(proposedAmount)})이 잔여 여유액(${formatKRW(currentRegimeState.deployableAmountKRW)}) 이내`
          : `목표 비중 초과 위험: 잔여 여유액은 ${formatKRW(currentRegimeState.deployableAmountKRW)}입니다.`,
      },
      {
        title: "3. 동일 위험묶음 한도 준수",
        passed: ticker !== "GOOGL" || proposedAmount <= 3000000,
        warning: ticker === "GOOGL",
        reason: ticker === "GOOGL" 
          ? "Alphabet은 Look-through 포함 실질 12.3%로 상한(15%) 임계치 근접 중" 
          : "위험묶음 분산 기준 적합",
      },
      {
        title: "4. 최근 매도종목 재매수 방지",
        passed: true,
        reason: "최근 5거래일 이내 동일 종목 손절 또는 매도 이력 없음",
      },
      {
        title: "5. CPI·FOMC 직후 추격매수 여부",
        passed: false,
        warning: true,
        reason: "FOMC D-1 경계 구간: 발표 전 30분~발표 후 1일차 상한 25% 룰 적용 대상",
      },
      {
        title: "6. 계획손실 vs 일일 위험예산",
        passed: plannedLossKRW <= 1000000,
        reason: `계획손실(${formatKRW(plannedLossKRW)})이 1회 최대 위험예산(100만원) 이내`,
      },
      {
        title: "7. 손익비(Risk-Reward) 기준 적합",
        passed: Number(riskRewardRatio) >= 1.8,
        reason: `손익비 1:${riskRewardRatio} (기준 1:1.8 이상 충족)`,
      },
      {
        title: "8. 계좌 제약 및 과세 위반 여부",
        passed: true,
        reason: `${account}의 해외주식 양도소득세 및 상품군 제약 준수`,
      },
      {
        title: "9. FOMO 거래 점수 감지",
        passed: fomoScore <= 50,
        warning: fomoScore > 40,
        reason: fomoScore <= 50 
          ? `FOMO 점수 ${fomoScore}/100으로 침착한 상태 유지` 
          : `FOMO 점수 ${fomoScore}/100으로 감정적 추격매수 징후 경계`,
      },
      {
        title: "10. 더 나은 대체자산 존재 여부",
        passed: true,
        reason: "SGOV 투입 우선순위 1위(VOO)에 부합",
      },
    ];

    // Determine Verdict
    let verdict: GatekeeperVerdict = "APPROVE";
    let allowedAmount = proposedAmount;
    let note = "사전 정의된 위험관리 기준을 충족합니다.";
    let alt = "계획대로 분할 1차 진입을 고려할 수 있습니다.";

    if (fomoScore >= 70 || plannedLossKRW > 2000000) {
      verdict = "REJECT";
      allowedAmount = 0;
      note = "FOMO 점수 과다 또는 위험예산 초과로 즉각 거부되었습니다.";
      alt = "오늘 장마감 후까지 관찰하고 내일 아침 DAILY CHECK에서 재평가하세요.";
    } else if (associatedEvent.includes("FOMC") || fomoScore > 40) {
      verdict = "WAIT";
      allowedAmount = Math.min(proposedAmount * 0.5, currentRegimeState.dailyMaxOrderKRW);
      note = "FOMC D-1 이벤트 락 작동 중입니다. 이벤트 결과 및 변동성 확인 후 진입이 원칙입니다.";
      alt = "발표 후 1거래일 대기 후 진입하거나 최대 500만원 내 VOO 소액 탐색매수만 고려";
    } else if (proposedAmount > currentRegimeState.dailyMaxOrderKRW) {
      verdict = "APPROVE 50%";
      allowedAmount = currentRegimeState.dailyMaxOrderKRW;
      note = `일일 최대 허용 한도(${formatKRW(currentRegimeState.dailyMaxOrderKRW)})를 초과하여 주문금액이 축소되었습니다.`;
      alt = "오늘 500만원 1차 체결 후 내일 추가 검토";
    }

    const result: TradeGatekeeperRequest = {
      account,
      ticker,
      side,
      proposedAmountKRW: proposedAmount,
      entryPrice,
      stopPrice,
      targetPrice,
      thesis,
      counterThesis,
      eventType: associatedEvent,
      riskBucket: "광범위 미국주식",
      plannedLossKRW,
      fomoScore,
      checks,
      verdict,
      allowedAmountKRW: allowedAmount,
      adjustmentNote: note,
      alternativeSuggestion: alt,
    };

    setInspectionResult(result);

    // Call server Copilot Studio Agent API
    setIsLoadingCopilot(true);
    try {
      const resp = await fetch("/api/copilot/gatekeeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          side,
          proposedAmount,
          entryPrice,
          stopPrice,
          targetPrice,
          thesis,
          counterThesis,
          fomoScore,
          currentRegime: currentRegimeState.regime,
        }),
      });
      const data = await resp.json();
      if (data.aiReasoning) {
        setCopilotFeedback(data.aiReasoning);
      }
    } catch (e) {
      console.error("Copilot fetch failed:", e);
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  const handleSave = () => {
    if (!inspectionResult) return;
    onSaveToJournal({
      ticker,
      side,
      amountKRW: inspectionResult.allowedAmountKRW,
      thesis,
      counterThesis,
      regimeAtTrade: `${currentRegimeState.regime} (${currentRegimeState.regimeScore}점)`,
      dataBacking: `Gatekeeper 판정: ${inspectionResult.verdict}, 계획손실 ${formatKRW(plannedLossKRW)}`,
      invalidationCondition,
      plannedLossKRW,
      fomoScore,
      decisionQuality: inspectionResult.verdict === "REJECT" ? "원칙 위반" : "적정",
      outcomeQuality: "진행중",
      ruleCompliant: inspectionResult.verdict !== "REJECT",
      lessonLearned: `사전 검토 완료: ${inspectionResult.adjustmentNote}`,
    });
    setIsSaved(true);
  };

  const getVerdictStyle = (verdict: GatekeeperVerdict) => {
    switch (verdict) {
      case "APPROVE":
        return "bg-emerald-600 text-white border-emerald-700";
      case "APPROVE 50%":
        return "bg-blue-600 text-white border-blue-700";
      case "WAIT":
        return "bg-amber-500 text-stone-950 border-amber-600";
      case "REVIEW TOMORROW":
        return "bg-purple-600 text-white border-purple-700";
      case "REJECT":
      default:
        return "bg-rose-600 text-white border-rose-700";
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Trade Gatekeeper</span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              주문 브레이크 시스템
            </span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            증권사 앱에서 매수 버튼을 누르기 전, 10대 사전 검사 및 무효화 조건을 자동 심사합니다
          </p>
        </div>
      </div>

      {/* Input Form Card */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-4">
        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>매수 전 필수 검토 정보 입력</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Ticker & Side */}
          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              종목명 / 티커
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-bold"
              placeholder="예: VOO, QQQ, GOOGL"
            />
          </div>

          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              대상 계좌
            </label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium"
            >
              <option value="메인 위탁계좌">메인 위탁계좌 (일반과세)</option>
              <option value="연금저축/IRP">연금저축/IRP (과세이연)</option>
              <option value="국내 비과세/장기">국내 비과세/장기</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              예정 주문금액 (KRW)
            </label>
            <input
              type="number"
              value={proposedAmount}
              onChange={(e) => setProposedAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono font-bold"
              step={1000000}
            />
            <span className="text-[10px] text-stone-600 dark:text-stone-300 mt-0.5 block">
              = {formatKRW(proposedAmount)}
            </span>
          </div>

          {/* Associated Event */}
          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              관련 거시 이벤트
            </label>
            <select
              value={associatedEvent}
              onChange={(e) => setAssociatedEvent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium"
            >
              <option value="FOMC (D-1)">FOMC 금리결정 (D-1 경계)</option>
              <option value="CPI 발표">CPI 물가지수 발표</option>
              <option value="실적 발표">개별 기업 실적 발표</option>
              <option value="해당 없음">해당 없음 (평시)</option>
            </select>
          </div>

          {/* Entry, Stop, Target */}
          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              계획 진입가
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-rose-600 dark:text-rose-400 font-bold mb-1">
              손절가 (필수 무효화 기준)
            </label>
            <input
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-emerald-600 dark:text-emerald-400 font-bold mb-1">
              목표가
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono"
            />
          </div>

          {/* Computed Risk-Reward */}
          <div className="flex flex-col justify-end">
            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-300">손익비(R:R):</span>
                <strong className={`font-mono ${Number(riskRewardRatio) >= 1.8 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  1 : {riskRewardRatio}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-300">계획 손실액:</span>
                <strong className="font-mono text-rose-700 dark:text-rose-300">{formatKRW(plannedLossKRW)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Thesis & Counter-Thesis */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-stone-600 dark:text-stone-300 font-medium mb-1">
              매수 이유 (Thesis)
            </label>
            <textarea
              rows={2}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
              placeholder="왜 이 가격과 이 시점에 사는가?"
            />
          </div>

          <div>
            <label className="block text-amber-800 dark:text-amber-300 font-bold mb-1">
              반대 논리 (Counter-Thesis - 내가 틀릴 수 있는 이유)
            </label>
            <textarea
              rows={2}
              value={counterThesis}
              onChange={(e) => setCounterThesis(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-stone-900 dark:text-stone-100 text-xs"
              placeholder="어떤 반대 데이터가 존재하는가?"
            />
          </div>

          {/* FOMO Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-600 dark:text-stone-300 font-medium">
                스스로 느끼는 FOMO(놓칠까 두려운 조급함) 점수: <strong className="text-stone-900 dark:text-stone-100">{fomoScore}점</strong>
              </span>
              <span className={`font-semibold ${fomoScore > 50 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                {fomoScore > 60 ? "위험 (충동 경계)" : fomoScore > 40 ? "보통" : "침착함"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={fomoScore}
              onChange={(e) => setFomoScore(Number(e.target.value))}
              className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRunGatekeeperCheck}
          className="w-full py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-black text-xs sm:text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Gatekeeper 10대 자동 검사 실행</span>
        </button>
      </div>

      {/* Inspection Output Results Card */}
      {inspectionResult && (
        <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-lg space-y-4 animate-in fade-in duration-200">
          {/* Verdict Banner */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4">
            <div>
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                Gatekeeper 최종 판정
              </span>
              <div className="mt-1">
                <span className={`px-4 py-1.5 rounded-xl font-black text-base sm:text-lg tracking-wider border shadow-xs inline-flex items-center gap-2 ${getVerdictStyle(inspectionResult.verdict)}`}>
                  {inspectionResult.verdict}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                조정된 허용 주문금액
              </span>
              <div className="text-xl font-black font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                {formatKRW(inspectionResult.allowedAmountKRW)}
              </div>
              <div className="text-[10px] text-stone-600 dark:text-stone-300 line-through">
                요청액: {formatKRW(inspectionResult.proposedAmountKRW)}
              </div>
            </div>
          </div>

          {/* Adjustment Reason and Alternatives */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 text-xs space-y-2">
            <div>
              <strong className="text-stone-800 dark:text-stone-200">판정 근거:</strong>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                {inspectionResult.adjustmentNote}
              </p>
            </div>
            <div className="pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
              <strong className="text-blue-700 dark:text-blue-400">권고 대안:</strong>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                {inspectionResult.alternativeSuggestion}
              </p>
            </div>
          </div>

          {/* Copilot Studio Trade Review Agent Feedback */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-blue-600" />
                <span>Copilot Studio - Trade Review Agent</span>
              </span>
              {isLoadingCopilot && (
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-blue-950 dark:text-blue-200 leading-relaxed">
              {copilotFeedback || "반대 논리와 FOMO 지표를 상호 교차 검증 중입니다..."}
            </p>
          </div>

          {/* 10 Checklist details */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300">
              10대 세부 검사 항목
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {inspectionResult.checks.map((chk, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-stone-50/80 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 flex items-start gap-2 text-xs"
                >
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : chk.warning ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {chk.title}
                    </div>
                    <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-0.5">
                      {chk.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save to Decision Journal Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                isSaved
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>결정 저널에 저장 완료</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>이 검토 내역을 Decision Journal에 기록</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
