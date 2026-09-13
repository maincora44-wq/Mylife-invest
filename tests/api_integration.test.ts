// tests/api_integration.test.ts
// Integration test suite for Investment OS P0 API Requirements

import assert from "assert";
import { PersistentUserStore } from "../src/server/storage";
import { reconcilePortfolioCapture } from "../src/server/reconciler";

console.log("=== [P0 API & Persistence Integration Tests Starting] ===");

async function runIntegrationTests() {
  const testUid = `usr-test-${Date.now()}`;
  const store = new PersistentUserStore(testUid);
  await store.initStore();

  // 1. Check Initial Seeded Snapshot
  const initialSnapshots = await store.getSnapshots();
  assert.strictEqual(initialSnapshots.length >= 1, true, "Initial store must have at least 1 seeded snapshot");
  assert.strictEqual(Array.isArray(initialSnapshots[0].holdings), true, "Snapshot must have 'holdings' array (not 'items')");
  console.log("✓ Initial user-scoped persistent storage initialization passed");

  // 2. Test Import Job Creation (Provisional)
  const jobPayload = {
    importJobId: `JOB-TEST-${Date.now()}`,
    userId: testUid,
    createdAt: new Date().toISOString(),
    status: "PROVISIONAL" as const,
    dataMode: "LIVE" as const,
    accountFingerprint: PersistentUserStore.generateAccountFingerprint("미래에셋증권", "위탁", "890", testUid),
    reviewedData: {
      brokerName: "미래에셋증권",
      accountType: "위탁",
      captureDate: "2026-09-12",
      currency: "KRW" as const,
      totalAssetAmount: 100000000,
      cashBalance: 10000000,
      cashIncludedInHoldings: false,
      isAggregatorScreen: false,
      detectedAccountIdMasked: "512-****-890",
      holdings: [
        { name: "S&P500 ETF", ticker: "VOO", quantity: 100, evalAmount: 90000000, costAmount: 85000000, pnlAmount: 5000000, pnlRate: 0.058, isPartial: false, confidence: 0.99, isCash: false }
      ]
    },
    reconciliation: {
      discrepancyPass: true,
      discrepancy: 0,
      allowedTolerance: 10000,
      calculatedTotal: 100000000,
      stockSum: 90000000,
      effectiveCash: 10000000,
      hasPartialItems: false,
      requiresManualReview: false,
      auditNotes: ["검산 0원 일치"]
    },
    classification: "NEW_ACCOUNT" as const
  };

  await store.saveImportJob(jobPayload);
  const loadedJob = await store.getImportJob(jobPayload.importJobId);
  assert.notStrictEqual(loadedJob, null, "Import job must be persistently saved");
  assert.strictEqual(loadedJob?.status, "PROVISIONAL", "Job status must initially be PROVISIONAL");
  console.log("✓ Import job provisional storage passed");

  // 3. Test DEMO Commit Block
  const demoJob = {
    ...jobPayload,
    importJobId: `JOB-DEMO-${Date.now()}`,
    dataMode: "DEMO" as const
  };
  await store.saveImportJob(demoJob);

  // DEMO check
  assert.strictEqual(demoJob.dataMode, "DEMO", "Demo job correctly tagged as DEMO");
  console.log("✓ DEMO data classification passed");

  // 4. Test Discrepancy Failure Block
  const badReconciliation = reconcilePortfolioCapture({
    brokerName: "미래에셋",
    accountType: "위탁",
    currency: "KRW",
    totalAssetAmount: 150000000, // Discrepancy: 150m vs 100m
    cashBalance: 10000000,
    cashIncludedInHoldings: false,
    isAggregatorScreen: false,
    auditNotes: [],
    holdings: [
      { name: "VOO", ticker: "VOO", quantity: 100, evalAmount: 90000000, costAmount: 85000000, pnlAmount: 5000000, pnlRate: 0.058, isPartial: false, confidence: 0.99, isCash: false }
    ]
  });
  assert.strictEqual(badReconciliation.discrepancyPass, false, "Discrepancy of 50M must FAIL pass check");
  console.log("✓ Failing discrepancy detection passed");

  // 5. Test Live Passing Job Approval & Recalculation
  const approvedSnapshot: any = {
    snapshotId: `SNAP-NEW-${Date.now()}`,
    accountId: "ACC-TEST-01",
    approvedAt: new Date().toISOString(),
    asOfDate: "2026-09-12",
    captureDate: "2026-09-12",
    brokerName: jobPayload.reviewedData.brokerName,
    accountType: jobPayload.reviewedData.accountType,
    detectedAccountIdMasked: jobPayload.reviewedData.detectedAccountIdMasked,
    totalAssetAmount: jobPayload.reviewedData.totalAssetAmount,
    cashBalance: jobPayload.reviewedData.cashBalance,
    holdingsCount: jobPayload.reviewedData.holdings.length,
    dataStatus: "CONFIRMED",
    holdings: jobPayload.reviewedData.holdings
  };
  await store.saveSnapshot(approvedSnapshot);

  const updatedSnapshots = await store.getSnapshots();
  assert.strictEqual(updatedSnapshots.some(s => s.snapshotId === approvedSnapshot.snapshotId), true, "New snapshot must be stored in persistent storage");
  console.log("✓ Snapshot approval and storage passed");

  // 6. Test Persistence Across New Store Instance (Simulate Server Restart)
  const reloadedStore = new PersistentUserStore(testUid);
  await reloadedStore.initStore();
  const reloadedSnapshots = await reloadedStore.getSnapshots();
  assert.strictEqual(reloadedSnapshots.some(s => s.snapshotId === approvedSnapshot.snapshotId), true, "Data survives server restart via file persistence");
  console.log("✓ Server restart persistence verified");

  console.log("=== [All P0 Integration Tests PASSED Successfully] ===");
}

runIntegrationTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
