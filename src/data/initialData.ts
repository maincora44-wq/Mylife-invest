import {
  PortfolioHolding,
  MarketIndicator,
  RegimeFactorScore,
  RegimeState,
  SgovSignalItem,
  SgovDeploymentPlan,
  MacroEvent,
  DecisionJournalEntry,
  IPOWatchItem,
  TeamsAdaptiveCardNotification,
  PlatformOption
} from "../types";

export const initialRegimeState: RegimeState = {
  asOf: "2026-09-12",
  regime: "Neutral",
  regimeScore: 56,
  confidence: 0.72,
  currentStockWeight: 0.384,
  targetStockWeight: 0.46,
  shortageWeightPct: 7.6,
  deployableAmountKRW: 30950000,
  dailyMaxOrderKRW: 5000000,
  action: "WAIT",
  nextEvent: "FOMC 금리결정",
  daysToEvent: 1,
  reasonsWhyScoreChanged: [
    "VIX 15.4선으로 하향 안정화되며 변동성 지표 +3점 개선",
    "S&P500 50일선 지지 확인으로 가격추세 팩터 점수 방어 (+2점)",
    "반면 미국 10년물 금리(4.29%) 상승 및 Brent 유가($83.8) 급등으로 금리·유가 팩터가 -4점 악화"
  ],
  biggestDragFactor: "금리·물가·유가 팩터 (8 / 25점 - 급격한 국채발행 부담 및 WTI/Brent 반등)",
  whatNeededForRiskOn: "미 10년물 국채수익률 4.15% 하향 안착 + Brent $80 이하 하향 + FOMC 통과 후 불확실성 해소",
  failureConditionDefensive: "미 10년물 4.45% 돌파 또는 S&P500 200일선 이탈 시 즉시 Defensive(점수 40점 이하)로 전환"
};

export const initialFactorScores: RegimeFactorScore[] = [
  { name: "가격 추세", score: 22, maxScore: 30, status: "green", drivers: "S&P500 50일선 지지 유지, 모멘텀 양호", dragReason: "소형주(IWM) 이탈 징후" },
  { name: "금리·물가·유가", score: 8, maxScore: 25, status: "red", drivers: "기저 물가 둔화세는 유지", dragReason: "10년물 4.29% 재상승, WTI/Brent 단기 급등" },
  { name: "변동성·신용", score: 15, maxScore: 20, status: "green", drivers: "VIX 15.42 안정화, 투하자본 풋옵션 비중 축소", dragReason: "하이일드 단기 스프레드 소폭 확대" },
  { name: "순유동성", score: 5, maxScore: 15, status: "yellow", drivers: "연준 대차대조표 축소 속도 조절", dragReason: "재무부 TGA 계정 환수 증가로 순유동성 정체" },
  { name: "실적·시장 폭", score: 6, maxScore: 10, status: "yellow", drivers: "빅테크 잉여현금흐름 견조", dragReason: "상승 종목 수 대비 하락 종목 수 편중 지속" }
];

export const initialMarketIndicators: MarketIndicator[] = [
  { symbol: "SPX", metric: "S&P500", value: "5,684.2", change: "+0.42%", status: "green", description: "50일 이동평균선 상회 유지", category: "trend" },
  { symbol: "NDX", metric: "Nasdaq 100", value: "19,820.5", change: "+0.31%", status: "green", description: "빅테크 분할 매수세 유입", category: "trend" },
  { symbol: "RUT", metric: "Russell 2000", value: "2,145.8", change: "-0.54%", status: "yellow", description: "금리 민감 중소형주 상대적 약세", category: "breadth" },
  { symbol: "US10Y", metric: "미국 10년물", value: "4.29%", change: "+5.2bp", status: "red", description: "장기채 발행 물량 소화 부담", category: "rate_oil" },
  { symbol: "VIX", metric: "변동성 지수", value: "15.42", change: "-0.65", status: "green", description: "옵션 내재변동성 20선 아래 안정", category: "vol_credit" },
  { symbol: "BRENT", metric: "Brent 원유", value: "$83.82", change: "+1.78%", status: "red", description: "중동 지정학 긴장 및 재고 감소", category: "rate_oil" },
  { symbol: "HYG_SPD", metric: "하이일드 스프레드", value: "342bp", change: "+4bp", status: "yellow", description: "350bp 경계선 근접 주시", category: "vol_credit" },
  { symbol: "NET_LIQ", metric: "연준 순유동성", value: "$6.12T", change: "-0.2%", status: "yellow", description: "TGA 잔고 축적으로 미약한 위축", category: "liquidity" }
];

