import React from "react";
import { 
  ShieldAlert, 
  Smartphone, 
  Monitor, 
  Bell, 
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  Camera,
  Sparkles,
  Radio,
  ShieldCheck
} from "lucide-react";
import { RegimeType } from "../types";

interface NavbarProps {
  currentRegime: RegimeType;
  regimeScore: number;
  isMobileFrame: boolean;
  setIsMobileFrame: (val: boolean) => void;
  unreadCount: number;
  onOpenTeamsCards: () => void;
  onOpenTechnicalChart: () => void;
  onRefreshPythonState: () => void;
  isRefreshing: boolean;
  onOpenCaptureModal?: () => void;
  isLiveGrounded?: boolean;
  lastSyncedAt?: string;
  onOpenReliabilityTest?: () => void;
  onOpenDailyCheck?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRegime,
  regimeScore,
  isMobileFrame,
  setIsMobileFrame,
  unreadCount,
  onOpenTeamsCards,
  onOpenTechnicalChart,
  onRefreshPythonState,
  isRefreshing,
  onOpenCaptureModal,
  isLiveGrounded = false,
  lastSyncedAt,
  onOpenReliabilityTest,
  onOpenDailyCheck,
}) => {
  const getRegimeBadge = () => {
    switch (currentRegime) {
      case "Risk On":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Defensive":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "Neutral":
      default:
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    }
  };

  const formatSyncTime = (iso?: string) => {
    if (!iso) return "방금 전";
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand and Status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 dark:bg-stone-100 flex items-center justify-center text-white dark:text-stone-900 font-bold text-sm shadow-sm shrink-0">
            OS
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm sm:text-base tracking-tight">
                Investment OS
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
                Gemini
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
              개인용 실시간 투자 관제 &amp; 주문 브레이크
            </p>
          </div>
        </div>

        {/* Center: Live Regime Indicator & Gemini Grounding Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onOpenDailyCheck}
            title="오늘의 DAILY CHECK 및 일일 전략 열기"
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold border transition-transform hover:scale-105 ${getRegimeBadge()}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{currentRegime}</span>
            <span className="text-[10px] sm:text-[11px] opacity-80 font-mono">({regimeScore}점)</span>
          </button>

          {onOpenDailyCheck && (
            <button
              onClick={onOpenDailyCheck}
              title="DAILY CHECK 일일 지침 및 전략 엔진 열기"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <span>☀️ DAILY CHECK</span>
            </button>
          )}

          <button
            onClick={onRefreshPythonState}
            title={`야후 파이낸스 호가 & Gemini 매크로 실시간 동기화 (최근: ${formatSyncTime(lastSyncedAt)})`}
            disabled={isRefreshing}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              isRefreshing
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-200 dark:border-blue-900"
                : isLiveGrounded
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:bg-stone-200"
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">
              {isRefreshing ? "실시간 동기화 중..." : "실시간 동기화"}
            </span>
          </button>

          {onOpenReliabilityTest && (
            <button
              onClick={onOpenReliabilityTest}
              title="야후 파이낸스 실시간 데이터 신뢰성 테스트 실행 및 검증"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">야후 신뢰성 검증</span>
              <span className="sm:hidden">신뢰성</span>
            </button>
          )}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Capture OCR Trigger */}
          {onOpenCaptureModal && (
            <button
              onClick={onOpenCaptureModal}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
              title="증권계좌 캡처 OCR 업로드 및 검수"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">캡처 OCR</span>
            </button>
          )}

          {/* Technical Chart Analysis Button */}
          <button
            onClick={onOpenTechnicalChart}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="주요 자산 및 거시 지표 20·60·200일선 기술적 차트 분석"
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden md:inline">기술적 차트</span>
          </button>

          {/* Teams Adaptive Card Simulator */}
          <button
            onClick={onOpenTeamsCards}
            className="relative p-2 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            title="Teams 모바일 Adaptive Card 알림"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Frame Viewport Toggle */}
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title={isMobileFrame ? "데스크톱 와이드 모드로 전환" : "모바일 디바이스 프레임 모드로 전환"}
          >
            {isMobileFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">와이드</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">모바일 뷰</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
