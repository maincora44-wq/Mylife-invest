// src/server/reliabilityTest.ts
// Yahoo Finance Official Data Engine Automated Reliability Test Suite

import { 
  ReliabilityTestCase, 
  ReliabilityTestSuiteResult, 
  YahooMarketQuote,
  PortfolioHolding 
} from "../types";
import { 
  fetchSingleYahooQuote, 
  fetchAllYahooQuotes, 
  updateHoldingsWithLiveQuotes,
  computeRegimeFactorsFromQuotes,
  computeSgovSignalsFromQuotes
} from "./yahooFinanceService";
import { initialHoldings } from "../data/initialData";

export async function runYahooFinanceReliabilityTest(): Promise<ReliabilityTestSuiteResult> {
  const startTime = Date.now();
  const testCases: ReliabilityTestCase[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // -------------------------------------------------------------
  // Test 1: Connectivity & Latency Test (벤치마크 연결 및 응답 지연)
  // -------------------------------------------------------------
  const t1Start = Date.now();
  let quotesSnapshot: Record<string, YahooMarketQuote> = {};
  try {
    quotesSnapshot = await fetchAllYahooQuotes(true); // Force fresh
    const t1Duration = Date.now() - t1Start;
    const symbols = Object.keys(quotesSnapshot);

    const isConnected = symbols.length >= 8 && quotesSnapshot["^GSPC"]?.regularMarketPrice > 0;
    if (isConnected) {
      passedCount++;
      testCases.push({
        id: "TC-01",
        name: "야후 파이낸스 실시간 API 연결성 및 레이턴시 검증",
        category: "CONNECTIVITY",
        status: "PASSED",
        latencyMs: t1Duration,
        details: `총 ${symbols.length}개 핵심 종목 실시간 수신 완료 (평균 응답: ${Math.round(t1Duration / symbols.length)}ms)`,
        dataPoints: {
          symbolsCount: symbols.length,
          spxPrice: quotesSnapshot["^GSPC"]?.regularMarketPrice,
          spxSource: quotesSnapshot["^GSPC"]?.source,
          totalDurationMs: t1Duration
        }
      });
    } else {
      failedCount++;
      testCases.push({
        id: "TC-01",
        name: "야후 파이낸스 실시간 API 연결성 및 레이턴시 검증",
        category: "CONNECTIVITY",
        status: "FAILED",
        latencyMs: t1Duration,
        details: "야후 파이낸스 연결 실패 또는 유효 종목 누락"
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-01",
      name: "야후 파이낸스 실시간 API 연결성 및 레이턴시 검증",
      category: "CONNECTIVITY",
      status: "FAILED",
      latencyMs: Date.now() - t1Start,
      details: `오류 발생: ${err.message}`
    });
  }

  // -------------------------------------------------------------
  // Test 2: Schema & Type Integrity (데이터 스키마 및 수치 무결성)
  // -------------------------------------------------------------
  const t2Start = Date.now();
  try {
    const requiredKeys = ["^GSPC", "^TNX", "^VIX", "BZ=F", "KRW=X", "HYG"];
    let schemaPassed = true;
    const errors: string[] = [];

    for (const key of requiredKeys) {
      const q = quotesSnapshot[key];
      if (!q) {
        schemaPassed = false;
        errors.push(`${key}: 종목 데이터 누락`);
        continue;
      }
      if (!Number.isFinite(q.regularMarketPrice) || q.regularMarketPrice <= 0) {
        schemaPassed = false;
        errors.push(`${key}: 가격 비정상 (${q.regularMarketPrice})`);
      }
      if (!Number.isFinite(q.changePercent)) {
        schemaPassed = false;
        errors.push(`${key}: 등락률 NaN/비정상`);
      }
      if (!q.currency || typeof q.currency !== "string") {
        schemaPassed = false;
        errors.push(`${key}: 통화 코드 부재`);
      }
    }

    const t2Duration = Date.now() - t2Start;
    if (schemaPassed) {
      passedCount++;
      testCases.push({
        id: "TC-02",
        name: "핵심 지표 스키마 및 부동소수점 무결성 검증 (NaN / Null 배제)",
        category: "SCHEMA_INTEGRITY",
        status: "PASSED",
        latencyMs: t2Duration,
        details: `검사 대상 6개 핵심 지표의 regularMarketPrice, changePercent, currency 스키마 100% 일치`,
        dataPoints: { checkedCount: requiredKeys.length, errors: [] }
      });
    } else {
      failedCount++;
      testCases.push({
        id: "TC-02",
        name: "핵심 지표 스키마 및 부동소수점 무결성 검증 (NaN / Null 배제)",
        category: "SCHEMA_INTEGRITY",
        status: "FAILED",
        latencyMs: t2Duration,
        details: `스키마 위반 항목 검출: ${errors.join(", ")}`
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-02",
      name: "핵심 지표 스키마 및 부동소수점 무결성 검증",
      category: "SCHEMA_INTEGRITY",
      status: "FAILED",
      latencyMs: Date.now() - t2Start,
      details: err.message
    });
  }

  // -------------------------------------------------------------
  // Test 3: Domain Range & Sanity Check (금융 도메인 이상치/경계선 검증)
  // -------------------------------------------------------------
  const t3Start = Date.now();
  try {
    const spx = quotesSnapshot["^GSPC"]?.regularMarketPrice ?? 0;
    const tnx = quotesSnapshot["^TNX"]?.regularMarketPrice ?? 0;
    const vix = quotesSnapshot["^VIX"]?.regularMarketPrice ?? 0;
    const oil = quotesSnapshot["BZ=F"]?.regularMarketPrice ?? 0;
    const krw = quotesSnapshot["KRW=X"]?.regularMarketPrice ?? 0;

    const rangeChecks = [
      { name: "S&P 500 (2,000 ~ 15,000 pt)", passed: spx >= 2000 && spx <= 15000, val: spx },
      { name: "미 10년물 국채수익률 (0.5% ~ 15.0%)", passed: tnx >= 0.5 && tnx <= 15.0, val: tnx },
      { name: "VIX 변동성 지수 (5.0 ~ 120.0 pt)", passed: vix >= 5.0 && vix <= 120.0, val: vix },
      { name: "Brent 원유 선물 ($20 ~ $250/bbl)", passed: oil >= 20.0 && oil <= 250.0, val: oil },
      { name: "원/달러 환율 (900 ~ 2,000 KRW)", passed: krw >= 900 && krw <= 2000, val: krw }
    ];

    const allRangePassed = rangeChecks.every(r => r.passed);
    const t3Duration = Date.now() - t3Start;

    if (allRangePassed) {
      passedCount++;
      testCases.push({
        id: "TC-03",
        name: "금융 도메인 허용 범위(Sanity Bounds) 및 극단값 필터링 검증",
        category: "RANGE_SANITY",
        status: "PASSED",
        latencyMs: t3Duration,
        details: `S&P500(${spx.toFixed(1)}pt), 10년물(${tnx.toFixed(2)}%), VIX(${vix.toFixed(2)}), 유가($${oil.toFixed(1)}), 환율(${krw.toFixed(1)}원) 모두 경제적 현실 범위 내 부합`,
        dataPoints: { rangeChecks }
      });
    } else {
      failedCount++;
      const failedList = rangeChecks.filter(r => !r.passed).map(r => `${r.name}: ${r.val}`);
      testCases.push({
        id: "TC-03",
        name: "금융 도메인 허용 범위(Sanity Bounds) 및 극단값 필터링 검증",
        category: "RANGE_SANITY",
        status: "FAILED",
        latencyMs: t3Duration,
        details: `비정상 수치 검출: ${failedList.join("; ")}`
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-03",
      name: "금융 도메인 허용 범위 검증",
      category: "RANGE_SANITY",
      status: "FAILED",
      latencyMs: Date.now() - t3Start,
      details: err.message
    });
  }

  // -------------------------------------------------------------
  // Test 4: Portfolio Holdings Valuation & FX Conversion Math
  // -------------------------------------------------------------
  const t4Start = Date.now();
  try {
    const updatedHoldings = updateHoldingsWithLiveQuotes(initialHoldings, quotesSnapshot);
    const totalEvalKRW = updatedHoldings.reduce((sum, h) => sum + h.marketValueKRW, 0);
    const hasZeroOrNegative = updatedHoldings.some(h => h.marketValueKRW <= 0);
    const usdHolding = updatedHoldings.find(h => h.currency === "USD" && h.ticker === "VOO");
    const fxRate = quotesSnapshot["KRW=X"]?.regularMarketPrice || 1341.05;

    // Verify mathematical correctness of VOO: marketValueKRW === Math.round(quantity * price * fxRate)
    let mathAccurate = true;
    if (usdHolding) {
      const expected = Math.round(usdHolding.quantity * usdHolding.price * fxRate);
      if (Math.abs(usdHolding.marketValueKRW - expected) > 5) {
        mathAccurate = false;
      }
    }

    const t4Duration = Date.now() - t4Start;
    if (!hasZeroOrNegative && totalEvalKRW > 100000000 && mathAccurate) {
      passedCount++;
      testCases.push({
        id: "TC-04",
        name: "실시간 환율(USD/KRW) 적용 포트폴리오 평가액 및 비중 보존 검증",
        category: "PORTFOLIO_MATH",
        status: "PASSED",
        latencyMs: t4Duration,
        details: `총 ${updatedHoldings.length}개 보유 자산 평가 총액 ${(totalEvalKRW / 100000000).toFixed(2)}억원 정확 산출, 환율(${fxRate.toFixed(1)}원) 환산 정밀 일치`,
        dataPoints: {
          totalEvalKRW,
          fxRate,
          vooPrice: quotesSnapshot["VOO"]?.regularMarketPrice,
          vooEvalKRW: usdHolding?.marketValueKRW
        }
      });
    } else {
      failedCount++;
      testCases.push({
        id: "TC-04",
        name: "실시간 환율 적용 포트폴리오 평가액 검증",
        category: "PORTFOLIO_MATH",
        status: "FAILED",
        latencyMs: t4Duration,
        details: `평가액 계산 이상: totalEvalKRW=${totalEvalKRW}, mathAccurate=${mathAccurate}`
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-04",
      name: "포트폴리오 환산 계산 검증",
      category: "PORTFOLIO_MATH",
      status: "FAILED",
      latencyMs: Date.now() - t4Start,
      details: err.message
    });
  }

  // -------------------------------------------------------------
  // Test 5: Fallback & Resilience on Unknown / Faulty Symbol
  // -------------------------------------------------------------
  const t5Start = Date.now();
  try {
    const fakeSymbol = "NON_EXISTENT_BENCHMARK_XYZ999";
    const fallbackQuote = await fetchSingleYahooQuote(fakeSymbol);
    const t5Duration = Date.now() - t5Start;

    if (fallbackQuote && fallbackQuote.source === "FALLBACK_CACHE" && Number.isFinite(fallbackQuote.regularMarketPrice)) {
      passedCount++;
      testCases.push({
        id: "TC-05",
        name: "장애 격리 및 비상 폴백(Graceful Fallback) 내결함성 검증",
        category: "FALLBACK_RESILIENCE",
        status: "PASSED",
        latencyMs: t5Duration,
        details: `존재하지 않는 가상 티커(${fakeSymbol}) 조회 시 비정상 종료 없이 안전 기본값(source: FALLBACK_CACHE)으로 즉시 방어 성공`,
        dataPoints: {
          fallbackPrice: fallbackQuote.regularMarketPrice,
          fallbackSource: fallbackQuote.source
        }
      });
    } else {
      failedCount++;
      testCases.push({
        id: "TC-05",
        name: "장애 격리 및 비상 폴백 내결함성 검증",
        category: "FALLBACK_RESILIENCE",
        status: "FAILED",
        latencyMs: t5Duration,
        details: "폴백 데이터 처리 실패"
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-05",
      name: "장애 격리 및 비상 폴백 내결함성 검증",
      category: "FALLBACK_RESILIENCE",
      status: "FAILED",
      latencyMs: Date.now() - t5Start,
      details: err.message
    });
  }

  // -------------------------------------------------------------
  // Test 6: Deterministic Regime Engine Rule Evaluation
  // -------------------------------------------------------------
  const t6Start = Date.now();
  try {
    const regimeOutput = computeRegimeFactorsFromQuotes(quotesSnapshot);
    const sgovOutput = computeSgovSignalsFromQuotes(quotesSnapshot);

    const scoreInRange = regimeOutput.totalScore >= 0 && regimeOutput.totalScore <= 100;
    const signalsCountCorrect = sgovOutput.signals.length === 7;
    const t6Duration = Date.now() - t6Start;

    if (scoreInRange && signalsCountCorrect) {
      passedCount++;
      testCases.push({
        id: "TC-06",
        name: "야후 실시간 데이터 기반 5대 레짐 스코어 & 7대 SGOV 신호 판정 검증",
        category: "SCHEMA_INTEGRITY",
        status: "PASSED",
        latencyMs: t6Duration,
        details: `레짐 점수 ${regimeOutput.totalScore}점(${regimeOutput.regime}), SGOV 투입 신호 ${sgovOutput.plan.satisfiedCount}/7개 정상 판정`,
        dataPoints: {
          regimeScore: regimeOutput.totalScore,
          regime: regimeOutput.regime,
          sgovSatisfied: sgovOutput.plan.satisfiedCount,
          recommendedStage: sgovOutput.plan.recommendedStage
        }
      });
    } else {
      failedCount++;
      testCases.push({
        id: "TC-06",
        name: "레짐 스코어 및 SGOV 신호 판정 검증",
        category: "SCHEMA_INTEGRITY",
        status: "FAILED",
        latencyMs: t6Duration,
        details: `규칙 계산 이상: score=${regimeOutput.totalScore}, signalsCount=${sgovOutput.signals.length}`
      });
    }
  } catch (err: any) {
    failedCount++;
    testCases.push({
      id: "TC-06",
      name: "레짐 스코어 및 SGOV 신호 판정 검증",
      category: "SCHEMA_INTEGRITY",
      status: "FAILED",
      latencyMs: Date.now() - t6Start,
      details: err.message
    });
  }

  const totalDurationMs = Date.now() - startTime;
  const totalTests = testCases.length;
  const scorePct = Math.round((passedCount / totalTests) * 100);
  const overallStatus: ReliabilityTestSuiteResult["overallStatus"] = 
    failedCount === 0 ? "PASSED" : failedCount <= 1 ? "WARNING" : "FAILED";

  return {
    executedAt: new Date().toISOString(),
    overallStatus,
    scorePct,
    totalDurationMs,
    totalTests,
    passedTests: passedCount,
    failedTests: failedCount,
    testCases,
    quotesSnapshot
  };
}