export const initialHoldings: PortfolioHolding[] = [
  {
    holdingId: "H-001",
    asOfDate: "2026-09-12",
    account: "메인 위탁계좌",
    accountType: "위탁",
    ticker: "GOOGL",
    assetName: "Alphabet Inc. Class A",
    quantity: 230,
    price: 178.5,
    currency: "USD",
    fxRate: 1370,
    marketValueKRW: 56247000,
    costKRW: 48000000,
    assetClass: "주식",
    sector: "Communication Services / AI",
    riskBucket: "GOOG 직접/간접",
    tradable: true,
    restricted: false,
    taxConstraint: "해외주식 양도소득세 (기본공제 한도 내 관리)",
    lookThroughUnderlying: { googExposurePct: 100, notes: "직접 단일 종목 보유 (비중 10.8%)" }
  },
  {
    holdingId: "H-002",
    asOfDate: "2026-09-12",
    account: "메인 위탁계좌",
    accountType: "위탁",
    ticker: "QQQ",
    assetName: "Invesco QQQ Trust",
    quantity: 110,
    price: 492.0,
    currency: "USD",
    fxRate: 1370,
    marketValueKRW: 74144400,
    costKRW: 68500000,
    assetClass: "주식",
    sector: "Tech / Growth",
    riskBucket: "Nasdaq100",
    tradable: true,
    restricted: false,
    taxConstraint: "해외주식 양도소득세",
    lookThroughUnderlying: { googExposurePct: 5.8, semisExposurePct: 16.2, notes: "QQQ 내 Alphabet 5.8% 실질 포함" }
  },
  {
    holdingId: "H-003",
    asOfDate: "2026-09-12",
    account: "메인 위탁계좌",
    accountType: "위탁",
    ticker: "VOO",
    assetName: "Vanguard S&P 500 ETF",
    quantity: 125,
    price: 520.4,
    currency: "USD",
    fxRate: 1370,
    marketValueKRW: 89118500,
    costKRW: 82000000,
    assetClass: "주식",
    sector: "Broad US Equity",
    riskBucket: "광범위 미국주식",
    tradable: true,
    restricted: false,
    taxConstraint: "해외주식 양도소득세",
    lookThroughUnderlying: { googExposurePct: 3.9, semisExposurePct: 10.4, notes: "VOO 내 Alphabet 3.9% 실질 포함" }
  },
  {
    holdingId: "H-004",
    asOfDate: "2026-09-12",
    account: "메인 위탁계좌",
    accountType: "위탁",
    ticker: "SMH",
    assetName: "VanEck Semiconductor ETF",
    quantity: 90,
    price: 248.0,
    currency: "USD",
    fxRate: 1370,
    marketValueKRW: 30578400,
    costKRW: 27500000,
    assetClass: "주식",
    sector: "Semiconductor",
    riskBucket: "반도체",
    tradable: true,
    restricted: false,
    taxConstraint: "해외주식 양도소득세",
    lookThroughUnderlying: { semisExposurePct: 100, notes: "반도체 100% 직결 노출" }
  },
  {
    holdingId: "H-005",
    asOfDate: "2026-09-12",
    account: "연금저축/IRP",
    accountType: "연금저축",
    ticker: "411060",
    assetName: "ACE KRX 금현물",
    quantity: 3400,
    price: 14750,
    currency: "KRW",
    fxRate: 1,
    marketValueKRW: 50150000,
    costKRW: 44000000,
    assetClass: "금",
    sector: "Precious Metals",
    riskBucket: "금",
    tradable: true,
    restricted: false,
    taxConstraint: "연금계좌 과세이연 / 55세 이후 연금소득세",
    lookThroughUnderlying: { notes: "총자산 9.7% 배분 (상한 10% 준수 중)" }
  },
  {
    holdingId: "H-006",
    asOfDate: "2026-09-12",
    account: "국내 비과세/장기",
    accountType: "위탁",
    ticker: "033780",
    assetName: "KT&G",
    quantity: 380,
    price: 92400,
    currency: "KRW",
    fxRate: 1,
    marketValueKRW: 35112000,
    costKRW: 32000000,
    assetClass: "제한자산",
    sector: "Consumer Staples / High Dividend",
    riskBucket: "KT&G 제한",
    tradable: false,
    restricted: true,
    taxConstraint: "장기 배당목적 포지션 (자유 전술 운용 제외)",
    lookThroughUnderlying: { notes: "장기 고배당 목적 묶음자산" }
  },
  {
    holdingId: "H-007",
    asOfDate: "2026-09-12",
    account: "메인 위탁계좌",
    accountType: "위탁",
    ticker: "SGOV",
    assetName: "iShares 0-3 Month Treasury Bond",
    quantity: 1150,
    price: 100.4,
    currency: "USD",
    fxRate: 1370,
    marketValueKRW: 158179200,
    costKRW: 156000000,
    assetClass: "채권·현금",
    sector: "US Cash Equivalents",
    riskBucket: "현금성·SGOV",
    tradable: true,
    restricted: false,
    taxConstraint: "분배금 배당소득세",
    lookThroughUnderlying: { notes: "전술적 재투입 대기 자금 (SGOV 대기조)" }
  },
  {
    holdingId: "H-008",
    asOfDate: "2026-09-12",
    account: "CMA / 원화예수금",
    accountType: "위탁",
    ticker: "KRW_CASH",
    assetName: "원화 MMF 및 예수금",
    quantity: 1,
    price: 110650000,
    currency: "KRW",
    fxRate: 1,
    marketValueKRW: 110650000,
    costKRW: 110650000,
    assetClass: "채권·현금",
    sector: "KRW Cash",
    riskBucket: "현금성·SGOV",
    tradable: true,
    restricted: false,
    taxConstraint: "이자소득세",
    lookThroughUnderlying: { notes: "원화 비상 및 저가 매수 여유 자금" }
  }
];

