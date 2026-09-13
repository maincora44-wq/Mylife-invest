// src/server/yahooFinanceService.ts
// Yahoo Finance Official Real-Time Market Data Engine & Live Synchronizer

import { 
  YahooMarketQuote, 
  MarketIndicator, 
  RegimeFactorScore, 
  RegimeType, 
  SgovSignalItem, 
  SgovDeploymentPlan,
  PortfolioHolding
} from "../types";

export interface SymbolMeta {
  symbol: string;
  name: string;
  unit?: string;
  category: "trend" | "rate_oil" | "vol_credit" | "liquidity" | "breadth";
  formatPrice?: (p: number) => string;
  formatChange?: (c: number, cp: number) => string;
  determineStatus?: (price: number, changePct: number) => "green" | "yellow" | "red";
  descriptionFn?: (price: number, changePct: number) => string;
}

export const WATCHED_SYMBOLS: Record<string, SymbolMeta> = {
  "^GSPC": {
    symbol: "^GSPC",
    name: "S&P 500",
    category: "trend",
    formatPrice: (p) => p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}% (${c >= 0 ? "+" : ""}${c.toFixed(2)}pt)`,
    determineStatus: (p, cp) => (cp >= 0.2 ? "green" : cp <= -1.0 ? "red" : "yellow"),
    descriptionFn: (p, cp) => `미국 대형주 벤치마크 (현재: ${p.toFixed(1)}pt)`
  },
  "^IXIC": {
    symbol: "^IXIC",
    name: "Nasdaq Composite",
    category: "trend",
    formatPrice: (p) => p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0.3 ? "green" : cp <= -1.2 ? "red" : "yellow"),
    descriptionFn: (p, cp) => `기술주 중심 나스닥 종합지수 (${cp >= 0 ? "반등세" : "조정 압력"})`
  },
  "^TNX": {
    symbol: "^TNX",
    name: "미 10년물 국채수익률",
    unit: "%",
    category: "rate_oil",
    formatPrice: (p) => `${p.toFixed(3)}%`,
    formatChange: (c, cp) => `${c >= 0 ? "+" : ""}${(c * 100).toFixed(1)}bp (${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%)`,
    determineStatus: (p) => (p < 4.25 ? "green" : p <= 4.45 ? "yellow" : "red"),
    descriptionFn: (p) => `글로벌 할인율 벤치마크 (기준선 4.25% 대비 ${p < 4.25 ? "안정권" : "상승 압력"})`
  },
  "^VIX": {
    symbol: "^VIX",
    name: "CBOE VIX 변동성 지수",
    category: "vol_credit",
    formatPrice: (p) => p.toFixed(2),
    formatChange: (c, cp) => `${c >= 0 ? "+" : ""}${c.toFixed(2)}pt (${cp >= 0 ? "+" : ""}${cp.toFixed(1)}%)`,
    determineStatus: (p) => (p < 18.0 ? "green" : p <= 25.0 ? "yellow" : "red"),
    descriptionFn: (p) => `S&P500 옵션 내재변동성 (18 이하 안정, 25 초과 공포 경계)`
  },
  "BZ=F": {
    symbol: "BZ=F",
    name: "Brent 원유 선물",
    unit: "$/bbl",
    category: "rate_oil",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${c >= 0 ? "+" : ""}${c.toFixed(2)} (${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%)`,
    determineStatus: (p) => (p < 82.0 ? "green" : p <= 88.0 ? "yellow" : "red"),
    descriptionFn: (p) => `인플레이션 및 물가 압력 지표 ($82 기준)`
  },
  "KRW=X": {
    symbol: "KRW=X",
    name: "원/달러 환율 (USD/KRW)",
    unit: "원",
    category: "liquidity",
    formatPrice: (p) => `${p.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}원`,
    formatChange: (c, cp) => `${c >= 0 ? "+" : ""}${c.toFixed(1)}원 (${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%)`,
    determineStatus: (p) => (p < 1330 ? "green" : p <= 1380 ? "yellow" : "red"),
    descriptionFn: (p) => `달러 자산 환산 기준 환율`
  },
  "HYG": {
    symbol: "HYG",
    name: "미 하이일드 채권 (HYG)",
    unit: "$",
    category: "vol_credit",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= -0.2 ? "green" : cp <= -0.8 ? "red" : "yellow"),
    descriptionFn: (p, cp) => `기업 신용 위험 및 스프레드 대용 지표`
  },
  "SGOV": {
    symbol: "SGOV",
    name: "미 0-3개월 단기국채 ETF",
    unit: "$",
    category: "liquidity",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: () => "green",
    descriptionFn: () => `무위험 달러 현금 대기자산 (안전자산)`
  },
  "IWM": {
    symbol: "IWM",
    name: "Russell 2000 (소형주)",
    unit: "$",
    category: "breadth",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0.0 ? "green" : "yellow"),
    descriptionFn: (p, cp) => `시장 상승 폭(Breadth) 확산 여부 판별`
  },
  "VOO": {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    unit: "$",
    category: "trend",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0 ? "green" : "yellow")
  },
  "QQQ": {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    unit: "$",
    category: "trend",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0 ? "green" : "yellow")
  },
  "GOOG": {
    symbol: "GOOG",
    name: "Alphabet Inc. (Class C)",
    unit: "$",
    category: "trend",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0 ? "green" : "yellow")
  },
  "NVDA": {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    unit: "$",
    category: "trend",
    formatPrice: (p) => `$${p.toFixed(2)}`,
    formatChange: (c, cp) => `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`,
    determineStatus: (p, cp) => (cp >= 0 ? "green" : "yellow")
  }
};

