import React, { useState, useEffect, useMemo } from "react";
import { RegimeState, RegimeFactorScore, RegimeType } from "../types";
import { 
  Compass, 
  HelpCircle, 
  TrendingUp, 
  AlertTriangle, 
  Sliders, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Activity,
  Cpu
} from "lucide-react";
import { technicalDataProvider } from "../services/technicalDataProvider";

interface RegimeMonitorViewProps {
  initialState: RegimeState;
  factorScores: RegimeFactorScore[];
  onUpdateRegimeScore: (newScore: number, newRegime: RegimeType) => void;
  onSyncGeminiLive?: () => void;
  isSyncing?: boolean;
  onOpenReliabilityTest?: () => void;
  onNavigateToTechnicalChart?: () => void;
}

export const RegimeMonitorView: React.FC<RegimeMonitorViewProps> = ({
  initialState,
  factorScores: initialFactors,
  onUpdateRegimeScore,
  onSyncGeminiLive,
  isSyncing = false,
  onOpenReliabilityTest,
  onNavigateToTechnicalChart,
}) => {
  const [factors, setFactors] = useState<RegimeFactorScore[]>(initialFactors);

  const technicalSummary = useMemo(() => {
    return technicalDataProvider.getTechnicalSummary("VOO");
  }, []);

  const technicalSignal = useMemo(() => {
    return technicalDataProvider.evaluateRegimeSignal("VOO");
  }, []);

  const marketAggregate = useMemo(() => {
    return technicalDataProvider.getMarketAggregateTechnicalRegime();
  }, []);

  // Sync internal factors state when external factorScores prop updates (e.g. after Gemini live sync)
  useEffect(() => {
    setFactors(initialFactors);
  }, [initialFactors]);

  const calculateTotal = (fList: RegimeFactorScore[]) => {
    return fList.reduce((sum, f) => sum + f.score, 0);
  };

  const currentTotal = calculateTotal(factors);

  const getRegimeByScore = (score: number): RegimeType => {
    if (score >= 65) return "Risk On";
    if (score <= 44) return "Defensive";
    return "Neutral";
  };

  const currentRegime = getRegimeByScore(currentTotal);

  const handleScoreChange = (index: number, newScore: number) => {
    const updated = [...factors];
    updated[index] = { ...updated[index], score: newScore };
    setFactors(updated);
    const total = calculateTotal(updated);
    onUpdateRegimeScore(total, getRegimeByScore(total));
  };

  const handleReset = () => {
    setFactors(initialFactors);
    const total = calculateTotal(initialFactors);
    onUpdateRegimeScore(total, getRegimeByScore(total));
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Regime Monitor (시장 레짐 진단)</span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            5대 팩터 실시간 스코어링 및 레짐 전환을 좌우하는 4대 핵심 질문 답변
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onOpenReliabilityTest && (
            <button
              onClick={onOpenReliabilityTest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors shadow-xs"
              title="야후 파이낸스 실시간 호가 및 산출 공식 신뢰성 검증 테스트"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>야후 신뢰성 테스트</span>
            </button>
          )}

          {onSyncGeminiLive && (
            <button
              onClick={onSyncGeminiLive}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors shadow-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Gemini 검색 중..." : "실시간 동기화"}</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-1.5 px-2.5 rounded-xl text-xs text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 bg-stone-100 dark:bg-stone-800 flex items-center gap-1 border border-stone-200 dark:border-stone-700"
            title="기본값 복원"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      </div>

      {/* Main Scorecard */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
              실시간 판정 레짐 및 총점
            </span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-3xl font-black text-stone-900 dark:text-stone-100">
                {currentRegime}
              </span>
              <span className="text-lg font-bold font-mono text-stone-700 dark:text-stone-300">
                {currentTotal} <span className="text-xs font-normal text-stone-600 dark:text-stone-300">/ 100점</span>
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              {currentTotal >= 65 ? "Risk On (65~100점)" : currentTotal <= 44 ? "Defensive (0~44점)" : "Neutral (45~64점)"}
            </span>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-1">
              신뢰도 {Math.round((initialState.confidence || 0.8) * 100)}% · Gemini 실시간 관제 엔진
            </div>
          </div>
        </div>

        {/* 5 Factors Breakdown */}
        <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-stone-800">
          {factors.map((factor, idx) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      factor.status === "green"
                        ? "bg-emerald-500"
                        : factor.status === "red"
                        ? "bg-rose-500"
                        : "bg-amber-400"
                    }`}
                  />
                  {factor.name}
                </span>
                <span className="font-mono text-stone-700 dark:text-stone-300 font-bold">
                  {factor.score} <span className="text-stone-600 dark:text-stone-300 font-normal">/ {factor.maxScore}</span>
                </span>
              </div>

              {/* Slider / Range */}
              <input
                type="range"
                min={0}
                max={factor.maxScore}
                value={factor.score}
                onChange={(e) => handleScoreChange(idx, Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />

              <div className="flex items-center justify-between text-[10px] text-stone-600 dark:text-stone-300">
                <span className="truncate">{factor.drivers}</span>
                {factor.dragReason && (
                  <span className="text-rose-700 dark:text-rose-400 truncate ml-2">
                    부담: {factor.dragReason}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Technical Data Provider Linkage Card */}
        <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-100">
                <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>기술 지표 공급자(TechnicalDataProvider) 연동 근거</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300">
                  MA(20·60·200) + RSI(5)
                </span>
              </div>
              <p className="text-[11px] text-blue-950 dark:text-blue-200 leading-snug">
                • VOO: <strong>{technicalSummary.alignment === "BULLISH_ORDER" ? "정배열 강세" : technicalSummary.isAboveMa200 ? "200일선 상회 지지" : "200일선 하회 경계"}</strong> ({technicalSignal.regimeContributionLabel})
                <br />
                • 5일 RSI: <strong>{technicalSummary.rsi5}</strong> ({technicalSignal.shortTermMomentum.split(" - ")[1] || "정상 범위"})
              </p>
            </div>

            {onNavigateToTechnicalChart && (
              <button
                onClick={onNavigateToTechnicalChart}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shrink-0 self-start sm:self-auto transition-colors shadow-2xs"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>기술적 차트 보기</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Essential Diagnostic Questions (단순 점수뿐 아니라 답해야 하는 4대 질문) */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 px-1">
          레짐 판단을 위한 4대 핵심 질문 &amp; 실시간 근거
        </h2>

        {/* Question 1 */}
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>1. 오늘 점수가 왜 변동(또는 유지)되었는가?</span>
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-6 space-y-1">
            {initialState.reasonsWhyScoreChanged && initialState.reasonsWhyScoreChanged.length > 0 ? (
              initialState.reasonsWhyScoreChanged.map((reason, rIdx) => (
                <p key={rIdx}>• {reason}</p>
              ))
            ) : (
              <>
                <p>• VIX 지수가 하향 안정화되며 변동성·신용 팩터 점수가 방어되었습니다.</p>
                <p>• S&P500 주요 지지선 유지로 가격 추세 점수가 유지되었습니다.</p>
              </>
            )}
          </div>
        </div>

        {/* Question 2 */}
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>2. 레짐을 가장 크게 누르고 있는 지표는 무엇인가?</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-6">
            • <strong>{initialState.biggestDragFactor || "미국 10년물 국채수익률 및 유가 부담"}</strong>
          </p>
        </div>

        {/* Question 3 */}
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>3. Risk On(65점 이상)으로 전환되려면 무엇이 필요한가?</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-6">
            • {initialState.whatNeededForRiskOn || "10년물 국채금리 4.15% 하향 안착 및 유가 $80 이하 하향"}
          </p>
        </div>

        {/* Question 4 */}
        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100">
            <Sliders className="w-4 h-4 text-amber-500 shrink-0" />
            <span>4. Defensive(44점 이하)로 전락하는 실패 조건은 무엇인가?</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-6">
            • {initialState.failureConditionDefensive || "10년물 4.45% 돌파 또는 S&P500 200일선 이탈 시"}
          </p>
        </div>
      </div>
    </div>
  );
};

