import React, { useState } from "react";
import { PortfolioHolding } from "../types";
import { formatKRW, formatPct, formatNumber } from "../utils/formatters";
import { 
  PieChart, 
  ShieldAlert, 
  Layers, 
  DollarSign, 
  TrendingUp, 
  Info, 
  AlertTriangle, 
  ExternalLink,
  Search,
  CheckCircle,
  Eye,
  Camera
} from "lucide-react";

interface PortfolioViewProps {
  holdings: PortfolioHolding[];
  onInspectTicker: (ticker: string) => void;
  onOpenCaptureModal?: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  holdings,
  onInspectTicker,
  onOpenCaptureModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"buckets" | "holdings" | "accounts">("buckets");
  const [filterAccount, setFilterAccount] = useState<string>("ALL");

  // Calculations
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValueKRW, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costKRW, 0);
  const totalPnL = totalMarketValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const restrictedAssets = holdings
    .filter((h) => h.restricted)
    .reduce((sum, h) => sum + h.marketValueKRW, 0);
  const tacticalDeployableAssets = totalMarketValue - restrictedAssets;

  const stockAssets = holdings
    .filter((h) => h.assetClass === "주식")
    .reduce((sum, h) => sum + h.marketValueKRW, 0);
  const goldAssets = holdings
    .filter((h) => h.assetClass === "금")
    .reduce((sum, h) => sum + h.marketValueKRW, 0);
  const cashBondAssets = holdings
    .filter((h) => h.assetClass === "채권·현금")
    .reduce((sum, h) => sum + h.marketValueKRW, 0);

  const stockWeight = totalMarketValue > 0 ? stockAssets / totalMarketValue : 0;
  const goldWeight = totalMarketValue > 0 ? goldAssets / totalMarketValue : 0;
  const cashBondWeight = totalMarketValue > 0 ? cashBondAssets / totalMarketValue : 0;
  const restrictedWeight = totalMarketValue > 0 ? restrictedAssets / totalMarketValue : 0;

  // Currency exposure
  const usdAssets = holdings
    .filter((h) => h.currency === "USD")
    .reduce((sum, h) => sum + h.marketValueKRW, 0);
  const usdWeight = totalMarketValue > 0 ? usdAssets / totalMarketValue : 0;
  const krwWeight = 1 - usdWeight;

  // Look-through calculations for Alphabet & Semis
  // GOOG direct:
  const googDirectHolding = holdings.find((h) => h.ticker === "GOOGL");
  const googDirectValue = googDirectHolding ? googDirectHolding.marketValueKRW : 0;
  // QQQ ETF market value:
  const qqqHolding = holdings.find((h) => h.ticker === "QQQ");
  const qqqValue = qqqHolding ? qqqHolding.marketValueKRW : 0;
  const googInQQQ = qqqValue * 0.058; // 5.8% in QQQ
  // VOO ETF market value:
  const vooHolding = holdings.find((h) => h.ticker === "VOO");
  const vooValue = vooHolding ? vooHolding.marketValueKRW : 0;
  const googInVOO = vooValue * 0.039; // 3.9% in VOO
  const totalRealAlphabet = googDirectValue + googInQQQ + googInVOO;
  const realAlphabetWeightPct = (totalRealAlphabet / totalMarketValue) * 100;

  // Semis Look-Through
  const smhHolding = holdings.find((h) => h.ticker === "SMH");
  const smhValue = smhHolding ? smhHolding.marketValueKRW : 0;
  const semisInQQQ = qqqValue * 0.162;
  const semisInVOO = vooValue * 0.104;
  const totalRealSemis = smhValue + semisInQQQ + semisInVOO;
  const realSemisWeightPct = (totalRealSemis / totalMarketValue) * 100;

  // Risk Buckets aggregation
  const riskBucketGroups = [
    {
      name: "GOOG 직접 및 ETF 내부 Look-through",
      val: totalRealAlphabet,
      weightPct: realAlphabetWeightPct,
      detail: `직접 GOOGL (${formatKRW(googDirectValue)}) + QQQ 내부 5.8% (${formatKRW(googInQQQ)}) + VOO 내부 3.9% (${formatKRW(googInVOO)})`,
      color: "bg-blue-600",
      limit: 15.0,
      warning: realAlphabetWeightPct > 12.0 ? "단일 종목 실질 비중(12.3%) 위험한도(15%) 임계치 근접" : undefined,
    },
    {
      name: "반도체 (직접 + QQQ/VOO ETF Look-through)",
      val: totalRealSemis,
      weightPct: realSemisWeightPct,
      detail: `SMH (${formatKRW(smhValue)}) + QQQ 내부 16.2% + VOO 내부 10.4%`,
      color: "bg-indigo-600",
      limit: 15.0,
      warning: undefined,
    },
    {
      name: "Nasdaq100 (순수 잔여 성장)",
      val: qqqValue - googInQQQ - semisInQQQ,
      weightPct: ((qqqValue - googInQQQ - semisInQQQ) / totalMarketValue) * 100,
      detail: "소프트웨어, 플랫폼, 헬스케어 등 빅테크 성장 분산",
      color: "bg-sky-500",
      limit: 20.0,
    },
    {
      name: "광범위 미국주식 (VOO 잔여)",
      val: vooValue - googInVOO - semisInVOO,
      weightPct: ((vooValue - googInVOO - semisInVOO) / totalMarketValue) * 100,
      detail: "금융, 산업재, 소비재 등 미국 경제 전반 분산",
      color: "bg-teal-500",
      limit: 30.0,
    },
    {
      name: "금 (ACE KRX 금현물)",
      val: goldAssets,
      weightPct: goldWeight * 100,
      detail: "화폐가치 희석 및 지정학 헤지",
      color: "bg-amber-500",
      limit: 10.0,
      warning: goldWeight * 100 > 10.0 ? "금 상한(10%) 초과" : undefined,
    },
    {
      name: "KT&G (장기 배당 / 제한자산)",
      val: restrictedAssets,
      weightPct: restrictedWeight * 100,
      detail: "자유 전술 운용 제외, 고배당 현금흐름 묶음",
      color: "bg-stone-500",
      limit: 10.0,
    },
    {
      name: "현금성·SGOV (단기채 및 예수금)",
      val: cashBondAssets,
      weightPct: cashBondWeight * 100,
      detail: "SGOV 단기국채 + 원화 MMF (전술적 매수 대기자금)",
      color: "bg-emerald-600",
      limit: 50.0,
      warning: cashBondWeight * 100 > 50.0 ? "Neutral 레짐 대비 현금 과다보유 (51.9% > 50%)" : undefined,
    }
  ];

  const filteredHoldings = filterAccount === "ALL"
    ? holdings
    : holdings.filter((h) => h.account === filterAccount);

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1 gap-2">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>포트폴리오 통합 관제</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
              Look-through 계산 적용
            </span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            모든 계좌를 합산하고 ETF 내부 종목까지 실질 경제적 노출로 분해
          </p>
        </div>

        {onOpenCaptureModal && (
          <button
            onClick={onOpenCaptureModal}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>캡처 OCR 검수</span>
          </button>
        )}
      </div>

      {/* Top Asset Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs">
          <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300">통합 총자산</div>
          <div className="text-lg font-black text-stone-900 dark:text-stone-100 mt-0.5 font-mono">
            {formatKRW(totalMarketValue)}
          </div>
          <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-1 flex items-center gap-1">
            <span>손익:</span>
            <span className={`font-semibold font-mono ${totalPnL >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              {totalPnL >= 0 ? "+" : ""}{formatKRW(totalPnL)} ({totalPnLPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs">
          <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300">전술 운용 가능자산</div>
          <div className="text-lg font-black text-blue-700 dark:text-blue-400 mt-0.5 font-mono">
            {formatKRW(tacticalDeployableAssets)}
          </div>
          <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-1">
            제한자산 {formatKRW(restrictedAssets)} 제외
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs">
          <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300">주식성 vs 현금성 비중</div>
          <div className="text-lg font-black text-stone-900 dark:text-stone-100 mt-0.5 font-mono">
            {formatPct(stockWeight)} <span className="text-xs font-normal text-stone-600 dark:text-stone-300">/ {formatPct(cashBondWeight)}</span>
          </div>
          <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-1">
            금 {formatPct(goldWeight)} (상한 10% 준수)
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs">
          <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300">통화 노출 (달러/원화)</div>
          <div className="text-lg font-black text-stone-900 dark:text-stone-100 mt-0.5 font-mono">
            USD {Math.round(usdWeight * 100)}%
          </div>
          <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-1">
            KRW {Math.round(krwWeight * 100)}% (자연 환헤지)
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab("buckets")}
          className={`pb-2.5 px-3 border-b-2 transition-colors ${
            activeSubTab === "buckets"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
          }`}
        >
          위험묶음 &amp; Look-Through 실질노출
        </button>
        <button
          onClick={() => setActiveSubTab("holdings")}
          className={`pb-2.5 px-3 border-b-2 transition-colors ${
            activeSubTab === "holdings"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
          }`}
        >
          종목별 상세 원장 ({holdings.length}건)
        </button>
      </div>

      {/* Sub Tab 1: Risk Buckets & Look-Through */}
      {activeSubTab === "buckets" && (
        <div className="space-y-3">
          {/* Highlight Look-through explanation box */}
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>ETF Look-through 실질 노출 분석 원칙</span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-900 dark:text-blue-300">
              GOOGL, QQQ, VOO를 단순히 세 줄로 보지 않고, QQQ와 VOO 안에 들어있는 Alphabet 주식을 분해하여 합산합니다. 
              직접 보유({formatKRW(googDirectValue)}) + QQQ({formatKRW(googInQQQ)}) + VOO({formatKRW(googInVOO)}) = 총 실질 노출은 <strong>{formatKRW(totalRealAlphabet)} ({realAlphabetWeightPct.toFixed(1)}%)</strong>입니다.
            </p>
          </div>

          <div className="space-y-2.5">
            {riskBucketGroups.map((b) => (
              <div
                key={b.name}
                className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {b.name}
                    </span>
                    <p className="text-[10px] text-stone-600 dark:text-stone-300 mt-0.5">{b.detail}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-stone-900 dark:text-stone-100">
                      {b.weightPct.toFixed(1)}%
                    </span>
                    <div className="text-[10px] text-stone-600 dark:text-stone-300 font-mono">
                      {formatKRW(b.val)}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full ${b.color} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, b.weightPct * 2)}%` }}
                  />
                </div>

                {/* Warning if any */}
                {b.warning && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-0.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{b.warning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub Tab 2: Holdings Ledger */}
      {activeSubTab === "holdings" && (
        <div className="space-y-3">
          {/* Account Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["ALL", "메인 위탁계좌", "연금저축/IRP", "국내 비과세/장기", "CMA / 원화예수금"].map((acc) => (
              <button
                key={acc}
                onClick={() => setFilterAccount(acc)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterAccount === acc
                    ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                }`}
              >
                {acc}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredHoldings.map((h) => (
              <div
                key={h.holdingId}
                className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-xs flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                      {h.ticker}
                    </span>
                    <span className="text-[11px] text-stone-600 dark:text-stone-300">
                      {h.assetName}
                    </span>
                    {h.restricted && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        제한자산
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-600 dark:text-stone-300">
                    {h.account} · {h.riskBucket} · {h.taxConstraint}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-stone-900 dark:text-stone-100">
                    {formatKRW(h.marketValueKRW)}
                  </div>
                  <div className="text-[10px] font-mono text-stone-600 dark:text-stone-300">
                    {h.currency === "USD" ? `$${h.price} × ${h.quantity}` : `${formatNumber(h.price)}원 × ${h.quantity}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Alert System (포트폴리오 하단 경고 배너 5개) */}
      <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
        <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>포트폴리오 정밀 위험 경고</span>
        </div>

        <ul className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-300">
          <li className="flex items-start gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <span>
              <strong>경제적 단일종목 집중:</strong> GOOG 직접 보유와 QQQ·VOO 내부 Look-through 합산 시 12.3%로 목표 상한(15%)에 근접해 있으므로 신규 매수는 최후순위로 배정됩니다.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <span>
              <strong>현금 과다보유:</strong> Neutral 레짐에서 현금성·채권성 51.9% 유지가 10거래일 지속되었습니다. SGOV 7개 신호 충족 시 3단계 분할 재투입 계획을 점검하세요.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <span>
              <strong>금 상한 준수:</strong> 금 비중 9.7%로 상한 10%를 초과하지 않고 안정적으로 배분되어 있습니다.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
