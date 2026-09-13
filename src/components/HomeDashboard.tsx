import React, { useState } from "react";
import { 
  RegimeState, 
  MarketIndicator, 
  ActionType 
} from "../types";
import { formatKRW, formatPct } from "../utils/formatters";
import { 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  ShieldCheck, 
  Zap, 
  ArrowUpRight, 
  Compass,
  Play,
  RotateCcw,
  LineChart
} from "lucide-react";

interface HomeDashboardProps {
  state: RegimeState;
  indicators: MarketIndicator[];
  onNavigateTab: (tabId: string) => void;
  onOpenGatekeeperFor: (ticker?: string) => void;
  onRunDailyCheck: () => void;
  onOpenReliabilityTest?: () => void;
  onOpenDailyCheckView?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  state,
  indicators,
  onNavigateTab,
  onOpenGatekeeperFor,
  onRunDailyCheck,
  onOpenReliabilityTest,
  onOpenDailyCheckView,
}) => {
  const [dailyCheckCompleted, setDailyCheckCompleted] = useState(false);
  const [showDailyCheckModal, setShowDailyCheckModal] = useState(false);

  const getActionColor = (action: ActionType) => {
    switch (action) {
      case "BUY":
        return "bg-emerald-600 text-white";
      case "WAIT":
        return "bg-amber-500 text-stone-950";
      case "REDUCE":
        return "bg-rose-600 text-white";
      case "HOLD":
      default:
        return "bg-blue-600 text-white";
    }
  };

  const getTrafficColor = (status: "green" | "yellow" | "red") => {
    switch (status) {
      case "green":
        return "bg-emerald-500 text-white dark:bg-emerald-600";
      case "red":
        return "bg-rose-500 text-white dark:bg-rose-600";
      case "yellow":
      default:
        return "bg-amber-400 text-stone-900 dark:bg-amber-500";
    }
  };

  const handleExecuteDailyCheck = () => {
    setDailyCheckCompleted(true);
    setShowDailyCheckModal(false);
    onRunDailyCheck();
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner: 1-Minute Routine Status */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>아침 1분 상황판</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              {state.asOf}
            </span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            당일 허용 주문한도 및 레짐 판단 확인 후 주문 브레이크 적용
          </p>
        </div>

        <button
          onClick={() => {
            if (onOpenDailyCheckView) {
              onOpenDailyCheckView();
            } else {
              setShowDailyCheckModal(true);
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
            dailyCheckCompleted
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90"
          }`}
        >
          {dailyCheckCompleted ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>오늘 완료</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>DAILY CHECK</span>
            </>
          )}
        </button>
      </div>

      {/* Main Status Board Card */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-4">
        {/* Row 1: Regime & Action */}
        <div className="flex items-start justify-between border-b border-stone-100 dark:border-stone-800 pb-4">
          <div>
            <div className="text-xs font-medium text-stone-600 dark:text-stone-300">
              오늘의 시장 레짐
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100">
                {state.regime}
              </span>
              <span className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                {state.regimeScore} <span className="text-xs font-normal text-stone-600 dark:text-stone-300">/ 100점</span>
              </span>
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
              신뢰도 {Math.round(state.confidence * 100)}% · 전일 대비 변동 없음
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-medium text-stone-600 dark:text-stone-300">
              오늘의 권고 행동
            </div>
            <div className="mt-1 flex justify-end">
              <span
                className={`px-3.5 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-wider shadow-xs flex items-center gap-1.5 ${getActionColor(
                  state.action
                )}`}
              >
                <Compass className="w-4 h-4" />
                {state.action}
              </span>
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 mt-1">
              오늘 최대 주문: <strong className="text-stone-800 dark:text-stone-200">{formatKRW(state.dailyMaxOrderKRW)}</strong>
            </div>
          </div>
        </div>

        {/* Row 2: Equity Allocation Gap */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-stone-600 dark:text-stone-300 font-medium">
              주식성 비중: <strong className="text-stone-900 dark:text-stone-100">{formatPct(state.currentStockWeight)}</strong>
            </span>
            <span className="text-stone-600 dark:text-stone-300">
              목표 비중: <strong className="text-stone-800 dark:text-stone-200">{formatPct(state.targetStockWeight)}</strong>
            </span>
          </div>

          {/* Allocation Progress Bar */}
          <div className="h-3 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden flex relative">
            <div
              className="h-full bg-blue-600 rounded-l-full transition-all duration-500"
              style={{ width: `${state.currentStockWeight * 100}%` }}
              title={`현재 주식성 ${formatPct(state.currentStockWeight)}`}
            />
            <div
              className="h-full bg-blue-200 dark:bg-blue-900/60 border-l border-r border-blue-400 dark:border-blue-500 transition-all duration-500"
              style={{ width: `${state.shortageWeightPct}%` }}
              title={`부족 비중 ${state.shortageWeightPct}%p`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300 pt-0.5">
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="w-3 h-3" />
              부족 비중: {state.shortageWeightPct}%p
            </span>
            <span>
              잠정 추가 가능액: <strong className="text-stone-800 dark:text-stone-200">{formatKRW(state.deployableAmountKRW)}</strong>
            </span>
          </div>
        </div>

        {/* Row 3: Next Event Callout */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-rose-500" />
            <div>
              <span className="font-semibold text-stone-900 dark:text-stone-100">다음 주요 이벤트: {state.nextEvent}</span>
              <span className="text-[11px] text-stone-600 dark:text-stone-300 ml-2">D-1일 전</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            이벤트 잠금 ON
          </span>
        </div>
      </div>

      {/* Traffic Light Boundary Indicators (핵심 경계지표 7개) */}
      <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              핵심 경계지표 7개 신호등 (야후 파이낸스 실시간)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenReliabilityTest && (
              <button
                onClick={onOpenReliabilityTest}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 transition-colors"
                title="야후 파이낸스 실시간 데이터 신뢰성 테스트"
              >
                <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>데이터 신뢰성 검증</span>
              </button>
            )}
            <span className="text-[11px] text-stone-600 dark:text-stone-300 hidden sm:inline">
              실시간 임계치 검증
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {indicators.map((ind) => (
            <div
              key={ind.symbol}
              className="p-3 rounded-xl bg-stone-50/70 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                  {ind.metric}
                </span>
                <span
                  className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${getTrafficColor(
                    ind.status
                  )}`}
                  title={ind.status.toUpperCase()}
                />
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-bold font-mono text-stone-900 dark:text-stone-100">
                  {ind.value}
                </span>
                <span
                  className={`text-[10px] font-mono font-medium ${
                    ind.change.startsWith("+")
                      ? "text-emerald-700 dark:text-emerald-300"
                      : ind.change.startsWith("-")
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-stone-600 dark:text-stone-300"
                  }`}
                >
                  {ind.change}
                </span>
              </div>

              <div className="text-[10px] text-stone-600 dark:text-stone-300 truncate mt-1">
                {ind.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Matrix (모바일 최적화 5개 버튼) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        <button
          onClick={() => onOpenGatekeeperFor()}
          className="p-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex flex-col items-center justify-center gap-1.5 shadow-sm transition-all text-center"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>매수 검토 (Gatekeeper)</span>
        </button>

        <button
          onClick={() => onNavigateTab("sgov")}
          className="p-3 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all text-center"
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          <span>SGOV 재투입 (4/7)</span>
        </button>

        <button
          onClick={() => onNavigateTab("chart")}
          className="p-3 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all text-center"
        >
          <LineChart className="w-4 h-4 text-emerald-600" />
          <span>기술적 차트 (20·60·200선)</span>
        </button>

        <button
          onClick={() => onNavigateTab("portfolio")}
          className="p-3 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all text-center"
        >
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span>포트폴리오 실질노출</span>
        </button>

        <button
          onClick={() => onNavigateTab("regime")}
          className="p-3 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all text-center"
        >
          <Compass className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span>레짐 정밀 진단</span>
        </button>

        <button
          onClick={() => onNavigateTab("journal")}
          className="p-3 rounded-xl bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-850 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all text-center col-span-2 sm:col-span-1"
        >
          <Clock className="w-4 h-4 text-stone-600 dark:text-stone-300" />
          <span>결정 저널 복기</span>
        </button>
      </div>

      {/* Daily Check Interactive Modal */}
      {showDailyCheckModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                  07:30
                </div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  매일 아침 1분 DAILY CHECK 루틴
                </h3>
              </div>
              <button
                onClick={() => setShowDailyCheckModal(false)}
                className="text-stone-600 hover:text-stone-800 dark:text-stone-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-600 dark:text-stone-300">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 space-y-1.5">
                <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>오늘 시장 상태 요약 확인</span>
                </div>
                <p>• 레짐: Neutral (56점) / 오늘 권고 행동: <strong>WAIT</strong></p>
                <p>• 일일 허용 주문 한도: <strong>500만원</strong> (계획 외 추가 매수 금지)</p>
                <p>• 주의: FOMC D-1로 인해 장중 급등주 추격매수 금지 락 작동 중</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Gatekeeper 원칙 서약
                </span>
                <p className="text-[11px] leading-relaxed">
                  "나는 오늘 장중 시세 창을 반복 확인하지 않으며, 매수 버튼을 누르기 전 반드시 사유·손절가·목표가를 입력하고 Gatekeeper 승인을 받는다."
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDailyCheckModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
              >
                닫기
              </button>
              <button
                onClick={handleExecuteDailyCheck}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90 flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                서약 완료 및 체크 기록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
