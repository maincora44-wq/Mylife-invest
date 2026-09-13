// src/services/technicalDataProvider.ts
// Dedicated Technical Indicators Data Provider & Regime Engine Integration Service

import {
  ITechnicalDataProvider,
  TechnicalAssetItem,
  TechnicalPricePoint,
  TechnicalIndicatorSummary,
  RegimeTechnicalSignal,
  TechnicalAlignmentType,
  Rsi5ConditionType,
  ActionType
} from "../types";

export interface AssetMeta {
  ticker: string;
  name: string;
  market: "US_ETF" | "US_STOCK" | "MACRO_INDEX";
  basePrice: number;
  currency: "USD" | "PT" | "%";
  description: string;
  sgovCompatibility: "OPTIMAL" | "MODERATE" | "RESTRICTED";
  sgovNote: string;
}

export const ASSET_REGISTRY: AssetMeta[] = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    market: "US_ETF",
    basePrice: 512.4,
    currency: "USD",
    description: "미국 대형주 500개 핵심 패시브 분산 투자 코어 자산",
    sgovCompatibility: "OPTIMAL",
    sgovNote: "1순위 분할 투입 자산. 200일선 상단 및 5일 RSI 25 이하 과매도 시 최우선 매수 타점."
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust (Nasdaq 100)",
    market: "US_ETF",
    basePrice: 486.2,
    currency: "USD",
    description: "나스닥 100 기술주 중심 성장 ETF",
    sgovCompatibility: "MODERATE",
    sgovNote: "GOOGL/빅테크와 중복 노출 유의. 60일선 지지 및 5일 RSI 단기 과매도 시 분할 타점."
  },
  {
    ticker: "SGOV",
    name: "iShares 0-3 Month Treasury Bond ETF",
    market: "US_ETF",
    basePrice: 100.65,
    currency: "USD",
    description: "초단기 미국 국채 파킹 ETF (원금 보존형 무위험 수익)",
    sgovCompatibility: "OPTIMAL",
    sgovNote: "위험 회피 기지. 5일 RSI 및 이평선 변동 극히 제한적(변동성 < 0.2%)."
  },
  {
    ticker: "IAU",
    name: "iShares Gold Trust (금 ETF)",
    market: "US_ETF",
    basePrice: 48.2,
    currency: "USD",
    description: "금(Gold) 실물 기반 안전자산 및 통화가치 하락/지정학적 리스크 헷지 ETF",
    sgovCompatibility: "OPTIMAL",
    sgovNote: "달러 약세 및 인플레이션·지정학 긴장 시 SGOV와 함께 방어 자산으로 5~10% 편입 최적."
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc Class A (알파벳 구글)",
    market: "US_STOCK",
    basePrice: 168.8,
    currency: "USD",
    description: "구글 검색, 제미나이 AI, GCP 클라우드, 유튜브 독점 빅테크 핵심주",
    sgovCompatibility: "RESTRICTED",
    sgovNote: "개별주 집중 위험 관리. 포트폴리오 비중 5% 한도 준수, 200일선 상회 및 5일 RSI 과매도 시 진입 권고."
  },
  {
    ticker: "SOXX",
    name: "iShares Semiconductor ETF (반도체 ETF)",
    market: "US_ETF",
    basePrice: 228.5,
    currency: "USD",
    description: "필라델피아 반도체 지수(SOX) 추종 반도체 밸류체인(NVDA, TSM, AVGO, QCOM 등) 대표 ETF",
    sgovCompatibility: "MODERATE",
    sgovNote: "하이베타 반도체 주도 ETF. 60일선 지지 확인 및 5일 RSI 20~25 과매도 시 공격적 분할 타점 승인."
  },
  {
    ticker: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    market: "US_ETF",
    basePrice: 83.1,
    currency: "USD",
    description: "고배당 및 재무건전성 우량 가치주 ETF",
    sgovCompatibility: "OPTIMAL",
    sgovNote: "방어적 리밸런싱 및 배당 현금흐름 보강 시 VOO와 함께 편입."
  },
  {
    ticker: "^TNX",
    name: "미국 10년물 국채금리",
    market: "MACRO_INDEX",
    basePrice: 4.28,
    currency: "%",
    description: "글로벌 벤치마크 할인율 지표",
    sgovCompatibility: "MODERATE",
    sgovNote: "금리 200일선 하회 시 주식 Risk-On 우호적, 4.45% 돌파 시 경계 발령."
  },
  {
    ticker: "^VIX",
    name: "CBOE 변동성 지수 (공포지수)",
    market: "MACRO_INDEX",
    basePrice: 15.4,
    currency: "PT",
    description: "S&P 500 옵션 내재 변동성",
    sgovCompatibility: "OPTIMAL",
    sgovNote: "VIX 20일선 하회 및 18pt 이하 안정권 유지 시 주식 분할 매수 지속."
  }
];

