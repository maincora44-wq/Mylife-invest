import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area
} from "recharts";
import {
  TrendingUp,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
  ChevronRight,
  SlidersHorizontal,
  Compass,
  Cpu,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Search,
  Check,
  FolderPlus
} from "lucide-react";
import {
  ITechnicalDataProvider,
  TechnicalPricePoint,
  TechnicalIndicatorSummary,
  RegimeTechnicalSignal,
  ActionType
} from "../types";
import { technicalDataProvider, ASSET_REGISTRY, AssetMeta } from "../services/technicalDataProvider";

interface TechnicalChartViewProps {
  onOpenGatekeeper?: (ticker: string) => void;
  provider?: ITechnicalDataProvider;
}

export type ChartTimeframe = "1M" | "3M" | "6M" | "1Y";

export const PRESET_ASSETS = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corp (엔비디아)",
    market: "US_STOCK" as const,
    basePrice: 119.5,
    sgovCompatibility: "MODERATE" as const,
    description: "글로벌 AI 가속기 및 GPU 독점 선도 기업"
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp (마이크로소프트)",
    market: "US_STOCK" as const,
    basePrice: 428.0,
    sgovCompatibility: "OPTIMAL" as const,
    description: "클라우드(Azure), 엔터프라이즈 소프트웨어 및 AI 생태계 빅테크"
  },
  {
    ticker: "AAPL",
    name: "Apple Inc (애플)",
    market: "US_STOCK" as const,
    basePrice: 224.0,
    sgovCompatibility: "OPTIMAL" as const,
    description: "아이폰 하드웨어 및 온디바이스 AI 생태계 빅테크"
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc (테슬라)",
    market: "US_STOCK" as const,
    basePrice: 218.0,
    sgovCompatibility: "RESTRICTED" as const,
    description: "전기차, 자율주행(FSD), 에너지 스토리지 및 로보틱스"
  },
  {
    ticker: "AMZN",
    name: "Amazon.com (아마존)",
    market: "US_STOCK" as const,
    basePrice: 187.0,
    sgovCompatibility: "MODERATE" as const,
    description: "AWS 클라우드 인프라 및 글로벌 최대 이커머스 플랫폼"
  },
  {
    ticker: "META",
    name: "Meta Platforms (메타)",
    market: "US_STOCK" as const,
    basePrice: 512.0,
    sgovCompatibility: "MODERATE" as const,
    description: "인스타그램, 왓츠앱, 오픈소스 라마(Llama) AI 및 디지털 광고"
  },
  {
    ticker: "TLT",
    name: "iShares 20+ Year Treasury Bond ETF (미국 장기채)",
    market: "US_ETF" as const,
    basePrice: 96.8,
    sgovCompatibility: "OPTIMAL" as const,
    description: "미국 20년 이상 장기국채 ETF - 금리 인하기 자본차익 및 포트폴리오 헤지"
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    market: "US_ETF" as const,
    basePrice: 548.0,
    sgovCompatibility: "OPTIMAL" as const,
    description: "미국 대표 500개 대형주 패시브 지수 추종 ETF"
  }
];

