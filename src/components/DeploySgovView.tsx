import React, { useState } from "react";
import { SgovSignalItem, SgovDeploymentPlan } from "../types";
import { formatKRW } from "../utils/formatters";
import { 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface DeploySgovViewProps {
  signals: SgovSignalItem[];
  plan: SgovDeploymentPlan;
  onDeployOrder: (asset: string, amountKRW: number) => void;
}

export const DeploySgovView: React.FC<DeploySgovViewProps> = ({
  signals,
  plan,
  onDeployOrder,
}) => {
  const [expandedSignalId, setExpandedSignalId] = useState<number | null>(null);

  const passedCount = signals.filter((s) => s.passed).length;
  const passRate = (passedCount / signals.length) * 100;

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Deploy SGOV (단기채 재투입 판정)</span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {passedCount} / {signals.length} 조건 충족
            </span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            데이터 수집 엔진이 7대 조건을 자동 판정하여 투입 단계와 한도를 산출합니다
          </p>
        </div>
      </div>

      {/* Decision Summary Card */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-start justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">권고 투입 단계</span>
            <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-0.5">
              {plan.recommendedStage}
            </div>
            <div className="text-xs text-stone-600 dark:text-stone-300 mt-1">
              허용 투입률: 계획금액의 <strong className="text-blue-600 dark:text-blue-400">{plan.allowedRatePct}%</strong>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">오늘 재투입 한도</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatKRW(plan.todayLimitKRW)}
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-1">
              SGOV 잔여: 약 1.58억원
            </div>
          </div>
        </div>

        {/* Progress Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-stone-600 dark:text-stone-300">조건 충족률</span>
            <span className="font-mono text-stone-900 dark:text-stone-100 font-bold">{passedCount} / 7 ({passRate.toFixed(0)}%)</span>
          </div>
          <div className="h-2.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                passedCount >= 6
                  ? "bg-emerald-500"
                  : passedCount >= 4
                  ? "bg-blue-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${passRate}%` }}
            />
          </div>
          <div className="text-[10px] text-stone-600 dark:text-stone-300 flex justify-between">
            <span>0~3개: 관망 (0%)</span>
            <span>4~5개: 1차 탐색 (40%)</span>
            <span>6~7개: 2차/전액 (70~100%)</span>
          </div>
        </div>
      </div>

      {/* 7 Automated Signals List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
            SGOV 7대 판정 신호 (실시간 근거)
          </h2>
          <span className="text-[11px] text-stone-600 dark:text-stone-300">
            클릭하여 세부 데이터 확인
          </span>
        </div>

        <div className="space-y-2">
          {signals.map((signal) => {
            const isExpanded = expandedSignalId === signal.id;
            return (
              <div
                key={signal.id}
                className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {signal.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <span>{signal.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-normal">
                          기준: {signal.threshold}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                        현재값: <strong className="text-stone-800 dark:text-stone-200 font-mono">{signal.currentVal}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        signal.passed
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {signal.passed ? "충족" : "미충족"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-stone-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-600" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 bg-stone-50/50 dark:bg-stone-800/30 space-y-1">
                    <p className="font-medium text-stone-800 dark:text-stone-200">
                      세부 조건: {signal.detail}
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      판정 이유: {signal.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment Priority List (투입 우선순위 목록) */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
            투입 자산 우선순위 매트릭스
          </h2>
          <span className="text-[11px] text-stone-600 dark:text-stone-300">
            자산배분 위험예산 순차 배분
          </span>
        </div>

        <div className="space-y-2.5">
          {plan.priorities.map((item) => (
            <div
              key={item.rank}
              className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.rank}
                </span>
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {item.asset}
                  </div>
                  <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                    {item.description}
                  </div>
                  <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                    근거: {item.rationale}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDeployOrder(item.asset, Math.min(5000000, plan.todayLimitKRW))}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-stone-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 hover:bg-blue-50 transition-colors shrink-0"
              >
                검토 요청
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