/**
 * Pure Mathematical calculation of Moving Averages and Wilder's 5-Day RSI
 */
export function calculateTechnicalMetrics(
  rawPoints: { date: string; rawDate: Date; price: number; volume: number }[]
): TechnicalPricePoint[] {
  const result: TechnicalPricePoint[] = [];

  // Calculate Wilder's 5-day RSI
  const rsiPeriod = 5;
  const gains: number[] = [];
  const losses: number[] = [];
  const rsi5Values: number[] = [];

  let prevAvgGain = 0;
  let prevAvgLoss = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      rsi5Values.push(50);
      continue;
    }

    const change = rawPoints[i].price - rawPoints[i - 1].price;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    gains.push(gain);
    losses.push(loss);

    if (i < rsiPeriod) {
      rsi5Values.push(50);
    } else if (i === rsiPeriod) {
      const sumGain = gains.slice(1, rsiPeriod + 1).reduce((a, b) => a + b, 0);
      const sumLoss = losses.slice(1, rsiPeriod + 1).reduce((a, b) => a + b, 0);
      prevAvgGain = sumGain / rsiPeriod;
      prevAvgLoss = sumLoss / rsiPeriod;
      const rs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
      const rsi = prevAvgLoss === 0 ? 100 : Number((100 - 100 / (1 + rs)).toFixed(1));
      rsi5Values.push(Math.max(0, Math.min(100, rsi)));
    } else {
      // Wilder's Exponential Smoothing
      prevAvgGain = (prevAvgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      prevAvgLoss = (prevAvgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
      const rs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
      const rsi = prevAvgLoss === 0 ? 100 : Number((100 - 100 / (1 + rs)).toFixed(1));
      rsi5Values.push(Math.max(0, Math.min(100, rsi)));
    }
  }

  // Moving averages (20, 60, 200) & Bollinger Bands
  for (let idx = 0; idx < rawPoints.length; idx++) {
    const p = rawPoints[idx];

    // 20-day Simple Moving Average
    const slice20 = rawPoints.slice(Math.max(0, idx - 19), idx + 1);
    const ma20 = Number((slice20.reduce((s, c) => s + c.price, 0) / slice20.length).toFixed(2));

    // 60-day Simple Moving Average
    const slice60 = rawPoints.slice(Math.max(0, idx - 59), idx + 1);
    const ma60 = Number((slice60.reduce((s, c) => s + c.price, 0) / slice60.length).toFixed(2));

    // 200-day Simple Moving Average
    const slice200 = rawPoints.slice(Math.max(0, idx - 199), idx + 1);
    const ma200 = Number((slice200.reduce((s, c) => s + c.price, 0) / slice200.length).toFixed(2));

    // Bollinger Bands (20, 2σ)
    const variance = slice20.reduce((sum, c) => sum + Math.pow(c.price - ma20, 2), 0) / slice20.length;
    const stdDev = Math.sqrt(variance);
    const bbUpper = Number((ma20 + stdDev * 2).toFixed(2));
    const bbLower = Number((ma20 - stdDev * 2).toFixed(2));

    result.push({
      date: p.date,
      rawDate: p.rawDate.toISOString(),
      price: p.price,
      volume: p.volume,
      ma20,
      ma60,
      ma200,
      rsi5: rsi5Values[idx] || 50,
      bbUpper,
      bbLower
    });
  }

  return result;
}