export const TechnicalChartView: React.FC<TechnicalChartViewProps> = ({
  onOpenGatekeeper,
  provider = technicalDataProvider
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>("VOO");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("3M");
  const [showMa20, setShowMa20] = useState<boolean>(true);
  const [showMa60, setShowMa60] = useState<boolean>(true);
  const [showMa200, setShowMa200] = useState<boolean>(true);
  const [showBands, setShowBands] = useState<boolean>(false);
  const [activeSubPane, setActiveSubPane] = useState<"RSI5" | "VOL">("RSI5");

  // Custom asset addition & management state
  const [assetsVersion, setAssetsVersion] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [tickerInput, setTickerInput] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [marketInput, setMarketInput] = useState<"US_STOCK" | "US_ETF" | "MACRO_INDEX">("US_STOCK");
  const [priceInput, setPriceInput] = useState<number | "">("");
  const [sgovInput, setSgovInput] = useState<"OPTIMAL" | "MODERATE" | "RESTRICTED">("MODERATE");
  const [noteInput, setNoteInput] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const availableAssets = useMemo(() => {
    return provider.getAvailableAssets();
  }, [provider, assetsVersion]);

  const currentAsset: AssetMeta = useMemo(() => {
    if (provider.getAllAssets) {
      const all = provider.getAllAssets();
      const found = all.find((a) => a.ticker === selectedTicker);
      if (found) return found;
    }
    const fromReg = ASSET_REGISTRY.find((a) => a.ticker === selectedTicker);
    if (fromReg) return fromReg;

    const fromAvail = availableAssets.find((a) => a.ticker === selectedTicker);
    if (fromAvail) {
      return {
        ticker: fromAvail.ticker,
        name: fromAvail.name,
        market: (fromAvail.market as any) || "US_STOCK",
        basePrice: fromAvail.basePrice,
        currency: (fromAvail.currency as any) || "USD",
        description: `${fromAvail.ticker} 사용자 등록 종목`,
        sgovCompatibility: "MODERATE",
        sgovNote: "사용자 추가 종목: 200일선 상회 및 5일 RSI 과매도 시 분할 진입 원칙 적용."
      };
    }
    return ASSET_REGISTRY[0];
  }, [selectedTicker, availableAssets, provider, assetsVersion]);

  const handleSelectPreset = (preset: typeof PRESET_ASSETS[0]) => {
    setTickerInput(preset.ticker);
    setNameInput(preset.name);
    setMarketInput(preset.market);
    setPriceInput(preset.basePrice);
    setSgovInput(preset.sgovCompatibility);
    setNoteInput(preset.description);
    setFormError(null);
  };

  const handleAddCustomTicker = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTicker = tickerInput.trim().toUpperCase();
    if (!cleanTicker) {
      setFormError("티커 심볼을 입력해주세요 (예: NVDA, MSFT).");
      return;
    }
    if (cleanTicker.length > 12) {
      setFormError("티커 심볼은 12자 이내여야 합니다.");
      return;
    }
    if (availableAssets.some((a) => a.ticker === cleanTicker)) {
      setFormError(`'${cleanTicker}' 종목은 이미 등록되어 있습니다.`);
      return;
    }

    const cleanName = nameInput.trim() || cleanTicker;
    const cleanPrice = typeof priceInput === "number" && priceInput > 0 ? priceInput : 150.0;
    const cleanNote = noteInput.trim() || "사용자 등록 종목: 200일선 상회 및 5일 RSI 과매도 시 분할 매수 원칙 적용.";

    if (provider.addCustomAsset) {
      provider.addCustomAsset({
        ticker: cleanTicker,
        name: cleanName,
        market: marketInput,
        basePrice: cleanPrice,
        currency: "USD",
        description: cleanNote,
        sgovCompatibility: sgovInput,
        sgovNote: cleanNote
      });
    }

    // Background sync to backend API
    fetch("/api/technical/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: cleanTicker,
        name: cleanName,
        market: marketInput,
        basePrice: cleanPrice,
        currency: "USD",
        description: cleanNote,
        sgovCompatibility: sgovInput,
        sgovNote: cleanNote
      })
    }).catch(() => {});

    setAssetsVersion((v) => v + 1);
    setSelectedTicker(cleanTicker);
    setIsAddModalOpen(false);
    setTickerInput("");
    setNameInput("");
    setPriceInput("");
    setNoteInput("");
    setFormError(null);
  };

  const handleRemoveCustomTicker = (tickerToRemove: string) => {
    if (provider.removeCustomAsset) {
      provider.removeCustomAsset(tickerToRemove);
    }
    fetch(`/api/technical/assets/${tickerToRemove}`, { method: "DELETE" }).catch(() => {});
    setAssetsVersion((v) => v + 1);
    if (selectedTicker === tickerToRemove) {
      setSelectedTicker("VOO");
    }
  };

  // Retrieve calculated technical series through Data Provider interface
  const chartData: TechnicalPricePoint[] = useMemo(() => {
    return provider.calculateTechnicalSeries(selectedTicker, timeframe);
  }, [provider, selectedTicker, timeframe]);

  // Retrieve calculated technical summary through Data Provider interface
  const summary: TechnicalIndicatorSummary = useMemo(() => {
    return provider.getTechnicalSummary(selectedTicker, timeframe);
  }, [provider, selectedTicker, timeframe]);

  // Retrieve evaluated regime signal through Data Provider interface
  const regimeSignal: RegimeTechnicalSignal = useMemo(() => {
    return provider.evaluateRegimeSignal(selectedTicker);
  }, [provider, selectedTicker]);

  // Market aggregate technical regime score
  const marketAggregate = useMemo(() => {
    return provider.getMarketAggregateTechnicalRegime();
  }, [provider]);

  const latestPoint = chartData[chartData.length - 1] || {
    price: currentAsset.basePrice,
    ma20: currentAsset.basePrice,
    ma60: currentAsset.basePrice,
    ma200: currentAsset.basePrice,
    rsi5: 50,
    volume: 1500000
  };
  const prevPoint = chartData[chartData.length - 2] || latestPoint;
  const priceChange = Number((latestPoint.price - prevPoint.price).toFixed(2));
  const priceChangePct = Number(((priceChange / (prevPoint.price || 1)) * 100).toFixed(2));

  // RSI 5 Status visual styling
  const getRsi5Badge = (rsi: number) => {
    if (rsi < 20) {
      return {
        label: "극단적 과매도 (< 20)",
        color: "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300",
        advice: "단기 반등 유력 타점 (눌림목 분할 매수)"
      };
    }
    if (rsi < 30) {
      return {
        label: "과매도 구간 (20~30)",
        color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200",
        advice: "분할 매수 고려 타점"
      };
    }
    if (rsi > 80) {
      return {
        label: "극단적 과열 (> 80)",
        color: "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 border-rose-300",
        advice: "추격 매수 절대 금지 (조정 대기)"
      };
    }
    if (rsi > 70) {
      return {
        label: "단기 과열 (70~80)",
        color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200",
        advice: "신규 진입 유보 / 기존 보유"
      };
    }
    return {
      label: "중립 균형 (30~70)",
      color: "text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-200",
      advice: "정상 추세 추종 구간"
    };
  };

  const rsiInfo = getRsi5Badge(summary.rsi5);

  const getActionBadge = (action: ActionType) => {
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

  return (
    <div className="space-y-4 pb-12 max-w-4xl mx-auto">
      {/* Top Banner: Technical Chart & Regime Provider Integration */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  기술적 차트 분석 & 레짐 지표
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Provider 연동 ON
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                이동평균선(20·60·200일)과 5일 상대강도지수(RSI) 산출 및 레짐 엔진 의사결정 신호 연계
              </p>
            </div>
          </div>

          {/* Gatekeeper Link Button */}
          {onOpenGatekeeper && currentAsset.market !== "MACRO_INDEX" && (
            <button
              onClick={() => onOpenGatekeeper(currentAsset.ticker)}
              className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-stone-800 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
              <span>Gatekeeper 주문 연계</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Aggregate Market Regime Quick Banner */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-stone-50/80 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              시장 종합 기술적 레짐 기여:
            </span>
            <span className={`font-bold font-mono px-1.5 py-0.2 rounded ${marketAggregate.aggregateScoreContribution >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {marketAggregate.aggregateScoreContribution >= 0 ? "+" : ""}{marketAggregate.aggregateScoreContribution}점
            </span>
            <span className="text-stone-600 dark:text-stone-400 hidden sm:inline">
              ({marketAggregate.macroAlignment})
            </span>
          </div>
          <span className="text-[11px] font-mono text-stone-500">
            Provider: ITechnicalDataProvider
          </span>
        </div>

        {/* Ticker Selector Pills & Add Asset Trigger */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
          {availableAssets.map((asset) => {
            const isSelected = asset.ticker === selectedTicker;
            return (
              <div key={asset.ticker} className="flex items-center shrink-0">
                <button
                  onClick={() => setSelectedTicker(asset.ticker)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                      : "bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <span>{asset.ticker}</span>
                  <span
                    className={`text-[10px] font-normal ${
                      isSelected ? "text-blue-100" : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    {asset.name.split(" ")[0]}
                  </span>
                  {asset.isCustom && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isSelected
                          ? "bg-blue-500/80 text-white"
                          : "bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      직접추가
                    </span>
                  )}
                </button>
                {asset.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCustomTicker(asset.ticker);
                    }}
                    title={`${asset.ticker} 종목 삭제`}
                    className="ml-0.5 p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Ticker Button */}
          <button
            onClick={() => {
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 border border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>종목 추가</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Chart & Indicator Controls */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-2xs space-y-4">
        {/* Asset Headline & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
                {currentAsset.ticker}
              </span>
              <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                {currentAsset.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                {currentAsset.currency}
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-2xl font-black text-stone-900 dark:text-stone-50 font-mono tracking-tight">
                {currentAsset.currency === "USD" ? "$" : ""}
                {latestPoint.price.toLocaleString()}
                {currentAsset.currency === "%" ? "%" : currentAsset.currency === "PT" ? " pt" : ""}
              </span>
              <span
                className={`text-xs font-bold font-mono flex items-center gap-0.5 ${
                  priceChange >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange} ({priceChange >= 0 ? "+" : ""}{priceChangePct}%)
              </span>
            </div>
          </div>

          {/* Timeframe & Overlay Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg text-[11px] font-bold">
              {(["1M", "3M", "6M", "1Y"] as ChartTimeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    timeframe === tf
                      ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs"
                      : "text-stone-600 dark:text-stone-300 hover:text-stone-900"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Moving Average Toggles */}
            <div className="flex items-center gap-1 text-[10px] font-medium">
              <button
                onClick={() => setShowMa20(!showMa20)}
                className={`px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                  showMa20
                    ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold"
                    : "border-stone-200 dark:border-stone-800 text-stone-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>20일선</span>
              </button>
              <button
                onClick={() => setShowMa60(!showMa60)}
                className={`px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                  showMa60
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold"
                    : "border-stone-200 dark:border-stone-800 text-stone-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span>60일선</span>
              </button>
              <button
                onClick={() => setShowMa200(!showMa200)}
                className={`px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                  showMa200
                    ? "bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold"
                    : "border-stone-200 dark:border-stone-800 text-stone-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                <span>200일선</span>
              </button>
              <button
                onClick={() => setShowBands(!showBands)}
                className={`px-2 py-1 rounded-md border transition-colors ${
                  showBands
                    ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold"
                    : "border-stone-200 dark:border-stone-800 text-stone-600"
                }`}
              >
                BB(20)
              </button>
            </div>
          </div>
        </div>

        {/* Primary Chart: Price + 20/60/200 MA */}
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888888" }} tickLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "#888888" }}
                tickLine={false}
                orientation="right"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1917",
                  borderColor: "#292524",
                  borderRadius: "12px",
                  color: "#fafaf9",
                  fontSize: "11px"
                }}
              />

              {showBands && (
                <>
                  <Area type="monotone" dataKey="bbUpper" stroke="none" fill="#14b8a6" fillOpacity={0.05} />
                  <Area type="monotone" dataKey="bbLower" stroke="none" fill="#14b8a6" fillOpacity={0.05} />
                  <Line type="monotone" dataKey="bbUpper" stroke="#14b8a6" strokeWidth={1} strokeDasharray="2 2" dot={false} name="BB 상단" />
                  <Line type="monotone" dataKey="bbLower" stroke="#14b8a6" strokeWidth={1} strokeDasharray="2 2" dot={false} name="BB 하단" />
                </>
              )}

              <Area
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPrice)"
                name="가격 (Close)"
              />

              {showMa20 && (
                <Line
                  type="monotone"
                  dataKey="ma20"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  name="20일선 (단기)"
                />
              )}
              {showMa60 && (
                <Line
                  type="monotone"
                  dataKey="ma60"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  name="60일선 (수급)"
                />
              )}
              {showMa200 && (
                <Line
                  type="monotone"
                  dataKey="ma200"
                  stroke="#a855f7"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  dot={false}
                  name="200일선 (장기)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Dedicated Sub-Pane: 5-Day RSI (상대강도지수) */}
        <div className="border-t border-stone-100 dark:border-stone-800 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                5일 상대강도지수 (5-Day RSI) & 보조지표
              </span>

              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-md text-[10px] font-bold">
                <button
                  onClick={() => setActiveSubPane("RSI5")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeSubPane === "RSI5"
                      ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold"
                      : "text-stone-600 dark:text-stone-400"
                  }`}
                >
                  RSI(5)
                </button>
                <button
                  onClick={() => setActiveSubPane("VOL")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeSubPane === "VOL"
                      ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold"
                      : "text-stone-600 dark:text-stone-400"
                  }`}
                >
                  거래량 (VOL)
                </button>
              </div>
            </div>

            {/* Current RSI 5 Status & Interpretation */}
            <div className="flex items-center gap-2 text-[11px]">
              {activeSubPane === "RSI5" ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-stone-600 dark:text-stone-300">
                    현재 RSI(5): <strong className="text-stone-900 dark:text-stone-100">{summary.rsi5}</strong>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rsiInfo.color}`}>
                    {rsiInfo.label}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-stone-600 dark:text-stone-400">
                  당일 거래량: <strong>{(latestPoint.volume / 10000).toLocaleString()}만 주</strong>
                </span>
              )}
            </div>
          </div>

          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeSubPane === "RSI5" ? (
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.2} vertical={false} />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[20, 50, 80]}
                    tick={{ fontSize: 9, fill: "#888888" }}
                    orientation="right"
                  />
                  {/* Overbought threshold (80) */}
                  <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "과열(80)", fill: "#f43f5e", fontSize: 9, position: "insideTopLeft" }} />
                  {/* Neutral line (50) */}
                  <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="2 2" />
                  {/* Oversold threshold (20) */}
                  <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" label={{ value: "과매도(20)", fill: "#10b981", fontSize: 9, position: "insideBottomLeft" }} />
                  <Line
                    type="monotone"
                    dataKey="rsi5"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="5일 RSI"
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <YAxis domain={["auto", "auto"]} hide />
                  <Bar dataKey="volume" fill="#94a3b8" opacity={0.6} radius={[2, 2, 0, 0]} name="거래량" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-stone-500 mt-1 flex items-center justify-between">
            <span>• 5일 RSI: 단기 민감 지표. 200일선 상단 유지 중 20~25 이하 진입 시 고확률 눌림목 분할 매수 타점.</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{rsiInfo.advice}</span>
          </div>
        </div>
      </div>

      {/* REGIME ENGINE LINKAGE CARD: Explicit Decision-Making Rationale */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-blue-500/30 dark:border-blue-500/40 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                레짐 엔진 연동 신호 & 의사결정 근거
              </h3>
              <span className="text-[10px] text-stone-500">
                Data Provider 인터페이스를 통해 레짐 진단 및 Gatekeeper 승인 판단에 직접 반영
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${getActionBadge(regimeSignal.tacticalAction)}`}>
              권고: {regimeSignal.tacticalAction}
            </span>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
              {regimeSignal.regimeContributionLabel}
            </span>
          </div>
        </div>

        {/* 3 Pillars of Decision Rationale */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          {/* 1. Moving Averages Trend */}
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500">① 이평선 배열 판정</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${regimeSignal.verdictBadgeColor}`}>
                {summary.alignment === "BULLISH_ORDER" ? "정배열" : summary.isAboveMa200 ? "장기 지지" : "역배열/이탈"}
              </span>
            </div>
            <div className="font-bold text-stone-900 dark:text-stone-100 mt-1">
              {regimeSignal.trendVerdict}
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
              {regimeSignal.verdictDescription}
            </p>
          </div>

          {/* 2. 5-Day RSI Tactical Momentum */}
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500">② 5일 RSI 전술 모멘텀</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                RSI: {summary.rsi5}
              </span>
            </div>
            <div className="font-bold text-stone-900 dark:text-stone-100 mt-1">
              {regimeSignal.shortTermMomentum}
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
              {regimeSignal.rationale}
            </p>
          </div>

          {/* 3. Gatekeeper & SGOV Deployment */}
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-500">③ Gatekeeper 브레이크</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                regimeSignal.gatekeeperEligibility
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
              }`}>
                {regimeSignal.gatekeeperEligibility ? "매수 심사 통과" : "추격매수 락 작동"}
              </span>
            </div>
            <div className="font-bold text-stone-900 dark:text-stone-100 mt-1">
              {regimeSignal.favorableForSgovDeployment ? "SGOV 재투입 우호 구간" : "현금 대기 유지 권고"}
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
              {currentAsset.sgovNote}
            </p>
          </div>
        </div>

        {/* Action Link Footer */}
        {onOpenGatekeeper && currentAsset.market !== "MACRO_INDEX" && (
          <div className="pt-1 flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>
                위 기술 지표(20/60/200 MA + RSI 5일: <strong>{summary.rsi5}</strong>) 근거로 주문을 심사하시겠습니까?
              </span>
            </div>
            <button
              onClick={() => onOpenGatekeeper(currentAsset.ticker)}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
            >
              <span>Gatekeeper로 즉시 전송</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detailed Technical Grid (20/60/200 Metrics & Disparity) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Moving Averages Inspection */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-500" />
              이동평균선 수치 및 이격도 (Disparity)
            </h3>
            <span className="text-[10px] font-mono text-stone-500">
              기준: 종가
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
              <div className="text-[10px] text-stone-500 font-medium">20일선 (단기)</div>
              <div className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {summary.ma20}
              </div>
              <div className={`text-[10px] font-bold mt-0.5 ${summary.isAboveMa20 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {summary.isAboveMa20 ? "상회 (지지)" : "하회 (저항)"}
              </div>
              <div className="text-[9px] font-mono text-stone-400 mt-0.5">
                이격: {summary.disparityMa20Pct >= 0 ? "+" : ""}{summary.disparityMa20Pct}%
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
              <div className="text-[10px] text-stone-500 font-medium">60일선 (수급)</div>
              <div className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {summary.ma60}
              </div>
              <div className={`text-[10px] font-bold mt-0.5 ${summary.isAboveMa60 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {summary.isAboveMa60 ? "상회 (우상향)" : "하회 (조정)"}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800">
              <div className="text-[10px] text-stone-500 font-medium">200일선 (장기)</div>
              <div className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {summary.ma200}
              </div>
              <div className={`text-[10px] font-bold mt-0.5 ${summary.isAboveMa200 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {summary.isAboveMa200 ? "장기 상승선 상회" : "장기 하락선 하회"}
              </div>
              <div className="text-[9px] font-mono text-stone-400 mt-0.5">
                이격: {summary.disparityMa200Pct >= 0 ? "+" : ""}{summary.disparityMa200Pct}%
              </div>
            </div>
          </div>
        </div>

        {/* Support/Resistance & SGOV Deployment */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" />
              지지·저항선 및 SGOV 투입 적합성
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                currentAsset.sgovCompatibility === "OPTIMAL"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : currentAsset.sgovCompatibility === "MODERATE"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {currentAsset.sgovCompatibility === "OPTIMAL" ? "SGOV 투입 1순위" : currentAsset.sgovCompatibility === "MODERATE" ? "제한적 분할 투입" : "단독 편입 제한"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-sans font-bold block">1차 저항선</span>
              <span className="text-stone-800 dark:text-stone-200 font-bold">{summary.resistanceLevel}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-sans font-bold block">1차 지지선</span>
              <span className="text-stone-800 dark:text-stone-200 font-bold">{summary.supportLevel}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong>투자 가이드:</strong> {currentAsset.sgovNote}
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Ticker Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-5 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>새 종목 추가</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      기술지표 연동
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    원하는 미국 주식/ETF를 등록하여 20·60·200일선 및 5일 RSI를 실시간 분석합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Preset Chips */}
            <div className="space-y-1.5 bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800">
              <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>추천 종목 빠른 선택 (클릭 시 자동 입력)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_ASSETS.map((preset) => {
                  const isAlreadyAdded = availableAssets.some((a) => a.ticker === preset.ticker);
                  return (
                    <button
                      key={preset.ticker}
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border transition-all ${
                        isAlreadyAdded
                          ? "bg-stone-100 dark:bg-stone-800/80 text-stone-400 border-stone-200 dark:border-stone-700 cursor-not-allowed opacity-60"
                          : tickerInput === preset.ticker
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                          : "bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-blue-400"
                      }`}
                    >
                      <span>+{preset.ticker}</span>
                      {isAlreadyAdded && <span className="text-[9px] font-sans font-normal">(등록됨)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleAddCustomTicker} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Ticker Input */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    티커 심볼 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tickerInput}
                    onChange={(e) => {
                      setTickerInput(e.target.value.toUpperCase());
                      setFormError(null);
                    }}
                    placeholder="예: NVDA, TSLA, MSFT"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono font-bold placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Asset Name */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    종목명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="예: NVIDIA Corp (엔비디아)"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Market Type */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    자산 분류
                  </label>
                  <select
                    value={marketInput}
                    onChange={(e) => setMarketInput(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="US_STOCK">미국 개별주 (US Stock)</option>
                    <option value="US_ETF">미국 ETF (US ETF)</option>
                    <option value="MACRO_INDEX">거시 / 원자재 지표 (Index/Macro)</option>
                  </select>
                </div>

                {/* Base Reference Price */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    기준 기준가 ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="150.0"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SGOV Compatibility */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  SGOV 현금 투입 적합도 (레짐 엔진 연계)
                </label>
                <select
                  value={sgovInput}
                  onChange={(e) => setSgovInput(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OPTIMAL">OPTIMAL - 1순위 적극 투입 우호 (지수/핵심 ETF 및 대표 우량주)</option>
                  <option value="MODERATE">MODERATE - 제한적 분할 투입 (성장주 및 섹터 ETF)</option>
                  <option value="RESTRICTED">RESTRICTED - 단독 편입 제한 (고변동성 개별주 / 리스크 관리)</option>
                </select>
              </div>

              {/* Note / Description */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  투자 가이드 / 분석 메모
                </label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="예: 200일선 상회 유지 시 5일 RSI 과매도 구간에서 3회 분할 매수"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>종목 등록 및 분석</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