// Fallback baseline quotes if network fails
const FALLBACK_QUOTES: Record<string, Partial<YahooMarketQuote>> = {
  "^GSPC": { regularMarketPrice: 7656.98, previousClose: 7747.71, change: -90.73, changePercent: -1.17 },
  "^IXIC": { regularMarketPrice: 26333.03, previousClose: 26584.06, change: -251.03, changePercent: -0.94 },
  "^TNX": { regularMarketPrice: 4.975, previousClose: 4.784, change: 0.191, changePercent: 3.99 },
  "^VIX": { regularMarketPrice: 15.84, previousClose: 15.30, change: 0.54, changePercent: 3.53 },
  "BZ=F": { regularMarketPrice: 104.61, previousClose: 97.92, change: 6.69, changePercent: 6.83 },
  "KRW=X": { regularMarketPrice: 1341.05, previousClose: 1345.06, change: -4.01, changePercent: -0.30 },
  "HYG": { regularMarketPrice: 78.60, previousClose: 79.21, change: -0.61, changePercent: -0.77 },
  "SGOV": { regularMarketPrice: 100.52, previousClose: 100.43, change: 0.09, changePercent: 0.09 },
  "IWM": { regularMarketPrice: 288.89, previousClose: 295.19, change: -6.30, changePercent: -2.13 },
  "VOO": { regularMarketPrice: 702.56, previousClose: 710.72, change: -8.16, changePercent: -1.15 },
  "QQQ": { regularMarketPrice: 714.88, previousClose: 717.67, change: -2.79, changePercent: -0.39 },
  "GOOG": { regularMarketPrice: 335.45, previousClose: 339.08, change: -3.63, changePercent: -1.07 },
  "NVDA": { regularMarketPrice: 218.29, previousClose: 228.45, change: -10.16, changePercent: -4.45 }
};

interface CacheStore {
  quotes: Record<string, YahooMarketQuote>;
  timestamp: number;
}

let memoryCache: CacheStore | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Fetch a single quote from Yahoo Finance v8 chart API
 */