export const initialSgovSignals: SgovSignalItem[] = [
  { id: 1, name: "미국 10년물 안정", detail: "10년물 국채 5일 이동평균 하향 및 4.35% 미만 유지", threshold: "< 4.35%", currentVal: "4.29%", passed: true, explanation: "4.35% 임계선 아래에서 안정세 유지 중" },
  { id: 2, name: "Brent 급등 중단", detail: "Brent 원유 3일 누적 상승폭 3% 미만", threshold: "3일 +3% 미만", currentVal: "+4.1%", passed: false, explanation: "중동 재고 이슈로 3일간 4.1% 급등하여 미충족" },
  { id: 3, name: "VIX 안정", detail: "VIX 18 이하 및 20일 이평선 하향", threshold: "< 18.0", currentVal: "15.42", passed: true, explanation: "15점대로 하향 안정화 통과" },
  { id: 4, name: "S&P500 회복", detail: "S&P500 20일선 및 50일선 상회", threshold: "> 50일선", currentVal: "50일선 +1.4%", passed: true, explanation: "단기 지지선 상회 유지 중" },
  { id: 5, name: "Nasdaq100 회복", detail: "NDX 단기 고점 대비 -3% 이내 또는 반등 전환", threshold: "> 20일선", currentVal: "20일선 +0.8%", passed: true, explanation: "기술주 지지선 복원 확인" },
  { id: 6, name: "Russell 상대강도 개선", detail: "IWM/SPY 비율 10일 모멘텀 양수 전환", threshold: "상대강도 > 0", currentVal: "-0.24", passed: false, explanation: "소형주 시장 폭 확산이 아직 확인되지 않음" },
  { id: 7, name: "신용스프레드 안정", detail: "미 하이일드 스프레드 350bp 이하 유지", threshold: "< 350bp", currentVal: "342bp", passed: true, explanation: "342bp로 안정적 위험구간 미도달" }
];

