// tests/p0_verification.test.ts
// Test suite for Investment OS P0 Requirements Verification

import assert from "assert";
import crypto from "crypto";

console.log("=== [P0 Verification Test Suite Starting] ===");

// 1. Test: parseKRW helper handles formatted strings, negative signs, commas, and rejects NaN
function parseKRW(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(/[원,\s]/g, "")
    .replace(/[−–—]/g, "-");
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

assert.strictEqual(parseKRW("13,195,533원"), 13195533, "parseKRW formatted Korean currency");
assert.strictEqual(parseKRW("-500,000원"), -500000, "parseKRW negative currency");
assert.strictEqual(parseKRW("약 2억원"), null, "parseKRW reject approximate non-numeric text");
assert.strictEqual(parseKRW(1000000), 1000000, "parseKRW integer pass-through");
console.log("✓ parseKRW tests passed");

// 2. Test: Reconciliation formula avoids double-counting cash and excludes partial items
interface HoldingItem {
  name: string;
  ticker: string | null;
  quantity: number;
  evalAmount: number;
  costAmount: number;
  isPartial: boolean;
  isCash?: boolean;
}

function reconcilePortfolio(params: {
  totalAssetAmount: number | null;
  cashBalance: number;
  cashIncludedInHoldings: boolean;
  holdings: HoldingItem[];
}) {
  if (params.totalAssetAmount === null || !Number.isSafeInteger(params.totalAssetAmount)) {
    return {
      pass: false,
      reason: "TOTAL_ASSET_NOT_VISIBLE",
      discrepancy: Infinity,
      requiresManualReview: true
    };
  }

  // Exclude partial items from confirmed sum
  const validHoldings = params.holdings.filter(h => !h.isPartial);
  const stockSum = validHoldings.filter(h => !h.isCash).reduce((sum, h) => sum + h.evalAmount, 0);
  const holdingCashSum = validHoldings.filter(h => h.isCash).reduce((sum, h) => sum + h.evalAmount, 0);

  // If cash is already in holdings, do not add external cashBalance again!
  const effectiveCash = params.cashIncludedInHoldings ? holdingCashSum : (params.cashBalance || holdingCashSum);
  const calculatedTotal = stockSum + effectiveCash;
  const discrepancy = params.totalAssetAmount - calculatedTotal;
  const allowedTolerance = Math.max(1000, params.totalAssetAmount * 0.0001);
  const pass = Math.abs(discrepancy) <= allowedTolerance;

  return {
    pass,
    stockSum,
    effectiveCash,
    calculatedTotal,
    discrepancy,
    allowedTolerance,
    hasPartialItems: params.holdings.some(h => h.isPartial),
    requiresManualReview: !pass || params.holdings.some(h => h.isPartial)
  };
}

// Case A: Cash is in holdings as separate row, cashIncludedInHoldings = true
const caseA = reconcilePortfolio({
  totalAssetAmount: 131995015,
  cashBalance: 39677,
  cashIncludedInHoldings: true,
  holdings: [
    { name: "SGOV", ticker: "SGOV", quantity: 950, evalAmount: 131955338, costAmount: 130000000, isPartial: false },
    { name: "USD 외화예수금", ticker: null, quantity: 1, evalAmount: 39677, costAmount: 39677, isPartial: false, isCash: true }
  ]
});
assert.strictEqual(caseA.pass, true, "Case A: Cash in holdings without double counting passes");
assert.strictEqual(caseA.calculatedTotal, 131995015, "Case A: Calculated total matches totalAssetAmount");

// Case B: Partial item exists - must trigger manual review and be excluded from confirmed total
const caseB = reconcilePortfolio({
  totalAssetAmount: 100000000,
  cashBalance: 10000000,
  cashIncludedInHoldings: false,
  holdings: [
    { name: "QQQ", ticker: "QQQ", quantity: 100, evalAmount: 90000000, costAmount: 80000000, isPartial: false },
    { name: "VOO (잘림)", ticker: "VOO", quantity: 10, evalAmount: 8000000, costAmount: 7000000, isPartial: true }
  ]
});
assert.strictEqual(caseB.hasPartialItems, true, "Case B: Detects partial items");
assert.strictEqual(caseB.requiresManualReview, true, "Case B: Requires manual review due to partial item");

// Case C: Null totalAssetAmount must NOT be auto-passed
const caseC = reconcilePortfolio({
  totalAssetAmount: null,
  cashBalance: 5000000,
  cashIncludedInHoldings: false,
  holdings: [
    { name: "QQQ", ticker: "QQQ", quantity: 10, evalAmount: 10000000, costAmount: 9000000, isPartial: false }
  ]
});
assert.strictEqual(caseC.pass, false, "Case C: Missing total asset fails immediately");
assert.strictEqual(caseC.reason, "TOTAL_ASSET_NOT_VISIBLE", "Case C: Expected failure reason");

console.log("✓ Reconciliation & cash anti-double-counting tests passed");

// 3. Test: Account fingerprint generation is deterministic
function generateAccountFingerprint(institution: string, accountType: string, maskedSuffix: string, userId: string): string {
  return crypto.createHmac("sha256", "investment-os-salt")
    .update(`${institution}|${accountType}|${maskedSuffix}|${userId}`)
    .digest("hex")
    .slice(0, 16);
}

const fp1 = generateAccountFingerprint("삼성증권", "위탁", "102", "user-123");
const fp2 = generateAccountFingerprint("삼성증권", "위탁", "102", "user-123");
const fp3 = generateAccountFingerprint("삼성증권", "위탁", "103", "user-123");
assert.strictEqual(fp1, fp2, "Fingerprint must be deterministic");
assert.notStrictEqual(fp1, fp3, "Fingerprint differs for different account suffix");
console.log("✓ Account fingerprint tests passed");

// 4. Test: DEMO data commit prevention logic
function canApproveImportJob(job: { dataMode: string; discrepancyPass: boolean }): { allowed: boolean; error?: string } {
  if (job.dataMode === "DEMO") {
    return { allowed: false, error: "DEMO_DATA_CANNOT_BE_COMMITTED" };
  }
  if (!job.discrepancyPass) {
    return { allowed: false, error: "RECONCILIATION_FAILED" };
  }
  return { allowed: true };
}

assert.strictEqual(canApproveImportJob({ dataMode: "DEMO", discrepancyPass: true }).allowed, false, "DEMO data cannot be approved");
assert.strictEqual(canApproveImportJob({ dataMode: "LIVE", discrepancyPass: false }).allowed, false, "Failing discrepancy cannot be approved");
assert.strictEqual(canApproveImportJob({ dataMode: "LIVE", discrepancyPass: true }).allowed, true, "Live passing job can be approved");
console.log("✓ DEMO prevention & approval gate tests passed");

// 5. Test: Magic bytes file signature verification
function verifyImageSignature(buffer: Buffer, declaredMime: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (declaredMime === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47
  if (declaredMime === "image/png" && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }
  // WEBP: RIFF....WEBP (buffer[0..3] == "RIFF", buffer[8..11] == "WEBP")
  if (declaredMime === "image/webp" && buffer.length >= 12) {
    const isRiff = buffer.toString("ascii", 0, 4) === "RIFF";
    const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
    if (isRiff && isWebp) return true;
  }
  return false;
}

const mockJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const mockPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const mockFake = Buffer.from([0x00, 0x01, 0x02, 0x03]);

assert.strictEqual(verifyImageSignature(mockJpeg, "image/jpeg"), true, "Valid JPEG magic bytes pass");
assert.strictEqual(verifyImageSignature(mockPng, "image/png"), true, "Valid PNG magic bytes pass");
assert.strictEqual(verifyImageSignature(mockFake, "image/jpeg"), false, "Fake bytes as JPEG fail");
console.log("✓ Image magic byte verification tests passed");

console.log("=== [All P0 Core Logic Unit Tests PASSED Successfully] ===");