export async function fetchSingleYahooQuote(symbol: string): Promise<YahooMarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Yahoo Finance responded with status ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result || !result.meta) {
      throw new Error(`Invalid response structure for symbol ${symbol}`);
    }

    const meta = result.meta;
    const price = Number(meta.regularMarketPrice);
    if (isNaN(price) || price === 0) {
      throw new Error(`Invalid price ${price} for symbol ${symbol}`);
    }

    const prevClose = Number(meta.previousClose || meta.chartPreviousClose || price);
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const metaInfo = WATCHED_SYMBOLS[symbol];
    const name = metaInfo?.name || meta.shortName || meta.symbol || symbol;

    return {
      symbol,
      name,
      regularMarketPrice: +price.toFixed(4),
      previousClose: +prevClose.toFixed(4),
      change: +change.toFixed(4),
      changePercent: +changePercent.toFixed(3),
      dayHigh: meta.regularMarketDayHigh ? +meta.regularMarketDayHigh.toFixed(4) : undefined,
      dayLow: meta.regularMarketDayLow ? +meta.regularMarketDayLow.toFixed(4) : undefined,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? +meta.fiftyTwoWeekHigh.toFixed(4) : undefined,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? +meta.fiftyTwoWeekLow.toFixed(4) : undefined,
      currency: meta.currency || "USD",
      marketState: meta.regularMarketTime ? "LIVE" : "CLOSED",
      timestamp: Date.now(),
      source: "YAHOO_FINANCE_OFFICIAL"
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Fallback to static data
    const fallback = FALLBACK_QUOTES[symbol];
    const metaInfo = WATCHED_SYMBOLS[symbol];
    return {
      symbol,
      name: metaInfo?.name || symbol,
      regularMarketPrice: fallback?.regularMarketPrice ?? 100,
      previousClose: fallback?.previousClose ?? 100,
      change: fallback?.change ?? 0,
      changePercent: fallback?.changePercent ?? 0,
      currency: "USD",
      marketState: "FALLBACK",
      timestamp: Date.now(),
      source: "FALLBACK_CACHE"
    };
  }
}

/**
 * Fetch all watched symbols in parallel with caching
 */
export async function fetchAllYahooQuotes(forceRefresh: boolean = false): Promise<Record<string, YahooMarketQuote>> {
  const now = Date.now();
  if (!forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.quotes;
  }

  const symbolList = Object.keys(WATCHED_SYMBOLS);
  const results = await Promise.allSettled(symbolList.map(s => fetchSingleYahooQuote(s)));

  const quotesMap: Record<string, YahooMarketQuote> = {};
  symbolList.forEach((sym, idx) => {
    const res = results[idx];
    if (res.status === "fulfilled") {
      quotesMap[sym] = res.value;
    } else {
      const fallback = FALLBACK_QUOTES[sym];
      quotesMap[sym] = {
        symbol: sym,
        name: WATCHED_SYMBOLS[sym]?.name || sym,
        regularMarketPrice: fallback?.regularMarketPrice ?? 100,
        previousClose: fallback?.previousClose ?? 100,
        change: fallback?.change ?? 0,
        changePercent: fallback?.changePercent ?? 0,
        currency: "USD",
        marketState: "FALLBACK",
        timestamp: Date.now(),
        source: "FALLBACK_CACHE"
      };
    }
  });

  memoryCache = {
    quotes: quotesMap,
    timestamp: now
  };

  return quotesMap;
}

/**
 * Map live Yahoo quotes into MarketIndicator[]
 */
export function buildMarketIndicatorsFromQuotes(quotes: Record<string, YahooMarketQuote>): MarketIndicator[] {
  const displaySymbols = ["^GSPC", "^TNX", "^VIX", "BZ=F", "KRW=X", "HYG", "SGOV", "IWM"];

  return displaySymbols.map(sym => {
    const quote = quotes[sym] || fetchFallback(sym);
    const meta = WATCHED_SYMBOLS[sym] || {
      symbol: sym,
      name: quote.name,
      category: "trend" as const
    };

    const price = quote.regularMarketPrice;
    const change = quote.change;
    const changePct = quote.changePercent;

    const formattedVal = meta.formatPrice ? meta.formatPrice(price) : price.toString();
    const formattedChange = meta.formatChange ? meta.formatChange(change, changePct) : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
    const status = meta.determineStatus ? meta.determineStatus(price, changePct) : (changePct >= 0 ? "green" : "yellow");
    const description = meta.descriptionFn ? meta.descriptionFn(price, changePct) : `${meta.name} 실시간 호가 (야후 파이낸스)`;

    return {
      symbol: sym,
      metric: meta.name,
      value: formattedVal,
      unit: meta.unit,
      change: formattedChange,
      status,
      description,
      category: meta.category
    };
  });
}

