import React, { useState } from "react";
import { RegimeState } from "../types";
import { formatKRW, formatPct } from "../utils/formatters";
import { 
  Bell, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ExternalLink,
  MessageSquare
} from "lucide-react";

interface TeamsAdaptiveCardViewProps {
  state: RegimeState;
  onOpenGatekeeper: () => void;
  onNavigateTab: (tab: string) => void;
}

export const TeamsAdaptiveCardView: React.FC<TeamsAdaptiveCardViewProps> = ({
  state,
  onOpenGatekeeper,
  onNavigateTab,
}) => {
  const [activeCard, setActiveCard] = useState<"morning" | "risk" | "fomo">("morning");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAction = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Microsoft Teams Adaptive Card 모바일 알림</span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Power Automate가 매일 07:30 및 이상 징후 감지 시 모바일 Teams로 발송하는 대화형 카드
          </p>
        </div>
      </div>

      {/* Card Type Selector */}
      <div className="flex gap-1.5 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveCard("morning")}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeCard === "morning"
              ? "bg-[#464EB8] text-white shadow-xs"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
          }`}
        >
          🌅 07:30 아침 데일리 리포트
        </button>
        <button
          onClick={() => setActiveCard("risk")}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeCard === "risk"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
          }`}
        >
          🚨 거시 이벤트 D-1 긴급 알림
        </button>
        <button
          onClick={() => setActiveCard("fomo")}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeCard === "fomo"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
          }`}
        >
          🛑 FOMO 감지 브레이크 알림
        </button>
      </div>

      {/* Action Notification Toast */}
      {actionFeedback && (
        <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Teams Shell Simulation */}
      <div className="max-w-md mx-auto rounded-3xl bg-[#F0F0F0] dark:bg-[#1E1E1E] p-3 sm:p-4 border border-stone-300 dark:border-stone-800 shadow-xl space-y-3">
        {/* Teams Header */}
        <div className="flex items-center justify-between px-2 pb-2 border-b border-stone-200 dark:border-stone-800 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#464EB8] text-white font-bold flex items-center justify-center text-[10px]">
              T
            </div>
            <span className="font-bold text-stone-800 dark:text-stone-200">
              Teams · Investment Bot
            </span>
          </div>
          <span className="text-[10px] text-stone-600 dark:text-stone-300">오늘 07:30</span>
        </div>

        {/* 1. Morning Card */}
        {activeCard === "morning" && (
          <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 space-y-3 shadow-sm text-xs">
            {/* Title */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <h3 className="font-bold text-stone-900 dark:text-stone-100">
                  [DAILY CHECK] 오늘의 투자 관제 상황
                </h3>
              </div>
              <span className="text-[10px] font-mono text-stone-600 dark:text-stone-300">
                {state.asOf}
              </span>
            </div>

            {/* Content Fields */}
            <div className="space-y-2 text-stone-700 dark:text-stone-300">
              <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-600 dark:text-stone-300">시장 레짐</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {state.regime} ({state.regimeScore}점, 신뢰도 {Math.round(state.confidence * 100)}%)
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-600 dark:text-stone-300">주식 비중</span>
                <span className="font-mono">
                  현재 {formatPct(state.currentStockWeight)} / 목표 {formatPct(state.targetStockWeight)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-600 dark:text-stone-300">부족 비중 / 잠정 여유</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {state.shortageWeightPct}%p ({formatKRW(state.deployableAmountKRW)})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-600 dark:text-stone-300">오늘의 권고 행동</span>
                <span className="px-2 py-0.5 rounded font-black bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                  {state.action} (최대한도: {formatKRW(state.dailyMaxOrderKRW)})
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-stone-600 dark:text-stone-300">다음 주요 이벤트</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {state.nextEvent} (D-1일 전)
                </span>
              </div>
            </div>

            {/* Interactive Adaptive Card Buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  handleAction("아침 서약 및 DAILY CHECK가 기록되었습니다.");
                }}
                className="w-full py-2 rounded-xl bg-[#464EB8] hover:bg-[#3B429F] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>오늘의 원칙 서약 &amp; 체크 기록</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenGatekeeper}
                  className="py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-[11px] hover:bg-stone-200 transition-colors"
                >
                  Gatekeeper 열기
                </button>
                <button
                  onClick={() => onNavigateTab("portfolio")}
                  className="py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-semibold text-[11px] hover:bg-stone-200 transition-colors"
                >
                  포트폴리오 조회
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Risk Card */}
        {activeCard === "risk" && (
          <div className="rounded-2xl bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-900 p-4 space-y-3 shadow-sm text-xs">
            <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-rose-700 dark:text-rose-400">
                [경고] FOMC 금리결정 D-1일 전 이벤트 락 발동
              </h3>
            </div>
            <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
              발표 전후 30분 동안 충동 주문이 자동 차단되며, 금일 신규 진입 시 1회 주문 한도가 500만원 및 고베타 위험예산 50%로 제한됩니다.
            </p>
            <button
              onClick={() => onNavigateTab("events")}
              className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              이벤트 대응 시나리오 확인
            </button>
          </div>
        )}

        {/* 3. FOMO Card */}
        {activeCard === "fomo" && (
          <div className="rounded-2xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-900 p-4 space-y-3 shadow-sm text-xs">
            <div className="flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-amber-800 dark:text-amber-400">
                [주문 브레이크] 급등주 추격매수 감지
              </h3>
            </div>
            <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
              장중 단기 급등 종목을 매수하려는 시도가 감지되었습니다. 사전에 손절가 및 무효화 시나리오를 작성하지 않은 주문은 Gatekeeper에서 REJECT됩니다.
            </p>
            <button
              onClick={onOpenGatekeeper}
              className="w-full py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs"
            >
              Gatekeeper에서 사전 검토 작성
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
