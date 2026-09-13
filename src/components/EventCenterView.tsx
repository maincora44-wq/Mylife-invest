import React, { useState, useEffect } from "react";
import { MacroEvent } from "../types";
import { formatKRW } from "../utils/formatters";
import { analyzeEventTime } from "../utils/timeUtils";
import { 
  Calendar, 
  Lock, 
  Unlock, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Radio
} from "lucide-react";

interface EventCenterViewProps {
  events: MacroEvent[];
  onToggleLock: (eventId: string) => void;
  onSyncGeminiLive?: () => void;
  isSyncing?: boolean;
}

export const EventCenterView: React.FC<EventCenterViewProps> = ({
  events,
  onToggleLock,
  onSyncGeminiLive,
  isSyncing = false,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.eventId || "");
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Real-time clock ticker every 30 seconds for dynamic D-Day and countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const selectedEvent = events.find((e) => e.eventId === selectedEventId) || events[0];

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Event Center (거시 이벤트 관제)</span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
              실시간 잠금 규칙
            </span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            FOMC, CPI 발표 전후 뇌동매매를 방지하기 위해 실시간 카운트다운 및 주문 상한을 강제합니다
          </p>
        </div>

        {onSyncGeminiLive && (
          <button
            onClick={onSyncGeminiLive}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors self-start sm:self-auto shrink-0 shadow-xs"
          >
            <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "캘린더 검색 동기화 중..." : "Gemini 실시간 캘린더 동기화"}</span>
          </button>
        )}
      </div>

      {/* Event Timeline List with Dynamic Real-time Calculations */}
      <div className="space-y-2.5">
        {events.map((ev) => {
          const timeInfo = analyzeEventTime(ev.eventTimeKST, ev.coolingPeriodMin, currentTime);

          return (
            <div
              key={ev.eventId}
              onClick={() => setSelectedEventId(ev.eventId)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedEventId === ev.eventId
                  ? "bg-white dark:bg-stone-900 border-blue-600 dark:border-blue-500 shadow-md ring-1 ring-blue-600/30"
                  : "bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 shadow-xs hover:border-stone-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* D-Day badge */}
                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-full font-mono ${
                        timeInfo.isToday
                          ? "bg-rose-600 text-white animate-pulse"
                          : timeInfo.dDay > 0 && timeInfo.dDay <= 3
                          ? "bg-amber-500 text-white"
                          : "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900"
                      }`}
                    >
                      {timeInfo.dDayBadge}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        ev.importance === "CRITICAL"
                          ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {ev.importance}
                    </span>

                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {ev.eventName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600 dark:text-stone-300">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {ev.eventTimeKST}
                    </span>
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {timeInfo.countdownText}
                    </span>
                  </div>

                  {timeInfo.isCoolingActive && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold animate-pulse">
                      <Radio className="w-3 h-3 text-rose-600 animate-ping" />
                      <span>실시간 냉각(Cooling) 잠금 가동 중: 발표 전후 {ev.coolingPeriodMin}분 주문 전면 동결</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(ev.eventId);
                  }}
                  className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors shrink-0 ${
                    ev.isLocked
                      ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                  }`}
                >
                  {ev.isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      <span>잠금 ON</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>잠금 OFF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 text-center text-[10px]">
                <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                  <span className="text-stone-600 dark:text-stone-300 block">발표 후 냉각</span>
                  <strong className="text-stone-800 dark:text-stone-200 text-xs font-mono">{ev.coolingPeriodMin}분 금지</strong>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                  <span className="text-stone-600 dark:text-stone-300 block">첫날 계획 상한</span>
                  <strong className="text-stone-800 dark:text-stone-200 text-xs font-mono">{ev.firstDayCapPct}%</strong>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-lg">
                  <span className="text-stone-600 dark:text-stone-300 block">고베타 예산</span>
                  <strong className="text-stone-800 dark:text-stone-200 text-xs font-mono">평시의 {ev.highBetaRiskBudgetPct}%</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Event Scenarios Drilldown */}
      {selectedEvent && (
        <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              {selectedEvent.eventName} 대응 시나리오
            </h2>
            <span className="text-xs text-stone-600 dark:text-stone-300">
              오늘 허용 주문액: <strong className="text-stone-900 dark:text-stone-100">{formatKRW(selectedEvent.allowedOrderKRW)}</strong>
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 space-y-1">
              <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                기본 시나리오 (Base Case)
              </span>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 pl-3.5">
                {selectedEvent.baseScenario}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/60 space-y-1">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                낙관 시나리오 (Bull Case)
              </span>
              <p className="text-[11px] text-emerald-950 dark:text-emerald-200 pl-5">
                {selectedEvent.bullScenario}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/60 space-y-1">
              <span className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                비관 시나리오 (Bear Case)
              </span>
              <p className="text-[11px] text-rose-950 dark:text-rose-200 pl-5">
                {selectedEvent.bearScenario}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>이벤트 잠금 작동 시:</strong> 발표 직후 30분간 신규 주문 입력이 원천 차단되며, 당일에는 전체 위험예산의 25% 이내에서만 분할 매수가 허용됩니다.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