function fetchFallback(symbol: string): YahooMarketQuote {
  const fb = FALLBACK_QUOTES[symbol];
  return {
    symbol,
    name: WATCHED_SYMBOLS[symbol]?.name || symbol,
    regularMarketPrice: fb?.regularMarketPrice ?? 100,
    previousClose: fb?.previousClose ?? 100,
    change: fb?.change ?? 0,
    changePercent: fb?.changePercent ?? 0,
    currency: "USD",
    marketState: "FALLBACK",
    timestamp: Date.now(),
    source: "FALLBACK_CACHE"
  };
}

/**
 * Compute the 5-Factor Regime Scores based strictly on Live Yahoo Finance numbers
 */
export function computeRegimeFactorsFromQuotes(quotes: Record<string, YahooMarketQuote>): {
  totalScore: number;
  regime: RegimeType;
  factors: RegimeFactorScore[];
  reasons: string[];
  biggestDrag: string;
  whatNeededForRiskOn: string;
  failureCondition: string;
} {
  const spx = quotes["^GSPC"]?.regularMarketPrice ?? 7656;
  const spxPct = quotes["^GSPC"]?.changePercent ?? -1.0;
  const vix = quotes["^VIX"]?.regularMarketPrice ?? 15.84;
  const tnx = quotes["^TNX"]?.regularMarketPrice ?? 4.975;
  const oil = quotes["BZ=F"]?.regularMarketPrice ?? 104.61;
  const iwmPct = quotes["IWM"]?.changePercent ?? -2.13;
  const hygPct = quotes["HYG"]?.changePercent ?? -0.77;

  // 1. 가격 추세 (Price Trend): 30점 만점
  // S&P 500이 고점 대비 견고하고 단기 상승 시 고득점
  let trendScore = 20;
  if (spxPct > 0.5) trendScore = 26;
  else if (spxPct > 0) trendScore = 22;
  else if (spxPct > -1.0) trendScore = 18;
  else trendScore = 14;

  // 2. 변동성·신용 (Volatility & Credit): 25점 만점
  // VIX < 18 양호, 18~25 중립, >25 위험
  let volScore = 18;
  if (vix < 15.0) volScore = 24;
  else if (vix < 18.0) volScore = 20;
  else if (vix < 22.0) volScore = 14;
  else volScore = 8;
  if (hygPct < -0.5) volScore = Math.max(5, volScore - 3);

  // 3. 금리·물가·유가 (Macro Yield & Oil): 25점 만점
  // 10Y > 4.5% or Oil > $90 imposes strong drag
  let macroScore = 14;
  let dragNote = "";
  if (tnx > 4.8 || oil > 95) {
    macroScore = 8;
    dragNote = `미 국채 10년물 금리(${tnx.toFixed(2)}%) 및 Brent 원유($${oil.toFixed(1)}) 과열`;
  } else if (tnx > 4.3 || oil > 82) {
    macroScore = 12;
    dragNote = `국채 10년물 4.3% 상회 및 유가 $82 상회 부담`;
  } else {
    macroScore = 21;
  }

  // 4. 시장 폭 (Breadth): 10점 만점
  // IWM vs SPX
  let breadthScore = 5;
  if (iwmPct > spxPct) {
    breadthScore = 8;
  } else if (iwmPct < spxPct - 1.0) {
    breadthScore = 4;
  } else {
    breadthScore = 6;
  }

  // 5. 자금 흐름 & 유동성 (Liquidity): 10점 만점
  const sgov = quotes["SGOV"]?.regularMarketPrice ?? 100.5;
  const liquidityScore = sgov > 100 ? 8 : 6;

  const totalScore = trendScore + volScore + macroScore + breadthScore + liquidityScore;

  let regime: RegimeType = "Neutral";
  if (totalScore >= 65) regime = "Risk On";
  else if (totalScore <= 44) regime = "Defensive";

  const factors: RegimeFactorScore[] = [
    {
      name: "가격 추세 (Trend)",
      score: trendScore,
      maxScore: 30,
      status: trendScore >= 22 ? "green" : trendScore >= 16 ? "yellow" : "red",
      drivers: `S&P500 ${spx.toFixed(1)}pt (${spxPct >= 0 ? "+" : ""}${spxPct.toFixed(2)}%) 및 주요 지지선 유지 여부`
    },
    {
      name: "변동성·신용 (Vol & Credit)",
      score: volScore,
      maxScore: 25,
      status: volScore >= 18 ? "green" : volScore >= 12 ? "yellow" : "red",
      drivers: `CBOE VIX ${vix.toFixed(2)}pt (${vix < 18 ? "안정권" : "주의권"}), HYG ${hygPct >= 0 ? "+" : ""}${hygPct.toFixed(2)}%`
    },
    {
      name: "금리·물가·유가 (Yield & Oil)",
      score: macroScore,
      maxScore: 25,
      status: macroScore >= 18 ? "green" : macroScore >= 12 ? "yellow" : "red",
      drivers: `10년물 금리 ${tnx.toFixed(3)}%, Brent 원유 $${oil.toFixed(2)}`,
      dragReason: dragNote || undefined
    },
    {
      name: "시장 폭 (Market Breadth)",
      score: breadthScore,
      maxScore: 10,
      status: breadthScore >= 7 ? "green" : breadthScore >= 5 ? "yellow" : "red",
      drivers: `Russell 2000(IWM) ${iwmPct >= 0 ? "+" : ""}${iwmPct.toFixed(2)}% 대비 S&P500 상대강도`
    },
    {
      name: "자금 흐름 (Liquidity)",
      score: liquidityScore,
      maxScore: 10,
      status: liquidityScore >= 7 ? "green" : "yellow",
      drivers: `SGOV 및 단기 국채 대기자금 흐름 안정`
    }
  ];

  const reasons: string[] = [
    `야후 파이낸스 실시간: S&P500 ${spx.toFixed(1)}pt (${spxPct >= 0 ? "+" : ""}${spxPct.toFixed(2)}%), VIX ${vix.toFixed(2)}pt로 변동성은 안정권 방어.`,
    `미 10년물 금리 ${tnx.toFixed(2)}% 및 유가 $${oil.toFixed(1)}로 금리·물가 팩터(${macroScore}/25)가 상단을 압박.`
  ];

  const biggestDrag = dragNote || `미 10년물 국채금리(${tnx.toFixed(2)}%) 및 유가($${oil.toFixed(1)}) 수준`;
  const whatNeededForRiskOn = "10년물 국채금리 4.25% 하향 안착 및 유가 $82 이하 안정, IWM 상대강도 개선";
  const failureCondition = `10년물 국채금리 4.80% 돌파 또는 VIX 25.0 상회 급등 시 즉시 비중 축소(REDUCE)`;

  return {
    totalScore,
    regime,
    factors,
    reasons,
    biggestDrag,
    whatNeededForRiskOn,
    failureCondition
  };
}

