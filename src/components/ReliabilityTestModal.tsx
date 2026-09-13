import React, { useState, useEffect } from "react";
import { ReliabilityTestSuiteResult, ReliabilityTestCase, YahooMarketQuote } from "../types";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCw, 
  ShieldCheck, 
  ExternalLink, 
  Activity, 
  Zap, 
  Database,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";

interface ReliabilityTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessSync?: () => void;
}

export const ReliabilityTestModal: React.FC<ReliabilityTestModalProps> = ({
  isOpen,
  onClose,
  onSuccessSync
}) => {
  const [testResult, setTestResult] = useState<ReliabilityTestSuiteResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>("TC-01");
  const [activeTab, setActiveTab] = useState<"testCases" | "quotes">("testCases");

  const runTest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/market/reliability-test", { method: "POST" });
      if (res.ok) {
        const data: ReliabilityTestSuiteResult = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error("Failed to run reliability test:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !testResult && !isLoading) {
      runTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>야후 파이낸스 실시간 데이터 신뢰성 테스트</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                  v8 Chart Direct
                </span>
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                실제 호가 데이터 수신, 수치 무결성, 금융 도메인 경계값, 장애 격리성 전수 검증
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runTest}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "검증 진행 중..." : "테스트 재실행"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overview Metric Bar */}
        {testResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-300 block mb-1">종합 판정</span>
              <div className="flex items-center gap-1.5">
                {testResult.overallStatus === "PASSED" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <strong className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      100% 정상 통과
                    </strong>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <strong className="text-amber-700 dark:text-amber-300 font-bold text-sm">
                      {testResult.overallStatus} ({testResult.scorePct}%)
                    </strong>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-300 block mb-1">테스트 통과율</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-stone-900 dark:text-stone-100">
                  {testResult.passedTests}
                </span>
                <span className="text-stone-600 dark:text-stone-300">/ {testResult.totalTests} 케이스</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-300 block mb-1">총 소요 시간</span>
              <div className="flex items-center gap-1 text-stone-900 dark:text-stone-100 font-mono font-bold text-sm">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{testResult.totalDurationMs}ms</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-300 block mb-1">데이터 출처</span>
              <div className="flex items-center gap-1 text-stone-800 dark:text-stone-200 font-semibold text-[11px]">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span className="truncate">Yahoo Finance Official</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-850/20">
          <button
            onClick={() => setActiveTab("testCases")}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "testCases"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-stone-600 dark:text-stone-300 hover:text-stone-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>신뢰성 검증 항목 ({testResult?.testCases.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("quotes")}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "quotes"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-stone-600 dark:text-stone-300 hover:text-stone-800"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>야후 파이낸스 실시간 호가 스냅샷 ({testResult ? Object.keys(testResult.quotesSnapshot).length : 0})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {isLoading && !testResult && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <RotateCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                야후 파이낸스 실시간 API 연결 및 신뢰성 테스트를 실행하고 있습니다...
              </p>
            </div>
          )}

          {activeTab === "testCases" && testResult && (
            <div className="space-y-2.5">
              {testResult.testCases.map((tc) => {
                const isExpanded = expandedCaseId === tc.id;
                return (
                  <div
                    key={tc.id}
                    className="rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-850/60 overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {tc.status === "PASSED" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : tc.status === "WARNING" ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
                          {tc.id}
                        </span>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {tc.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        <span className="text-[11px] font-mono text-stone-600 dark:text-stone-300">
                          {tc.latencyMs}ms
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tc.status === "PASSED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {tc.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-1 text-xs border-t border-stone-100 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/40 space-y-2">
                        <p className="text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                          {tc.details}
                        </p>
                        {tc.dataPoints && (
                          <pre className="p-2.5 rounded-lg bg-stone-900 text-stone-100 text-[11px] font-mono overflow-x-auto">
                            {JSON.stringify(tc.dataPoints, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "quotes" && testResult && (
            <div className="space-y-2">
              <div className="text-xs text-stone-600 dark:text-stone-300 mb-2">
                야후 파이낸스 서버로부터 직접 수신한 {Object.keys(testResult.quotesSnapshot).length}개 종목의 실시간 호가입니다.
              </div>
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-100/70 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-b border-stone-200 dark:border-stone-700">
                      <th className="p-2.5 font-semibold">심볼 (Symbol)</th>
                      <th className="p-2.5 font-semibold">지표 / 종목명</th>
                      <th className="p-2.5 font-semibold text-right">실시간 가격 (Price)</th>
                      <th className="p-2.5 font-semibold text-right">등락률 (%)</th>
                      <th className="p-2.5 font-semibold text-center">검증 출처</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {Object.values(testResult.quotesSnapshot).map((q: YahooMarketQuote) => {
                      const isUp = q.changePercent >= 0;
                      return (
                        <tr key={q.symbol} className="hover:bg-stone-50 dark:hover:bg-stone-850 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-stone-900 dark:text-stone-100">
                            {q.symbol}
                          </td>
                          <td className="p-2.5 text-stone-700 dark:text-stone-300">
                            {q.name}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-stone-900 dark:text-stone-100">
                            {q.currency === "KRW" ? `${q.regularMarketPrice.toLocaleString()}원` : `$${q.regularMarketPrice.toLocaleString()}`}
                          </td>
                          <td className={`p-2.5 text-right font-mono font-semibold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                            {isUp ? "+" : ""}{q.changePercent.toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                              {q.source === "YAHOO_FINANCE_OFFICIAL" ? "Yahoo Direct" : "Fallback"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-stone-600 dark:text-stone-300 text-center sm:text-left">
            야후 파이낸스 실시간 시세가 포트폴리오 평가 및 레짐 계산식에 100% 실시간 적용됩니다.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onSuccessSync) onSuccessSync();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              확인 및 실시간 반영 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