export const initialSgovDeploymentPlan: SgovDeploymentPlan = {
  satisfiedCount: 5,
  totalSignals: 7,
  recommendedStage: "1차 탐색 (40%)",
  allowedRatePct: 40,
  todayLimitKRW: 15000000,
  priorities: [
    { rank: 1, asset: "VOO (광범위 미국)", description: "S&P 500 대표 지수", rationale: "레짐 56점 중립 구간에서 단일 섹터 과열을 피하고 기저 복원력 최대화" },
    { rank: 2, asset: "비기술 방어·가치 섹터 (XLI, XLV)", description: "헬스케어 / 산업재", rationale: "유가 및 금리 변동성에 대한 분산 효과" },
    { rank: 3, asset: "QQQ (Nasdaq 100)", description: "빅테크 대형성장 ETF", rationale: "10년물 금리 하향 확인 시 추가 확대" },
    { rank: 4, asset: "GOOG (알파벳 직접)", description: "단일종목 추가", rationale: "현재 Look-through 포함 12.8%로 위험예산 한도(15%) 임계치 근접하여 최후순위" }
  ]
};

export const initialEvents: MacroEvent[] = [
  {
    eventId: "EV-001",
    eventType: "FOMC",
    eventName: "미 연준 9월 FOMC 기준금리 결정 및 점도표",
    eventTimeKST: "2026-09-17 03:00 KST (D-1)",
    importance: "CRITICAL",
    isLocked: true,
    coolingPeriodMin: 30,
    firstDayCapPct: 25,
    highBetaRiskBudgetPct: 50,
    baseScenario: "25bp 인하 및 파월 의장의 온건한 연착륙 지지 발언",
    bullScenario: "점도표 상 연내 추가 50bp 인하 시사, 국채금리 4.10% 급락",
    bearScenario: "인플레 경계 발언 및 향후 인하 속도 조절 강조, 10년물 4.40% 급등",
    allowedOrderKRW: 5000000
  },
  {
    eventId: "EV-002",
    eventType: "CPI",
    eventName: "미국 8월 소비자물가지수(CPI)",
    eventTimeKST: "2026-09-24 21:30 KST",
    importance: "HIGH",
    isLocked: false,
    coolingPeriodMin: 20,
    firstDayCapPct: 30,
    highBetaRiskBudgetPct: 60,
    baseScenario: "Core CPI 전월비 0.2% 부합",
    bullScenario: "Core CPI 0.1% 하회로 완화 기대",
    bearScenario: "서비스 물가 재반등 0.4% 상회",
    allowedOrderKRW: 10000000
  },
  {
    eventId: "EV-003",
    eventType: "실적",
    eventName: "마이크론(MU) 분기 실적 발표 (HBM 공급망 점검)",
    eventTimeKST: "2026-09-26 05:30 KST",
    importance: "MEDIUM",
    isLocked: false,
    coolingPeriodMin: 15,
    firstDayCapPct: 40,
    highBetaRiskBudgetPct: 70,
    baseScenario: "HBM3E 가이던스 유지 및 가격 안정",
    bullScenario: "서버 수요 폭증으로 마진 가이던스 상향",
    bearScenario: "PC/스마트폰 회복 지연으로 단기 재고 증가",
    allowedOrderKRW: 12000000
  }
];