/**
 * Generates realistic price candles for assets with deterministic trajectories
 */
function generateAssetCandles(
  ticker: string,
  basePrice: number,
  days: number
): { date: string; rawDate: Date; price: number; volume: number }[] {
  const points = [];
  let price = basePrice * 0.93;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

    // Deterministic pseudo-noise
    const seed = (ticker.charCodeAt(0) * 17 + i * 29) % 100;
    const changePct = (seed - 48) / 360;
    price = Number((price * (1 + changePct)).toFixed(2));

    // Anchor the end near the basePrice
    if (i < 5) {
      price = Number((price * 0.7 + basePrice * 0.3).toFixed(2));
    }

    points.push({
      date: dateStr,
      rawDate: d,
      price,
      volume: Math.round(1800000 + seed * 45000)
    });
  }

  return points;
}

export class TechnicalDataProvider implements ITechnicalDataProvider {
  private cache: Map<string, TechnicalPricePoint[]> = new Map();
  private customAssets: AssetMeta[] = [];

  constructor() {
    this.loadCustomAssetsFromStorage();
  }

  private loadCustomAssetsFromStorage(): void {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem("custom_technical_assets");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            this.customAssets = parsed;
          }
        }
      } catch (err) {
        console.warn("Failed to load custom technical assets from localStorage:", err);
      }
    }
  }

  private saveCustomAssetsToStorage(): void {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("custom_technical_assets", JSON.stringify(this.customAssets));
      } catch (err) {
        console.warn("Failed to save custom technical assets to localStorage:", err);
      }
    }
  }

  getAllAssets(): AssetMeta[] {
    return [...ASSET_REGISTRY, ...this.customAssets];
  }

  getAvailableAssets(): TechnicalAssetItem[] {
    const builtin: TechnicalAssetItem[] = ASSET_REGISTRY.map((a) => ({
      ticker: a.ticker,
      name: a.name,
      market: a.market,
      basePrice: a.basePrice,
      currency: a.currency,
      isCustom: false
    }));
    const custom: TechnicalAssetItem[] = this.customAssets.map((a) => ({
      ticker: a.ticker,
      name: a.name,
      market: a.market,
      basePrice: a.basePrice,
      currency: a.currency,
      isCustom: true
    }));
    return [...builtin, ...custom];
  }

  addCustomAsset(asset: {
    ticker: string;
    name: string;
    market?: "US_ETF" | "US_STOCK" | "MACRO_INDEX";
    basePrice?: number;
    currency?: "USD" | "PT" | "%";
    description?: string;
    sgovCompatibility?: "OPTIMAL" | "MODERATE" | "RESTRICTED";
    sgovNote?: string;
  }): void {
    const cleanTicker = asset.ticker.trim().toUpperCase();
    if (!cleanTicker) return;

    // Filter out if already in customAssets
    this.customAssets = this.customAssets.filter((a) => a.ticker !== cleanTicker);

    // If already in builtin, do nothing
    if (ASSET_REGISTRY.some((a) => a.ticker === cleanTicker)) {
      return;
    }

    const newAsset: AssetMeta = {
      ticker: cleanTicker,
      name: asset.name.trim() || cleanTicker,
      market: asset.market || "US_STOCK",
      basePrice: asset.basePrice && asset.basePrice > 0 ? Number(asset.basePrice) : 150.0,
      currency: asset.currency || "USD",
      description: asset.description?.trim() || `${cleanTicker} 사용자 직접 등록 종목`,
      sgovCompatibility: asset.sgovCompatibility || "MODERATE",
      sgovNote: asset.sgovNote?.trim() || "사용자 등록 종목: 200일선 상회 및 5일 RSI 단기 과매도 시 분할 진입 원칙 적용."
    };

    this.customAssets.push(newAsset);
    this.saveCustomAssetsToStorage();

    // Clear cache for this ticker
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(cleanTicker)) {
        this.cache.delete(key);
      }
    }
  }

  removeCustomAsset(ticker: string): boolean {
    const cleanTicker = ticker.trim().toUpperCase();
    const prevCount = this.customAssets.length;
    this.customAssets = this.customAssets.filter((a) => a.ticker !== cleanTicker);
    if (this.customAssets.length !== prevCount) {
      this.saveCustomAssetsToStorage();
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(cleanTicker)) {
          this.cache.delete(key);
        }
      }
      return true;
    }
    return false;
  }

  calculateTechnicalSeries(
    ticker: string,
    timeframe: "1M" | "3M" | "6M" | "1Y" = "3M"
  ): TechnicalPricePoint[] {
    const days = timeframe === "1M" ? 35 : timeframe === "3M" ? 95 : timeframe === "6M" ? 190 : 380;
    const cacheKey = `${ticker}_${days}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const all = this.getAllAssets();
    const asset = all.find((a) => a.ticker === ticker) || all[0];
    const raw = generateAssetCandles(asset.ticker, asset.basePrice, days);
    const calculated = calculateTechnicalMetrics(raw);

    // Filter to requested display count
    const displayCount = timeframe === "1M" ? 30 : timeframe === "3M" ? 90 : timeframe === "6M" ? 180 : 365;
    const trimmed = calculated.slice(-displayCount);

    this.cache.set(cacheKey, trimmed);
    return trimmed;
  }

  getTechnicalSummary(
    ticker: string,
    timeframe: "1M" | "3M" | "6M" | "1Y" = "3M"
  ): TechnicalIndicatorSummary {
    const series = this.calculateTechnicalSeries(ticker, timeframe);
    const all = this.getAllAssets();
    const asset = all.find((a) => a.ticker === ticker) || all[0];

    const latest = series[series.length - 1];
    const isAboveMa20 = latest.price >= latest.ma20;
    const isAboveMa60 = latest.price >= latest.ma60;
    const isAboveMa200 = latest.price >= latest.ma200;

    const disparityMa200Pct = Number((((latest.price - latest.ma200) / latest.ma200) * 100).toFixed(2));
    const disparityMa20Pct = Number((((latest.price - latest.ma20) / latest.ma20) * 100).toFixed(2));

    let alignment: TechnicalAlignmentType = "MIXED";
    if (latest.ma20 >= latest.ma60 && latest.ma60 >= latest.ma200) {
      alignment = "BULLISH_ORDER";
    } else if (latest.ma20 <= latest.ma60 && latest.ma60 <= latest.ma200) {
      alignment = "BEARISH_ORDER";
    }

    let rsi5Status: Rsi5ConditionType = "NEUTRAL";
    if (latest.rsi5 < 15) {
      rsi5Status = "EXTREME_OVERSOLD";
    } else if (latest.rsi5 < 25) {
      rsi5Status = "OVERSOLD";
    } else if (latest.rsi5 > 85) {
      rsi5Status = "EXTREME_OVERBOUGHT";
    } else if (latest.rsi5 > 75) {
      rsi5Status = "OVERBOUGHT";
    }

    const recentPrices = series.slice(-25).map((p) => p.price);
    const supportLevel = Math.min(...recentPrices);
    const resistanceLevel = Math.max(...recentPrices);

    return {
      ticker: asset.ticker,
      name: asset.name,
      currentPrice: latest.price,
      ma20: latest.ma20,
      ma60: latest.ma60,
      ma200: latest.ma200,
      rsi5: latest.rsi5,
      isAboveMa20,
      isAboveMa60,
      isAboveMa200,
      disparityMa200Pct,
      disparityMa20Pct,
      alignment,
      rsi5Status,
      supportLevel,
      resistanceLevel
    };
  }

  /**
   * Translates Moving Averages (20, 60, 200) + 5-day RSI into concrete Regime Engine signals
   */
  evaluateRegimeSignal(ticker: string): RegimeTechnicalSignal {
    const summary = this.getTechnicalSummary(ticker);

    let scoreContribution = 0;
    let tacticalAction: ActionType = "HOLD";
    let trendVerdict = "중립 조정";
    let verdictBadgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    let verdictDescription = "";
    let shortTermMomentum = "";
    let gatekeeperEligibility = true;
    let rationale = "";
    let favorableForSgovDeployment = false;

    // Macro indices handling
    if (ticker === "^TNX") {
      const isYieldFalling = summary.currentPrice < summary.ma60;
      scoreContribution = isYieldFalling ? 3 : -3;
      trendVerdict = isYieldFalling ? "금리 안정 우호적" : "금리 상승 경계";
      verdictBadgeColor = isYieldFalling ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";
      verdictDescription = `10년물 금리가 60일선(${summary.ma60}%) 대비 ${isYieldFalling ? "하회하여 유동성 우호적" : "상회하여 할인율 부담 가중"}.`;
      shortTermMomentum = `5일 RSI: ${summary.rsi5} (${summary.rsi5Status})`;
      tacticalAction = isYieldFalling ? "HOLD" : "WAIT";
      rationale = "채권 금리 추세가 전체 시장 밸류에이션 상방을 제한하는지 여부 평가";
      return {
        ticker,
        scoreContribution,
        regimeContributionLabel: `거시 할인율 요인 (${scoreContribution > 0 ? "+" : ""}${scoreContribution}점)`,
        trendVerdict,
        verdictBadgeColor,
        verdictDescription,
        shortTermMomentum,
        tacticalAction,
        gatekeeperEligibility: false,
        rationale,
        favorableForSgovDeployment: isYieldFalling
      };
    }

    if (ticker === "^VIX") {
      const isLowVol = summary.currentPrice < 18 && summary.currentPrice < summary.ma20;
      scoreContribution = isLowVol ? 4 : -4;
      trendVerdict = isLowVol ? "변동성 안정" : "변동성 경계 확대";
      verdictBadgeColor = isLowVol ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";
      verdictDescription = `VIX가 20일선(${summary.ma20}pt) 및 18pt 기준선 대비 ${isLowVol ? "안정권 유지" : "상승하여 위험자산 축소 신호"}.`;
      shortTermMomentum = `5일 RSI: ${summary.rsi5}`;
      tacticalAction = isLowVol ? "HOLD" : "WAIT";
      rationale = "공포지수 20일선 하향 안정 시 주식 비중 정상 유지 가능";
      return {
        ticker,
        scoreContribution,
        regimeContributionLabel: `시장 변동성 요인 (${scoreContribution > 0 ? "+" : ""}${scoreContribution}점)`,
        trendVerdict,
        verdictBadgeColor,
        verdictDescription,
        shortTermMomentum,
        tacticalAction,
        gatekeeperEligibility: false,
        rationale,
        favorableForSgovDeployment: isLowVol
      };
    }

    // Equity assets (VOO, QQQ, SCHD, GOOGL, SGOV)
    if (summary.alignment === "BULLISH_ORDER") {
      scoreContribution += 4;
      trendVerdict = "정배열 강세 지속 (20 > 60 > 200)";
      verdictBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
      verdictDescription = "단기·중기·장기 이동평균선이 완전한 정배열을 유지하며 기저 상승 추세 견고.";
    } else if (summary.isAboveMa200) {
      scoreContribution += 2;
      trendVerdict = "장기 강세 지지 (200일선 상회)";
      verdictBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
      verdictDescription = "장기 추세선인 200일선 위에 안착하여 대세 상승 국면 유효.";
    } else {
      scoreContribution -= 5;
      trendVerdict = "장기 약세 전환 경계 (200일선 하회)";
      verdictBadgeColor = "bg-rose-50 text-rose-700 border-rose-200";
      verdictDescription = "200일선 아래로 이탈하여 추세적 하락 위험 구간. 보수적 접근 필수.";
    }

    // 5-Day RSI Tactical overlay
    if (summary.rsi5Status === "EXTREME_OVERSOLD" || summary.rsi5Status === "OVERSOLD") {
      shortTermMomentum = `RSI(5) ${summary.rsi5} - 단기 극단적 과매도 반등 타점`;
      if (summary.isAboveMa200) {
        // High-probability dip buy rule (200일선 상회 + RSI(5) 과매도)
        tacticalAction = "BUY";
        favorableForSgovDeployment = true;
        rationale = "200일선 상단 유지 상태에서 5일 RSI 과매도 구간 진입은 고확률 단기 눌림목 분할 매수 타점입니다.";
      } else {
        tacticalAction = "WAIT";
        gatekeeperEligibility = false;
        rationale = "5일 RSI 과매도이나 200일선 아래이므로 추세 붕괴 리스크로 인한 매수 대기(WAIT).";
      }
    } else if (summary.rsi5Status === "EXTREME_OVERBOUGHT" || summary.rsi5Status === "OVERBOUGHT") {
      shortTermMomentum = `RSI(5) ${summary.rsi5} - 단기 과열 구간 (추격 매수 금지)`;
      tacticalAction = "HOLD";
      gatekeeperEligibility = false;
      rationale = "5일 RSI가 75를 초과하여 단기 과열 양상. 신규 추격 매수를 금지하고 눌림목 조정을 대기합니다.";
    } else {
      shortTermMomentum = `RSI(5) ${summary.rsi5} - 중립 균형 모멘텀`;
      tacticalAction = summary.isAboveMa200 ? "HOLD" : "WAIT";
      rationale = "이평선 및 5일 RSI가 안정적 정상 범위에 위치하여 기존 포지션 유지 원칙.";
    }

    return {
      ticker,
      scoreContribution,
      regimeContributionLabel: `기술적 추세 기여 (${scoreContribution >= 0 ? "+" : ""}${scoreContribution}점)`,
      trendVerdict,
      verdictBadgeColor,
      verdictDescription,
      shortTermMomentum,
      tacticalAction,
      gatekeeperEligibility,
      rationale,
      favorableForSgovDeployment
    };
  }

  getMarketAggregateTechnicalRegime(): {
    aggregateScoreContribution: number;
    regimeAdjustmentText: string;
    macroAlignment: string;
    assetSignals: Record<string, RegimeTechnicalSignal>;
  } {
    const vooSignal = this.evaluateRegimeSignal("VOO");
    const qqqSignal = this.evaluateRegimeSignal("QQQ");
    const iauSignal = this.evaluateRegimeSignal("IAU");
    const soxxSignal = this.evaluateRegimeSignal("SOXX");
    const tnxSignal = this.evaluateRegimeSignal("^TNX");
    const vixSignal = this.evaluateRegimeSignal("^VIX");

    const assetSignals: Record<string, RegimeTechnicalSignal> = {
      VOO: vooSignal,
      QQQ: qqqSignal,
      IAU: iauSignal,
      SOXX: soxxSignal,
      "^TNX": tnxSignal,
      "^VIX": vixSignal
    };

    const aggregateScoreContribution = Math.max(
      -8,
      Math.min(8, Math.round((vooSignal.scoreContribution + qqqSignal.scoreContribution + tnxSignal.scoreContribution + vixSignal.scoreContribution) / 2))
    );

    const isBullish = aggregateScoreContribution >= 2;
    const isDefensive = aggregateScoreContribution <= -2;

    const macroAlignment = isBullish
      ? "S&P 500 및 나스닥 200일선 상회와 VIX 안정에 힘입어 기술적 Risk-On 지지"
      : isDefensive
      ? "주요 지수 이평선 이탈 또는 금리/VIX 변동성 상승으로 기술적 방어(Defensive) 신호"
      : "지수 이평선 혼조세 및 5일 RSI 중립선 유지에 따른 관망(Neutral) 레짐 유지";

    const regimeAdjustmentText = `기술적 지표(20/60/200일선 + RSI 5일) 총합 기여도: ${
      aggregateScoreContribution >= 0 ? "+" : ""
    }${aggregateScoreContribution}점`;

    return {
      aggregateScoreContribution,
      regimeAdjustmentText,
      macroAlignment,
      assetSignals
    };
  }
}

// Singleton provider instance
export const technicalDataProvider = new TechnicalDataProvider();