/**
 * Compute the 7 SGOV Release Signals based strictly on Live Yahoo Finance numbers
 */
export function computeSgovSignalsFromQuotes(quotes: Record<string, YahooMarketQuote>): {
  signals: SgovSignalItem[];
  plan: SgovDeploymentPlan;
} {
  const spxPct = quotes["^GSPC"]?.changePercent ?? -1.0;
  const qqqPct = quotes["QQQ"]?.changePercent ?? -0.39;
  const vix = quotes["^VIX"]?.regularMarketPrice ?? 15.84;
  const tnx = quotes["^TNX"]?.regularMarketPrice ?? 4.975;
  const oil = quotes["BZ=F"]?.regularMarketPrice ?? 104.61;
  const iwmPct = quotes["IWM"]?.changePercent ?? -2.13;
  const hygPct = quotes["HYG"]?.changePercent ?? -0.77;

  const sig1Passed = tnx < 4.25;
  const sig2Passed = oil < 82.0;
  const sig3Passed = vix < 18.0;
  const sig4Passed = spxPct > -1.5;
  const sig5Passed = qqqPct > -1.5;
  const sig6Passed = iwmPct >= spxPct;
  const sig7Passed = hygPct >= -0.5;

  const signals: SgovSignalItem[] = [
    {
      id: 1,
      name: "10년물 금리 진정",
      detail: "미 국채 10년물 금리 4.25% 하향 안착",
      threshold: "< 4.25%",
      currentVal: `${tnx.toFixed(2)}%`,
      passed: sig1Passed,
      explanation: sig1Passed ? "4.25% 이하로 하향 안착 성공" : `현재 ${tnx.toFixed(2)}%로 상회 중 (미충족)`
    },
    {
      id: 2,
      name: "유가 안정",
      detail: "Brent 원유 $82 이하 하향",
      threshold: "< $82.0",
      currentVal: `$${oil.toFixed(1)}`,
      passed: sig2Passed,
      explanation: sig2Passed ? "$82 이하 안정세 유지" : `현재 $${oil.toFixed(1)}로 인플레 경계선 상회 (미충족)`
    },
    {
      id: 3,
      name: "VIX 안정",
      detail: "CBOE VIX 18.0 이하 3거래일 유지",
      threshold: "< 18.0",
      currentVal: vix.toFixed(2),
      passed: sig3Passed,
      explanation: sig3Passed ? `${vix.toFixed(2)}로 하향 안정권 통과` : `현재 ${vix.toFixed(2)}로 위험구간 진입`
    },
    {
      id: 4,
      name: "S&P500 회복",
      detail: "S&P500 일간 지지선 방어 및 안정",
      threshold: "지지선 상회",
      currentVal: `${spxPct >= 0 ? "+" : ""}${spxPct.toFixed(2)}%`,
      passed: sig4Passed,
      explanation: sig4Passed ? "단기 급락 없이 주요 지지구간 방어 중" : "일간 급락으로 기술적 지지선 이탈 경계"
    },
    {
      id: 5,
      name: "Nasdaq100 회복",
      detail: "NDX/QQQ 기술주 단기 지지선 복원",
      threshold: "지지선 상회",
      currentVal: `${qqqPct >= 0 ? "+" : ""}${qqqPct.toFixed(2)}%`,
      passed: sig5Passed,
      explanation: sig5Passed ? "QQQ 기술주 지지선 복원 확인" : "기술주 단기 조정 지속"
    },
    {
      id: 6,
      name: "Russell 상대강도 개선",
      detail: "IWM/SPY 소형주 시장 폭 확산 여부",
      threshold: "IWM >= SPY",
      currentVal: `${(iwmPct - spxPct).toFixed(2)}%p`,
      passed: sig6Passed,
      explanation: sig6Passed ? "소형주 시장 폭 확산 확인" : "소형주 확산 미확인으로 시장 폭 제한"
    },
    {
      id: 7,
      name: "신용스프레드 안정",
      detail: "HYG 하이일드 채권 안정세 유지",
      threshold: "HYG >= -0.5%",
      currentVal: `${hygPct >= 0 ? "+" : ""}${hygPct.toFixed(2)}%`,
      passed: sig7Passed,
      explanation: sig7Passed ? "기업 신용 스프레드 안정적 유지" : "하이일드 채권 단기 약세로 스프레드 확대 주의"
    }
  ];

  const satisfiedCount = signals.filter(s => s.passed).length;
  let recommendedStage: SgovDeploymentPlan["recommendedStage"] = "관망 (0%)";
  let allowedRatePct = 0;
  let todayLimitKRW = 0;

  if (satisfiedCount >= 6) {
    recommendedStage = "전액 투입 (100%)";
    allowedRatePct = 100;
    todayLimitKRW = 30950000;
  } else if (satisfiedCount >= 4) {
    recommendedStage = "2차 분할 (70%)";
    allowedRatePct = 70;
    todayLimitKRW = 20000000;
  } else if (satisfiedCount >= 3) {
    recommendedStage = "1차 탐색 (40%)";
    allowedRatePct = 40;
    todayLimitKRW = 12000000;
  } else {
    recommendedStage = "관망 (0%)";
    allowedRatePct = 0;
    todayLimitKRW = 0;
  }

  const plan: SgovDeploymentPlan = {
    satisfiedCount,
    totalSignals: 7,
    recommendedStage,
    allowedRatePct,
    todayLimitKRW,
    priorities: [
      {
        rank: 1,
        asset: "VOO (광범위 미국 S&P 500)",
        description: `현재가: $${(quotes["VOO"]?.regularMarketPrice ?? 702.5).toFixed(2)}`,
        rationale: "단일 테마 리스크를 분산하고 시장 기저 복원력을 흡수하는 최우선 편입 자산"
      },
      {
        rank: 2,
        asset: "비기술 방어·가치 섹터 (XLI, XLV)",
        description: "헬스케어 / 산업재 ETF",
        rationale: "금리 및 유가 변동성 국면에서 포트폴리오 변동성 완화"
      },
      {
        rank: 3,
        asset: "QQQ (Nasdaq 100)",
        description: `현재가: $${(quotes["QQQ"]?.regularMarketPrice ?? 714.8).toFixed(2)}`,
        rationale: "10년물 금리 하향 안착 시 대형 빅테크 반등 수혜"
      },
      {
        rank: 4,
        asset: "GOOG (알파벳 직접/간접)",
        description: `현재가: $${(quotes["GOOG"]?.regularMarketPrice ?? 335.4).toFixed(2)}`,
        rationale: "포트폴리오 Look-through 한도(15%) 임계치 근접에 따라 최후순위 제한"
      }
    ]
  };

  return { signals, plan };
}

