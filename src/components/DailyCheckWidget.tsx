import React, { useState, useEffect } from "react";
import { 
  DailyStrategy, 
  WeeklyStrategy, 
  MonthlyStrategy, 
  StrategyNotification,
  ActionCode 
} from "../types/strategy";
import { formatKRW } from "../utils/formatters";
import { 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  RefreshCw, 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Lock, 
  Info, 
  Sliders, 
  FileText, 
  Bell, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Ban
} from "lucide-react";

interface DailyCheckWidgetProps {
  onOpenGatekeeper?: (ticker?: string) => void;
  onOpenReliabilityTest?: () => void;
}

export const DailyCheckWidget: React.FC<DailyCheckWidgetProps> = ({
  onOpenGatekeeper,
  onOpenReliabilityTest
}) => {
  const [activeHorizon, setActiveHorizon] = useState<"daily" | "weekly" | "monthly" | "notifications">("daily");
  const [dailyStrategy, setDailyStrategy] = useState<DailyStrategy | null>(null);
  const [weeklyStrategy, setWeeklyStrategy] = useState<WeeklyStrategy | null>(null);
  const [monthlyStrategy, setMonthlyStrategy] = useState<MonthlyStrategy | null>(null);
  const [notifications, setNotifications] = useState<StrategyNotification[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunningCheck, setIsRunningCheck] = useState<boolean>(false);
  const [showAllSignals, setShowAllSignals] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<DailyStrategy[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch current daily check and scheduler status
  const fetchStrategyData = async () => {
    setIsLoading(true);
    try {
      const [resDaily, resNotifs] = await Promise.all([
        fetch("/api/daily-check/current"),
        fetch("/api/notifications")
      ]);

      if (resDaily.ok) {
        const data = await resDaily.json();
        setDailyStrategy(data.strategy);
        setSchedulerStatus(data.scheduler);
      }

      if (resNotifs.ok) {
        const notifData = await resNotifs.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (err) {
      console.warn("Failed to fetch strategy from server, relying on local fallback:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch weekly strategy
  const fetchWeeklyData = async () => {
    try {
      const res = await fetch("/api/strategy/weekly");
      if (res.ok) {
        const data = await res.json();
        setWeeklyStrategy(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch monthly strategy
  const fetchMonthlyData = async () => {
    try {
      const res = await fetch("/api/strategy/monthly");
      if (res.ok) {
        const data = await res.json();
        setMonthlyStrategy(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch history
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/strategy/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStrategyData();
  }, []);

  useEffect(() => {
    if (activeHorizon === "weekly" && !weeklyStrategy) {
      fetchWeeklyData();
    } else if (activeHorizon === "monthly" && !monthlyStrategy) {
      fetchMonthlyData();
    }
  }, [activeHorizon]);

  // Execute manual run of Daily Check
  const handleRunDailyCheckNow = async () => {
    setIsRunningCheck(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/daily-check/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true })
      });

      if (res.ok) {
        const data = await res.json();
        setDailyStrategy(data.strategy);
        setSchedulerStatus(data.scheduler);
        if (data.newNotifications?.length > 0) {
          setNotifications(prev => [...data.newNotifications, ...prev]);
        }
        setStatusMessage("✅ 정량 규칙 엔진 및 일일 점검이 성공적으로 재계산되었습니다.");
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        throw new Error("Execution failed");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("⚠️ 일일 점검 실행 중 오류가 발생했습니다.");
    } finally {
      setIsRunningCheck(false);
    }
  };

  // Mark all notifications read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const getActionBadge = (action: ActionCode) => {
    switch (action) {
      case "WAIT":
        return {
          bg: "bg-slate-900 dark:bg-stone-100 text-white dark:text-stone-950",
          border: "border-slate-800 dark:border-stone-200",
          subtext: "불필요한 시장 진입 방지 (자본 보존 모드)",
          tag: "관망 (WAIT)"
        };
      case "BUY":
        return {
          bg: "bg-emerald-600 text-white",
          border: "border-emerald-700",
          subtext: "승인된 일일 한도 내 분할 매수 실행",
          tag: "분할 매수 (BUY)"
        };
      case "HOLD":
        return {
          bg: "bg-blue-600 text-white",
          border: "border-blue-700",
          subtext: "목표 자산 배분 비중 유지 (추가 매수 대기)",
          tag: "보유 (HOLD)"
        };
      case "REDUCE":
        return {
          bg: "bg-rose-600 text-white",
          border: "border-rose-700",
          subtext: "시장 위험 가중, 주식성 자산 축소 및 현금 회수",
          tag: "비중 축소 (REDUCE)"
        };
      case "DATA_BLOCKED":
      default:
        return {
          bg: "bg-amber-500 text-stone-950",
          border: "border-amber-600",
          subtext: "시세 신선도 미달로 주문 산출 안전 차단",
          tag: "데이터 확인 (BLOCKED)"
        };
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Horizon Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveHorizon("daily")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeHorizon === "daily"
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>DAILY CHECK (일일)</span>
          </button>

          <button
            onClick={() => setActiveHorizon("weekly")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeHorizon === "weekly"
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>주간 전략 (Weekly)</span>
          </button>

          <button
            onClick={() => setActiveHorizon("monthly")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeHorizon === "monthly"
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>월간 계획 (Monthly)</span>
          </button>

          <button
            onClick={() => setActiveHorizon("notifications")}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeHorizon === "notifications"
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>알림 &amp; 이력</span>
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={handleRunDailyCheckNow}
          disabled={isRunningCheck}
          title="지금 즉시 정량 데이터와 규칙 엔진을 재평가합니다"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRunningCheck ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{isRunningCheck ? "계산 중..." : "즉시 재계산"}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="opacity-60 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DAILY CHECK HORIZON VIEW                                               */}
      {/* ========================================================================= */}
      {activeHorizon === "daily" && dailyStrategy && (
        <div className="space-y-4">
          {/* Main Hero Card: Today's Action Guidelines */}
          {(() => {
            const badge = getActionBadge(dailyStrategy.actionCode);
            return (
              <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
                  <div>
                    <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                      <span>Investment OS 일일 확정 지침</span>
                      <span className="w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-700" />
                      <span className="font-mono">{dailyStrategy.asOf.replace("T", " ").substring(0, 16)} KST</span>
                    </div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                      오늘 할 일: {badge.tag}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-mono text-[11px]">
                      {schedulerStatus?.isUsDaylightSaving ? "EDT 서머타임 (개장 22:30)" : "EST 표준시 (개장 23:30)"}
                    </span>
                    <button
                      onClick={() => {
                        fetchHistory();
                        setShowHistoryModal(true);
                      }}
                      className="px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-medium"
                    >
                      과거 이력
                    </button>
                  </div>
                </div>

                {/* Big Action Badge & Order Limit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`rounded-xl p-4 border ${badge.border} ${badge.bg} flex flex-col justify-between shadow-2xs`}>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">
                        DETERMINISTIC ACTION
                      </div>
                      <div className="text-2xl font-black tracking-tight mt-1">
                        {dailyStrategy.actionCode}
                      </div>
                      <p className="text-xs opacity-90 mt-1">
                        {badge.subtext}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-current/20 flex items-center justify-between text-xs">
                      <span>거시 레짐: {dailyStrategy.regime}</span>
                      <span className="font-mono font-bold">{dailyStrategy.regimeScore ?? "-"}점</span>
                    </div>
                  </div>

                  <div className="rounded-xl p-4 bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                        오늘의 주문 허용 한도
                      </div>
                      <div className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1 font-mono">
                        {dailyStrategy.dailyOrderLimitKRW === 0 ? "0원 (주문 락)" : formatKRW(dailyStrategy.dailyOrderLimitKRW)}
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        {dailyStrategy.dailyOrderLimitKRW === 0
                          ? "오늘 규정상 신규 매수가 전면 금지되어 충동 매매를 차단합니다."
                          : "승인된 분할 매수 한도 내에서만 진입 가능합니다."}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                      <span className="text-stone-500 dark:text-stone-400">배분 부족분:</span>
                      <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                        {formatKRW(dailyStrategy.allocationGapKRW)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock Weight vs Target Gap Progress */}
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/40 border border-stone-200/80 dark:border-stone-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700 dark:text-stone-300">
                      주식성 목표 비중 대비 현재 격차
                    </span>
                    <span className="font-mono text-stone-600 dark:text-stone-400">
                      현재 {(dailyStrategy.currentStockWeight * 100).toFixed(1)}% / 목표 {(dailyStrategy.targetStockWeight * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, dailyStrategy.currentStockWeight * 100)}%` }}
                    />
                    <div 
                      className="bg-amber-400 h-full opacity-60" 
                      style={{ width: `${Math.max(0, (dailyStrategy.targetStockWeight - dailyStrategy.currentStockWeight) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-0.5">
                    <span>자산 총액: {formatKRW(dailyStrategy.totalPortfolioKRW)}</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      부족분 +{((dailyStrategy.targetStockWeight - dailyStrategy.currentStockWeight) * 100).toFixed(1)}%p ({formatKRW(dailyStrategy.allocationGapKRW)})
                    </span>
                  </div>
                </div>

                {/* Event Restriction Warning */}
                {dailyStrategy.eventRestrictionActive && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">거시 이벤트 냉각 잠금: </span>
                      <span>{dailyStrategy.activeEventName}. 이벤트 통과 전 변동성 관리를 위해 주문 한도가 0원으로 축소되었습니다.</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 7 SGOV Signals Status */}
          <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>SGOV 7대 투입 신호 검증 상태</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  7개 조건 중 {dailyStrategy.sgovSignalCount}개 충족 (단계: {dailyStrategy.sgovSignalCount < 3 ? "관망 0%" : dailyStrategy.sgovSignalCount < 5 ? "탐색 20%" : "분할 투입"})
                </p>
              </div>

              <button
                onClick={() => setShowAllSignals(!showAllSignals)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"
              >
                <span>{showAllSignals ? "간략히" : "7개 전체 보기"}</span>
                {showAllSignals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Signal Mini Pills */}
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {dailyStrategy.sgovSignals.map((sig, idx) => (
                <div
                  key={sig.signalId}
                  className={`py-1.5 rounded-lg text-center text-[10px] font-bold border transition-colors ${
                    sig.passed
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                      : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400"
                  }`}
                  title={`${sig.name}: ${sig.passed ? "충족" : "미충족"} (${sig.threshold})`}
                >
                  #{idx + 1} {sig.passed ? "✓" : "✗"}
                </div>
              ))}
            </div>

            {/* Detailed Signal List if expanded */}
            {showAllSignals && (
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                {dailyStrategy.sgovSignals.map((sig) => (
                  <div 
                    key={sig.signalId}
                    className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        {sig.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Ban className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        )}
                        <span>{sig.name}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 pl-5">
                        {sig.rationale}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sig.passed
                          ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                          : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                      }`}>
                        {sig.passed ? "충족" : "기준 미달"}
                      </span>
                      <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                        기준: {sig.threshold}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Eligible Assets vs Blocked Assets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Priority Eligible Assets */}
            <div className="rounded-2xl p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>매수 승인 우선 자산</span>
                </span>
                <span className="text-[10px] text-stone-500 font-mono">우선순위 순</span>
              </div>
              <div className="space-y-1.5">
                {dailyStrategy.eligibleAssets.map((asset, idx) => (
                  <div 
                    key={asset}
                    className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-stone-850/50 text-xs"
                  >
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {idx + 1}. {asset}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      진입 가능
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Blocked Assets */}
            <div className="rounded-2xl p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  <span>매수 절대 금지 자산</span>
                </span>
                <span className="text-[10px] text-stone-500 font-mono">안전 수칙</span>
              </div>
              <div className="space-y-1.5">
                {dailyStrategy.blockedAssets.map((asset) => (
                  <div 
                    key={asset}
                    className="flex items-center justify-between p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs"
                  >
                    <span className="font-semibold text-rose-900 dark:text-rose-300">
                      {asset}
                    </span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                      매수 차단
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI CIO Commentary Box (Deterministic Verifiable Explanation) */}
          <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    CIO 데일리 해설 &amp; 시나리오 점검
                  </h3>
                  <p className="text-[10px] text-stone-500 font-mono">
                    엔진: {dailyStrategy.aiCommentary?.modelUsed || "Gemini 3.8 Flash"} (불변 해시 검증)
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 truncate max-w-[120px]" title={`SHA-256: ${dailyStrategy.deterministicResultHash}`}>
                #{dailyStrategy.deterministicResultHash.substring(0, 8)}
              </span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-stone-700 dark:text-stone-300">
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {dailyStrategy.aiCommentary?.summary}
              </p>

              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 space-y-1">
                <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                  결정 근거 (Why this action):
                </span>
                <p className="text-stone-800 dark:text-stone-200 text-xs">
                  {dailyStrategy.aiCommentary?.whyThisAction}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 space-y-1">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>반대 시나리오 (Counter Thesis):</span>
                </span>
                <p className="text-stone-800 dark:text-stone-300 text-xs">
                  {dailyStrategy.aiCommentary?.counterThesis}
                </p>
              </div>

              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 pt-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>차기 관찰 포인트: {dailyStrategy.aiCommentary?.whatToWatchNext}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Footer Link to Gatekeeper */}
          {onOpenGatekeeper && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>주문 브레이크 (Trade Gatekeeper)</span>
                </div>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  당일 산출된 주문한도와 원칙을 사전 모의 심사합니다.
                </p>
              </div>

              <button
                onClick={() => onOpenGatekeeper("VOO")}
                className="px-3 py-1.5 rounded-lg bg-white text-stone-950 text-xs font-bold hover:bg-stone-100 transition-colors shrink-0"
              >
                심사하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WEEKLY STRATEGY HORIZON VIEW                                           */}
      {/* ========================================================================= */}
      {activeHorizon === "weekly" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-mono text-stone-500">주간 거시 리스크 및 예산 배분</span>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {weeklyStrategy?.weekRange || "2026년 9월 2주차 주간 전략"}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">레짐 추세</span>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
                  {weeklyStrategy?.regimeTrend || "Neutral 유지 (56점)"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">주간 위험 예산</span>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 font-mono">
                  {weeklyStrategy ? formatKRW(weeklyStrategy.maxRiskBudgetKRW) : "1,500만원"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">주간 누적 성과</span>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  +{weeklyStrategy?.weeklyReturnPct || 1.42}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                주간 핵심 거시 일정 (Next Week Calendar)
              </span>
              <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                {weeklyStrategy?.keyEventsNextWeek.map((evt) => (
                  <li key={evt} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>{evt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-2">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                AI 주간 브리핑 &amp; 원칙
              </span>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                {weeklyStrategy?.aiWeeklySummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MONTHLY STRATEGY HORIZON VIEW                                          */}
      {/* ========================================================================= */}
      {activeHorizon === "monthly" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-mono text-stone-500">월간 자산 배분 및 MDD 방어 계획</span>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {monthlyStrategy?.monthLabel || "2026년 9월 운용계획서"}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">당월 MDD</span>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 font-mono">
                  {monthlyStrategy?.mddPct || -2.1}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">원칙 준수율</span>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {monthlyStrategy?.ruleComplianceRate || 92.5}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[11px] text-stone-500 font-medium">평균 현금(SGOV) 비중</span>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 font-mono">
                  {monthlyStrategy?.cashWeightAvgPct || 58.2}%
                </div>
              </div>
            </div>

            {/* Target Allocation Plan Matrix */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                레짐별 목표 자산 배분 매트릭스
              </span>
              <div className="space-y-2">
                {monthlyStrategy?.targetAllocationPlan.map((plan) => (
                  <div 
                    key={plan.regime}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {plan.regime}
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {plan.actionNote}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono font-semibold">
                      <span className="text-blue-600">주식 {(plan.targetStockWeight * 100).toFixed(0)}%</span>
                      <span className="text-stone-400">/</span>
                      <span className="text-amber-600">현금 {(plan.targetCashWeight * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Monthly Plan Philosophy */}
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-2">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                월간 운용 총평 (CIO Perspective)
              </span>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                {monthlyStrategy?.aiMonthlyPlan}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. NOTIFICATIONS & CHANGES LOG                                            */}
      {/* ========================================================================= */}
      {activeHorizon === "notifications" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              전략 변동 &amp; 안전 경보 이력 ({notifications.length}건)
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllNotificationsRead}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                모두 읽음 처리
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              수신된 전략 변동 알림이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    notif.read
                      ? "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                      : "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-stone-900 dark:text-stone-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span className="font-semibold">{notif.type}</span>
                    <span className="font-mono">{new Date(notif.timestamp).toLocaleString("ko-KR")}</span>
                  </div>
                  <div className="text-xs font-bold mt-1">
                    {notif.title}
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                    {notif.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                과거 일일 점검(DAILY CHECK) 스냅샷 이력
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-stone-500 hover:text-stone-900">
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {historyList.map((hist) => (
                <div 
                  key={hist.strategyId}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                      {hist.asOf.substring(0, 10)} ({hist.regime})
                    </div>
                    <p className="text-[11px] text-stone-500">
                      지침: {hist.actionCode} | 한도: {formatKRW(hist.dailyOrderLimitKRW)}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                    {hist.actionCode}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