export const initialDecisionJournals: DecisionJournalEntry[] = [
  {
    journalId: "J-101",
    tradeId: "TR-892",
    decisionDate: "2026-09-08",
    ticker: "VOO",
    side: "BUY",
    amountKRW: 10000000,
    thesis: "S&P500 50일선 지지 후 첫 반등 양봉, SGOV 신호 5/7 충족에 따른 분할 1차 매수",
    counterThesis: "미 국채 10년물 금리가 4.25% 상회 시 추가 하방 압력 존재",
    regimeAtTrade: "Neutral (58점)",
    dataBacking: "SGOV 투입 신호 5개 충족, VIX 16 이하 안정, 일일 허용치 1,500만원 내 집행",
    invalidationCondition: "S&P500 5,600 종가 기준 이탈 시 손절",
    plannedLossKRW: 350000,
    fomoScore: 22,
    actualOutcome: "보유 중",
    decisionQuality: "탁월",
    outcomeQuality: "수익",
    ruleCompliant: true,
    errorType: "없음 (우수)",
    lessonLearned: "사전 정의된 SGOV 신호 충족 시점에 기계적으로 매수 집행하여 감정적 개입 최소화 성공"
  },
  {
    journalId: "J-102",
    tradeId: "TR-881",
    decisionDate: "2026-08-28",
    ticker: "NVDA",
    side: "BUY",
    amountKRW: 8000000,
    thesis: "엔비디아 실적 발표 직후 급등세 추종 매수",
    counterThesis: "실적 당일 변동성 과열 및 옵션 프리미엄 축소 리스크",
    regimeAtTrade: "Neutral (52점)",
    dataBacking: "장마감 후 +4% 호실적 뉴스 헤드라인",
    invalidationCondition: "당일 시가 이탈 시 즉시 매도 (미입력)",
    plannedLossKRW: 950000,
    fomoScore: 78,
    actualOutcome: "원칙 손절",
    decisionQuality: "원칙 위반",
    outcomeQuality: "약손실",
    ruleCompliant: false,
    errorType: "추격매수(FOMO)",
    lessonLearned: "실적 발표 후 30분 냉각 규칙 및 FOMO 방지 룰을 위반하고 헤드라인 매매 진행. Gatekeeper 브레이크 필수 확인 교훈."
  },
  {
    journalId: "J-103",
    tradeId: "TR-865",
    decisionDate: "2026-08-15",
    ticker: "ACE KRX 금현물",
    side: "BUY",
    amountKRW: 6000000,
    thesis: "포트폴리오 내 안전자산 및 통화가치 헤지 비중 8% -> 10% 목표 충족을 위한 정기 리밸런싱",
    counterThesis: "달러 강세 재개 시 금 가격 일시적 눌림목 가능성",
    regimeAtTrade: "Defensive (44점)",
    dataBacking: "금 상한 10% 이내 배분 계획, 연금저축 과세이연 활용",
    invalidationCondition: "온스당 $2,300 이탈 시",
    plannedLossKRW: 240000,
    fomoScore: 15,
    actualOutcome: "보유 중",
    decisionQuality: "탁월",
    outcomeQuality: "수익",
    ruleCompliant: true,
    errorType: "없음 (우수)",
    lessonLearned: "시장 공포 국면에서 자산배분 계획에 따른 헤지자산 확보는 전체 포트폴리오 MDD를 3%p 이상 방어함"
  }
];

export const initialIPOWatchList: IPOWatchItem[] = [
  {
    id: "IPO-01",
    companyName: "Anthropic Inc. (AI Foundation Model)",
    ticker: "ANTH (예정)",
    expectedDate: "2026-11 (미정)",
    expectedValuation: "$40B~$50B",
    revenueGrowth: "YoY +280%",
    grossMargin: "65%",
    fcfStatus: "현금소진 단계 (Capex 집중)",
    aiBucketOverlap: true,
    officialS1Confirmed: false,
    dayOneTradingBan: true,
    fiveDayObservationMet: false,
    initialMaxAllocationKRW: 5000000,
    preEarningsMaxCapKRW: 10000000,
    verdict: "관찰 대기"
  },
  {
    id: "IPO-02",
    companyName: "Databricks Inc. (Enterprise Lakehouse)",
    ticker: "DBRX (예정)",
    expectedDate: "2026-10",
    expectedValuation: "$43B",
    revenueGrowth: "YoY +45%",
    grossMargin: "78%",
    fcfStatus: "FCF 흑자 전환 ($150M)",
    aiBucketOverlap: true,
    officialS1Confirmed: true,
    dayOneTradingBan: true,
    fiveDayObservationMet: false,
    initialMaxAllocationKRW: 7000000,
    preEarningsMaxCapKRW: 15000000,
    verdict: "심사 통과"
  }
];

