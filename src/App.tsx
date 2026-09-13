import React, { useState, useEffect } from "react";
import { 
  RegimeState, 
  PortfolioHolding, 
  MarketIndicator, 
  RegimeFactorScore, 
  SgovSignalItem, 
  SgovDeploymentPlan, 
  MacroEvent, 
  DecisionJournalEntry,
  RegimeType
} from "./types";
import { 
  initialRegimeState, 
  initialHoldings, 
  initialMarketIndicators, 
  initialFactorScores, 
  initialSgovSignals, 
  initialSgovDeploymentPlan, 
  initialEvents, 
  initialDecisionJournals 
} from "./data/initialData";

import { Navbar } from "./components/Navbar";
import { BottomTabBar } from "./components/BottomTabBar";
import { HomeDashboard } from "./components/HomeDashboard";
import { PortfolioView } from "./components/PortfolioView";
import { RegimeMonitorView } from "./components/RegimeMonitorView";
import { DeploySgovView } from "./components/DeploySgovView";
import { TradeGatekeeperView } from "./components/TradeGatekeeperView";
import { EventCenterView } from "./components/EventCenterView";
import { TechnicalChartView } from "./components/TechnicalChartView";
import { DecisionJournalView } from "./components/DecisionJournalView";
import { TeamsAdaptiveCardView } from "./components/TeamsAdaptiveCardView";
import { CaptureReviewModal } from "./components/CaptureReviewModal";
import { ReliabilityTestModal } from "./components/ReliabilityTestModal";
import { DailyCheckWidget } from "./components/DailyCheckWidget";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [unreadTeamsCount, setUnreadTeamsCount] = useState<number>(2);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState<boolean>(false);
  const [isReliabilityModalOpen, setIsReliabilityModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Core State
  const [regimeState, setRegimeState] = useState<RegimeState>(initialRegimeState);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(initialHoldings);
  const [indicators, setIndicators] = useState<MarketIndicator[]>(initialMarketIndicators);
  const [factorScores, setFactorScores] = useState<RegimeFactorScore[]>(initialFactorScores);
  const [sgovSignals, setSgovSignals] = useState<SgovSignalItem[]>(initialSgovSignals);
  const [sgovPlan, setSgovPlan] = useState<SgovDeploymentPlan>(initialSgovDeploymentPlan);
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>(initialEvents);
  const [journalEntries, setJournalEntries] = useState<DecisionJournalEntry[]>(initialDecisionJournals);
  const [isLiveGrounded, setIsLiveGrounded] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  // Gatekeeper prefill parameters
  const [gatekeeperPrefill, setGatekeeperPrefill] = useState<{ ticker: string; amount: number }>({
    ticker: "VOO",
    amount: 5000000,
  });

  // Fetch from backend API
  const fetchBackendState = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        if (data.regimeState) setRegimeState(data.regimeState);
        if (data.holdings) setHoldings(data.holdings);
        if (data.marketIndicators) setIndicators(data.marketIndicators);
        if (data.factorScores) setFactorScores(data.factorScores);
        if (data.sgovSignals) setSgovSignals(data.sgovSignals);
        if (data.sgovPlan) setSgovPlan(data.sgovPlan);
        if (data.macroEvents) setMacroEvents(data.macroEvents);
        if (data.journalEntries) setJournalEntries(data.journalEntries);
        if (data.isLiveGrounded !== undefined) setIsLiveGrounded(data.isLiveGrounded);
        if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
      }
    } catch (err) {
      console.warn("Backend API not reachable, running with local engine state:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Trigger Gemini Real-Time Grounded Market Sync
  const handleSyncGeminiLive = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/market/live-sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.liveState) {
          const ls = data.liveState;
          if (ls.regimeState) setRegimeState(ls.regimeState);
          if (ls.marketIndicators) setIndicators(ls.marketIndicators);
          if (ls.factorScores) setFactorScores(ls.factorScores);
          if (ls.macroEvents) setMacroEvents(ls.macroEvents);
          setIsLiveGrounded(true);
          const syncTime = ls.lastSyncedAt || new Date().toISOString();
          setLastSyncedAt(syncTime);
          setToastMessage("✨ Gemini 실시간 검색 기반 시장 레짐·지표·일정이 최신 상태로 동기화되었습니다!");
          setTimeout(() => setToastMessage(null), 5000);
        }
      } else {
        throw new Error("Sync failed with status " + res.status);
      }
    } catch (err) {
      console.error("Gemini sync error:", err);
      setToastMessage("⚠️ 실시간 동기화 중 오류가 발생했습니다. 기본 엔진 데이터를 유지합니다.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackendState();
  }, []);

  // Update regime score in state
  const handleUpdateRegimeScore = (newScore: number, newRegime: RegimeType) => {
    setRegimeState((prev) => ({
      ...prev,
      regimeScore: newScore,
      regime: newRegime,
      action: newRegime === "Risk On" ? "BUY" : newRegime === "Defensive" ? "REDUCE" : "WAIT",
      dailyMaxOrderKRW: newRegime === "Risk On" ? 15000000 : newRegime === "Defensive" ? 0 : 5000000,
    }));
  };

  // Toggle Event Lock
  const handleToggleEventLock = (eventId: string) => {
    setMacroEvents((prev) =>
      prev.map((e) => (e.eventId === eventId ? { ...e, isLocked: !e.isLocked } : e))
    );
  };

  // SGOV Quick Order trigger to Gatekeeper
  const handleDeployOrder = (asset: string, amountKRW: number) => {
    const ticker = asset.split(" ")[0];
    setGatekeeperPrefill({ ticker, amount: amountKRW });
    setActiveTab("gatekeeper");
  };

  // Save Gatekeeper decision into Journal
  const handleSaveToJournal = (entryData: any) => {
    const newEntry: DecisionJournalEntry = {
      journalId: `J-${Date.now()}`,
      tradeId: `TR-${Date.now().toString().slice(-4)}`,
      decisionDate: new Date().toISOString().split("T")[0],
      ...entryData,
    };
    setJournalEntries([newEntry, ...journalEntries]);
    setActiveTab("journal");
  };

  // Handle OCR Baseline Commitment
  const handleCommitSuccess = (commitData: any) => {
    const approvedSnapshot = commitData.snapshot;
    const snapshotHoldings = approvedSnapshot?.holdings || approvedSnapshot?.items || [];
    if (approvedSnapshot && snapshotHoldings.length > 0) {
      // Map extracted holdings to PortfolioHolding model
      const convertedItems: PortfolioHolding[] = snapshotHoldings.map((item: any, idx: number) => {
        const isStock = ["GOOGL", "QQQ", "VOO", "SMH", "NVDA"].includes(item.ticker) || (!item.name.includes("채권") && !item.isCash);
        const isSgov = item.ticker === "SGOV" || item.name.includes("Treasury") || Boolean(item.isCash);
        
        return {
          holdingId: `SNAP-H-${idx}-${Date.now()}`,
          asOfDate: approvedSnapshot.asOfDate || new Date().toISOString().split("T")[0],
          account: `${approvedSnapshot.brokerName} (${approvedSnapshot.detectedAccountIdMasked || "계좌"})`,
          accountType: approvedSnapshot.accountType as any,
          ticker: item.ticker || "UNKNOWN",
          assetName: item.name,
          quantity: item.quantity,
          price: item.quantity > 0 ? Math.round(item.evalAmount / item.quantity) : item.evalAmount,
          currency: "KRW",
          fxRate: 1,
          marketValueKRW: item.evalAmount,
          costKRW: item.costAmount,
          assetClass: isSgov ? "채권·현금" : isStock ? "주식" : "채권·현금",
          sector: isStock ? "US Equities" : "Cash & Equivalents",
          riskBucket: isStock ? "미국 성장·지수" : "현금성·SGOV",
          tradable: true,
          restricted: false,
          taxConstraint: "일반 과세",
          lookThroughUnderlying: item.ticker === "QQQ" ? { googPct: 5.8, semisPct: 16.2 } : item.ticker === "VOO" ? { googPct: 3.9, semisPct: 10.4 } : undefined
        };
      });

      // Add cash holding if cashBalance > 0
      if (approvedSnapshot.cashBalance > 0) {
        convertedItems.push({
          holdingId: `SNAP-CASH-${Date.now()}`,
          asOfDate: approvedSnapshot.asOfDate || new Date().toISOString().split("T")[0],
          account: `${approvedSnapshot.brokerName} (${approvedSnapshot.detectedAccountIdMasked || "계좌"})`,
          accountType: approvedSnapshot.accountType as any,
          ticker: "KRW_CASH",
          assetName: `${approvedSnapshot.brokerName} 예수금`,
          quantity: 1,
          price: approvedSnapshot.cashBalance,
          currency: "KRW",
          fxRate: 1,
          marketValueKRW: approvedSnapshot.cashBalance,
          costKRW: approvedSnapshot.cashBalance,
          assetClass: "채권·현금",
          sector: "KRW Cash",
          riskBucket: "현금성·SGOV",
          tradable: true,
          restricted: false,
          taxConstraint: "비과세/원천징수"
        });
      }

      // Filter out previous holdings of the same account and append new snapshot items
      const remainingHoldings = holdings.filter(
        h => !h.account.includes(approvedSnapshot.brokerName)
      );
      const updatedHoldings = [...convertedItems, ...remainingHoldings];
      setHoldings(updatedHoldings);

      // If server returned deterministic updatedState, apply it directly; otherwise recalculate locally
      if (commitData.updatedState) {
        setRegimeState(prev => ({
          ...prev,
          currentStockWeight: commitData.updatedState.currentStockWeight,
          targetStockWeight: commitData.updatedState.targetStockWeight,
          stockShortagePct: commitData.updatedState.stockShortagePct,
          totalAssetKRW: commitData.updatedState.totalAssetKRW
        }));
      } else {
        const totalVal = updatedHoldings.reduce((sum, h) => sum + h.marketValueKRW, 0);
        const stockVal = updatedHoldings.filter(h => h.assetClass === "주식").reduce((sum, h) => sum + h.marketValueKRW, 0);
        const newStockWeight = totalVal > 0 ? stockVal / totalVal : 0.384;
        const shortage = Math.max(0, (regimeState.targetStockWeight - newStockWeight) * 100);

        setRegimeState(prev => ({
          ...prev,
          currentStockWeight: Number(newStockWeight.toFixed(3)),
          stockShortagePct: Number(shortage.toFixed(1)),
          shortageWeightPct: Number(shortage.toFixed(1)),
          deployableAmountKRW: Math.round(totalVal * (shortage / 100)),
          totalAssetKRW: totalVal
        }));
      }

      setToastMessage(`✅ ${approvedSnapshot.brokerName} 캡처 OCR 기준선이 승인·반영되었습니다! (오차 0원 검산 통과)`);
      setActiveTab("portfolio");
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col">
      {/* Top Universal Navbar */}
      <Navbar
        currentRegime={regimeState.regime}
        regimeScore={regimeState.regimeScore}
        isMobileFrame={isMobileFrame}
        setIsMobileFrame={setIsMobileFrame}
        unreadCount={unreadTeamsCount}
        onOpenTeamsCards={() => {
          setActiveTab("teams");
          setUnreadTeamsCount(0);
        }}
        onOpenTechnicalChart={() => setActiveTab("chart")}
        onRefreshPythonState={handleSyncGeminiLive}
        isRefreshing={isRefreshing}
        onOpenCaptureModal={() => setIsCaptureModalOpen(true)}
        isLiveGrounded={isLiveGrounded}
        lastSyncedAt={lastSyncedAt}
        onOpenReliabilityTest={() => setIsReliabilityModalOpen(true)}
        onOpenDailyCheck={() => setActiveTab("daily-check")}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Container: Mobile Frame vs Wide Mode */}
      <main className="flex-1 flex justify-center py-4 px-2 sm:px-4">
        <div
          className={`w-full transition-all duration-300 ${
            isMobileFrame
              ? "max-w-[420px] bg-white dark:bg-stone-900 rounded-[40px] shadow-2xl border-[8px] border-stone-300 dark:border-stone-800 flex flex-col overflow-hidden min-h-[840px] relative"
              : "max-w-5xl"
          }`}
        >
          {/* Mobile Hardware Frame Header (Only when frame active) */}
          {isMobileFrame && (
            <div className="pt-3 pb-2 px-6 flex items-center justify-between border-b border-stone-100 dark:border-stone-850 bg-stone-50/50 dark:bg-stone-900/50">
              <span className="text-[11px] font-semibold font-mono text-stone-600 dark:text-stone-400">
                07:30
              </span>
              {/* Dynamic Island / Speaker notch */}
              <div className="w-20 h-3.5 bg-stone-900 dark:bg-stone-800 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-stone-800 dark:bg-stone-700 mr-1" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-stone-600 dark:text-stone-400">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Sub Navigation Bar for Extra Views (Daily Check, IPO, Teams, Architecture) */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100 dark:border-stone-800 text-[11px] font-medium bg-stone-50/30 dark:bg-stone-850/20 overflow-x-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("daily-check")}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-bold ${
                  activeTab === "daily-check"
                    ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-2xs"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                }`}
              >
                <span>☀️ DAILY CHECK</span>
              </button>
              <button
                onClick={() => setActiveTab("chart")}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-bold ${
                  activeTab === "chart"
                    ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-2xs"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                }`}
              >
                <span>📈 기술적 차트</span>
              </button>
              <button
                onClick={() => setActiveTab("teams")}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  activeTab === "teams"
                    ? "bg-[#464EB8] text-white font-bold"
                    : "text-stone-600 dark:text-stone-300 hover:text-stone-900"
                }`}
              >
                Teams 알림
              </button>
            </div>

            <span className="text-[10px] text-stone-600 dark:text-stone-300 font-mono hidden sm:inline">
              Engine: Pure TS + Gemini
            </span>
          </div>

          {/* Active View Router */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto">
            {activeTab === "daily-check" && (
              <DailyCheckWidget
                onOpenGatekeeper={(ticker) => {
                  if (ticker) setGatekeeperPrefill({ ticker, amount: 5000000 });
                  setActiveTab("gatekeeper");
                }}
                onOpenReliabilityTest={() => setIsReliabilityModalOpen(true)}
              />
            )}

            {activeTab === "home" && (
              <HomeDashboard
                state={regimeState}
                indicators={indicators}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenGatekeeperFor={(ticker) => {
                  if (ticker) setGatekeeperPrefill({ ticker, amount: 5000000 });
                  setActiveTab("gatekeeper");
                }}
                onRunDailyCheck={() => {
                  setUnreadTeamsCount(0);
                }}
                onOpenDailyCheckView={() => setActiveTab("daily-check")}
                onOpenReliabilityTest={() => setIsReliabilityModalOpen(true)}
              />
            )}

            {activeTab === "portfolio" && (
              <PortfolioView
                holdings={holdings}
                onInspectTicker={(t) => {
                  setGatekeeperPrefill({ ticker: t, amount: 5000000 });
                  setActiveTab("gatekeeper");
                }}
                onOpenCaptureModal={() => setIsCaptureModalOpen(true)}
              />
            )}

            {activeTab === "regime" && (
              <RegimeMonitorView
                initialState={regimeState}
                factorScores={factorScores}
                onUpdateRegimeScore={handleUpdateRegimeScore}
                onSyncGeminiLive={handleSyncGeminiLive}
                isSyncing={isRefreshing}
                onOpenReliabilityTest={() => setIsReliabilityModalOpen(true)}
                onNavigateToTechnicalChart={() => setActiveTab("chart")}
              />
            )}

            {activeTab === "sgov" && (
              <DeploySgovView
                signals={sgovSignals}
                plan={sgovPlan}
                onDeployOrder={handleDeployOrder}
              />
            )}

            {activeTab === "gatekeeper" && (
              <TradeGatekeeperView
                currentRegimeState={regimeState}
                prefillTicker={gatekeeperPrefill.ticker}
                prefillAmount={gatekeeperPrefill.amount}
                onSaveToJournal={handleSaveToJournal}
              />
            )}

            {activeTab === "events" && (
              <EventCenterView
                events={macroEvents}
                onToggleLock={handleToggleEventLock}
                onSyncGeminiLive={handleSyncGeminiLive}
                isSyncing={isRefreshing}
              />
            )}

            {activeTab === "chart" && (
              <TechnicalChartView
                onOpenGatekeeper={(ticker) => {
                  setGatekeeperPrefill({ ticker, amount: 5000000 });
                  setActiveTab("gatekeeper");
                }}
              />
            )}

            {activeTab === "journal" && (
              <DecisionJournalView
                entries={journalEntries}
                onAddReview={() => {}}
              />
            )}

            {activeTab === "teams" && (
              <TeamsAdaptiveCardView
                state={regimeState}
                onOpenGatekeeper={() => setActiveTab("gatekeeper")}
                onNavigateTab={(t) => setActiveTab(t)}
              />
            )}
          </div>

          {/* Bottom Tab Bar */}
          <BottomTabBar activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />
        </div>
      </main>

      {/* OCR Capture & Review Modal */}
      <CaptureReviewModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onCommitSuccess={handleCommitSuccess}
      />

      {/* Yahoo Finance Real-time Reliability Test Modal */}
      <ReliabilityTestModal
        isOpen={isReliabilityModalOpen}
        onClose={() => setIsReliabilityModalOpen(false)}
        onSuccessSync={fetchBackendState}
      />
    </div>
  );
}
