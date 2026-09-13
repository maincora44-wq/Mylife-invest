import React, { useState } from "react";
import { DecisionJournalEntry } from "../types";
import { formatKRW } from "../utils/formatters";
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  Bot, 
  Search, 
  Filter, 
  RefreshCw,
  Clock
} from "lucide-react";

interface DecisionJournalViewProps {
  entries: DecisionJournalEntry[];
  onAddReview: (journalId: string, reviewText: string, cognitiveBias?: string) => void;
}

export const DecisionJournalView: React.FC<DecisionJournalViewProps> = ({
  entries,
  onAddReview,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(entries[0]?.journalId || "");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [isCopilotMonthlyAnalyzing, setIsCopilotMonthlyAnalyzing] = useState(false);
  const [copilotSummary, setCopilotSummary] = useState<string | null>(null);

  const selectedEntry = entries.find((e) => e.journalId === selectedEntryId) || entries[0];

  const filteredEntries = filterType === "ALL"
    ? entries
    : entries.filter((e) => e.side === filterType);

  const handleRunMonthlyAnalysis = async () => {
    setIsCopilotMonthlyAnalyzing(true);
    setCopilotSummary(null);
    try {
      const resp = await fetch("/api/copilot/journal-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.analysis) {
          setCopilotSummary(data.analysis);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCopilotMonthlyAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>Decision Journal (투자 결정 저널)</span>
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            단순 체결 내역이 아닌 매수 직전 논리와 사후 인지적 오류를 복기합니다
          </p>
        </div>

        <button
          onClick={handleRunMonthlyAnalysis}
          disabled={isCopilotMonthlyAnalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs"
        >
          {isCopilotMonthlyAnalyzing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>Copilot 월간 복기</span>
        </button>
      </div>

      {/* Copilot Monthly Review Box */}
      {copilotSummary && (
        <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-blue-600" />
              <span>Copilot Studio - 월간 패턴 분석 보고서</span>
            </span>
            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-mono">
              반복 오류 감지
            </span>
          </div>
          <div className="text-[11px] text-blue-950 dark:text-blue-200 leading-relaxed whitespace-pre-line">
            {copilotSummary}
          </div>
        </div>
      )}

      {/* 2x2 Decision Matrix Overview */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60">
          <div className="font-bold text-emerald-900 dark:text-emerald-300">
            좋은 결정 + 좋은 결과
          </div>
          <div className="text-[11px] text-emerald-900 dark:text-emerald-300 mt-0.5">
            원칙 준수 성공 · 지속 실행
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60">
          <div className="font-bold text-blue-900 dark:text-blue-300">
            좋은 결정 + 나쁜 결과
          </div>
          <div className="text-[11px] text-blue-900 dark:text-blue-300 mt-0.5">
            정상적 확률 손실 (자책 금지)
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60">
          <div className="font-bold text-amber-900 dark:text-amber-300">
            나쁜 결정 + 좋은 결과
          </div>
          <div className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5">
            가장 위험한 행운 (도박성 매매)
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60">
          <div className="font-bold text-rose-900 dark:text-rose-300">
            나쁜 결정 + 나쁜 결과
          </div>
          <div className="text-[11px] text-rose-900 dark:text-rose-300 mt-0.5">
            FOMO 뇌동매매 · 반성 필요
          </div>
        </div>
      </div>

      {/* Journal Entries List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-bold text-stone-700 dark:text-stone-300">
            기록된 결정 저널 목록 ({entries.length}건)
          </span>
          <div className="flex gap-1">
            {["ALL", "BUY", "SELL"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterType(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  filterType === s
                    ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredEntries.map((entry) => (
          <div
            key={entry.journalId}
            onClick={() => setSelectedEntryId(entry.journalId)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
              selectedEntryId === entry.journalId
                ? "bg-white dark:bg-stone-900 border-blue-600 dark:border-blue-500 shadow-md ring-1 ring-blue-600/30"
                : "bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 shadow-xs hover:border-stone-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      entry.side === "BUY"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {entry.side}
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-900 dark:text-stone-100">
                    {entry.ticker}
                  </span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-300">
                    {entry.decisionDate}
                  </span>
                </div>
                <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 mt-1">
                  금액: {formatKRW(entry.amountKRW)} · 당시 레짐: {entry.regimeAtTrade}
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  entry.ruleCompliant
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {entry.ruleCompliant ? "원칙 준수" : "원칙 위반"}
              </span>
            </div>

            {/* Thesis & Cognitive Bias */}
            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1 bg-stone-50/70 dark:bg-stone-850 p-2.5 rounded-xl">
              <div>
                <strong className="text-stone-800 dark:text-stone-200">매수 이유 (Thesis):</strong> {entry.thesis}
              </div>
              {entry.invalidationCondition && (
                <div className="text-[11px] text-rose-700 dark:text-rose-400">
                  <strong>무효화 조건:</strong> {entry.invalidationCondition}
                </div>
              )}
              {entry.cognitiveBias && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  <strong>감지된 인지적 오류:</strong> {entry.cognitiveBias}
                </div>
              )}
            </div>

            {/* Lesson Learned */}
            {entry.lessonLearned && (
              <div className="text-[11px] text-blue-900 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20 p-2 rounded-lg">
                <strong>사후 배운 점:</strong> {entry.lessonLearned}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