export const initialTeamsNotifications: TeamsAdaptiveCardNotification[] = [
  {
    id: "NOTIF-01",
    time: "07:30 AM",
    category: "DAILY_CHECK",
    title: "07:30 DAILY CHECK 완료",
    summary: "오늘 레짐: Neutral 56점 (신뢰도 72%)",
    details: [
      "현재 주식비중 38.4% (목표 46.0% 대비 -7.6%p 부족)",
      "오늘 허용 주문한도: 500만원",
      "오늘 권고 행동: WAIT",
      "주의: FOMC D-1 (이벤트 잠금 ON)"
    ],
    actions: ["DAILY CHECK 열기", "매수 검토", "오늘 매매 없음", "이벤트 시나리오"],
    timestamp: "2026-09-12 07:30:00",
    read: false
  },
  {
    id: "NOTIF-02",
    time: "10:15 AM",
    category: "RISK_ALERT",
    title: "장중 위험경고: 미 10년물 금리 경계구간",
    summary: "미국 10년물 4.29% 터치 및 Brent 유가 반등",
    details: [
      "성장 위험자산 신규 매수 잠금 권고",
      "SGOV 투입 신호: 5/7 충족 (1차 탐색 단계 유지)"
    ],
    actions: ["SGOV 재투입 현황", "경고 해제"],
    timestamp: "2026-09-12 10:15:20",
    read: false
  },
  {
    id: "NOTIF-03",
    time: "어제 14:20 PM",
    category: "FOMO_WARN",
    title: "FOMO 경고 차단 완료",
    summary: "급등 기술주 추격매수 요청이 Gatekeeper에 의해 차단되었습니다.",
    details: [
      "최근 3일 지수 +3.2% 급등 국면",
      "사전 정의된 무효화 손절가 부재",
      "조정 결과: 주문 보류(WAIT) 결정"
    ],
    actions: ["저널 확인"],
    timestamp: "2026-09-11 14:20:00",
    read: true
  },
  {
    id: "NOTIF-04",
    time: "3일 전",
    category: "CASH_SURPLUS",
    title: "현금 과다보유 경고",
    summary: "Neutral 레짐에서 현금성·채권성 51.9%가 지속되고 있습니다.",
    details: [
      "목표 주식비중 46.0% 대비 미집행액 3,095만원 대기",
      "SGOV 7대 신호 충족 시 3단계 분할 재투입 계획 가동 요망"
    ],
    actions: ["3단계 재투입 계획 보기"],
    timestamp: "2026-09-09 09:00:00",
    read: true
  }
];