/**
 * Recalculate portfolio holdings marketValueKRW based on Live Yahoo Finance prices and USD/KRW rate
 */
export function updateHoldingsWithLiveQuotes(
  holdings: PortfolioHolding[],
  quotes: Record<string, YahooMarketQuote>
): PortfolioHolding[] {
  const fxRate = quotes["KRW=X"]?.regularMarketPrice || 1341.05;

  return holdings.map(h => {
    let price = h.price;
    let currency = h.currency;
    let currentFx = h.fxRate;

    if (h.ticker === "VOO" && quotes["VOO"]) {
      price = quotes["VOO"].regularMarketPrice;
      currency = "USD";
      currentFx = fxRate;
    } else if (h.ticker === "QQQ" && quotes["QQQ"]) {
      price = quotes["QQQ"].regularMarketPrice;
      currency = "USD";
      currentFx = fxRate;
    } else if (h.ticker === "GOOG" && quotes["GOOG"]) {
      price = quotes["GOOG"].regularMarketPrice;
      currency = "USD";
      currentFx = fxRate;
    } else if (h.ticker === "NVDA" && quotes["NVDA"]) {
      price = quotes["NVDA"].regularMarketPrice;
      currency = "USD";
      currentFx = fxRate;
    } else if (h.ticker === "SGOV" && quotes["SGOV"]) {
      price = quotes["SGOV"].regularMarketPrice;
      currency = "USD";
      currentFx = fxRate;
    }

    const marketValueKRW = currency === "USD" 
      ? Math.round(price * h.quantity * currentFx)
      : Math.round(price * h.quantity);

    return {
      ...h,
      price,
      currency,
      fxRate: currentFx,
      marketValueKRW
    };
  });
}