export const platformOptions: PlatformOption[] = [
  {
    id: "powerapps_sharepoint",
    title: "선택지 1: Power Apps + SharePoint Lists",
    subtitle: "가장 빠른 MVP 권장 조합 (1단계)",
    stage: "1단계 MVP (1~4주차)",
    fit: "개인 투자 관제 및 데일리 루틴에 즉시 적용하기 가장 현실적",
    pros: [
      "Microsoft 365 계정만 있으면 추가 라이선스 없이 즉시 배포 가능",
      "모바일 Power Apps 실행 환경과 완벽 연동",
      "Excel 대비 동시성 및 데이터 테이블 무결성 우수",
      "Power Automate 스케줄러(07:30 알림) 및 Teams 전송 설정이 가장 간단함"
    ],
    cons: [
      "대량 시계열 틱 데이터나 복잡한 금융 수식 계산에는 부적합 (Python 외주 필요)",
      "오프라인 동기화 기능이 Dataverse에 비해 제한적"
    ],
    techStack: "Power Apps Canvas + SharePoint Lists + Power Automate + Python Engine",
    recommendation: "첫 1~2개월 동안 투자 습관을 잡고 Gatekeeper를 실제 가동하는 데 가장 추천합니다."
  },
  {
    id: "powerapps_dataverse",
    title: "선택지 2: Power Apps + Dataverse",
    subtitle: "정식 Investment OS (v1.0~v2.0)",
    stage: "2단계 정식 버전 (MVP 검증 후)",
    fit: "복잡한 관계형 데이터, 엄격한 권한 및 모바일 오프라인 동기화 필요 시",
    pros: [
      "완전한 관계형 데이터 모델 (Holdings ↔ Trades ↔ Events ↔ Journal 1:N 관계)",
      "모바일 오프라인 캐시 및 네트워크 복구 시 자동 동기화 지원",
      "Copilot Studio 에이전트와 직접 네이티브 커넥터 연동 지원",
      "엔터프라이즈급 감사 로그 및 규칙 보장"
    ],
    cons: [
      "Power Apps 프리미엄 라이선스 필요",
      "테이블 스키마 및 환경 설정 복잡도 증가"
    ],
    techStack: "Power Apps Model-driven/Canvas + Microsoft Dataverse + Copilot Studio + Power Automate",
    recommendation: "MVP 데이터 구조가 안정된 후, 오프라인 모바일 관제와 Copilot 심화 연동 시 마이그레이션합니다."
  },
  {
    id: "pwa_react_fastapi",
    title: "선택지 3: 모바일 웹앱 / PWA (Power Apps 불필요 시)",
    subtitle: "독립형 Investment OS (UX 및 계산 자유도 극대화)",
    stage: "독립 개발 또는 v3.0 대안",
    fit: "Microsoft 생태계 종속 없이 모바일 홈화면 앱처럼 사용하고 싶을 때",
    pros: [
      "Power Apps 라이선스나 M365 제약 전혀 없음",
      "극도로 매끄러운 60fps 인터랙션 및 맞춤형 신호등/Look-through 시각화",
      "Python FastAPI 백엔드와 직접 연동되어 계산 엔진 지연 시간 제로",
      "증권사 API 연결이나 PWA 홈화면 설치(아이콘 터치 즉시 실행) 완벽 지원"
    ],
    cons: [
      "초기 배포(서버, 인증, HTTPS) 및 유지보수 관리 필요",
      "회사 Teams / Outlook과의 기본 결합성은 추가 웹훅 구현 필요"
    ],
    techStack: "React 19 + TypeScript + Tailwind CSS + Python FastAPI / Node.js + PWA Service Worker",
    recommendation: "Power Apps를 쓰고 싶지 않거나 M365 라이선스가 없을 때 가장 이상적인 최종 아키텍처입니다."
  },
  {
    id: "teams_bot",
    title: "선택지 4: Teams 모바일 전용 봇 + Adaptive Card",
    subtitle: "초경량 알림 및 원클릭 제어 방식",
    stage: "MVP와 동시 운영 추천",
    fit: "앱을 별도로 열 시간조차 없는 바쁜 아침, Teams 푸시로만 1분 확인",
    pros: [
      "별도의 모바일 앱을 설치하거나 찾아서 켤 필요가 없음",
      "07:30에 Teams 푸시 알림으로 전송된 카드에서 [오늘 매매 없음] 원클릭 종료",
      "Adaptive Card 내에서 매수 제안을 직접 입력하여 즉시 Gatekeeper 검증 가능",
      "뇌동매매 및 충동을 버튼 하나로 즉각 차단"
    ],
    cons: [
      "복잡한 포트폴리오 파이차트나 다차원 시계열 탐색은 불가능",
      "심층 분석은 결국 대시보드 화면이 필요"
    ],
    techStack: "Power Automate + Teams Webhook / Bot Framework + Adaptive Cards JSON",
    recommendation: "Power Apps 대시보드와 함께 아침 1분 루틴용으로 병행 사용하는 것이 최선입니다."
  }
];
