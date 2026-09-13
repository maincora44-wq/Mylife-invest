import { z } from "zod";

// Helper: robustly parse KRW numeric values from numbers or strings
export function parseKRW(value: unknown): number | null {
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

export const ExtractedHoldingZodSchema = z.object({
  name: z.string().min(1, "종목명이 비어있습니다."),
  ticker: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  evalAmount: z.number(),
  costAmount: z.number(),
  pnlAmount: z.number(),
  pnlRate: z.number(),
  isPartial: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.95),
  isCash: z.boolean().optional().default(false),
});

export const PortfolioCaptureZodSchema = z.object({
  brokerName: z.string().min(1),
  accountType: z.enum(["위탁", "연금저축/IRP", "ISA", "CMA", "해외주식", "마이데이터_통합조회", "기타"]).default("위탁"),
  captureDate: z.string().nullable().optional(),
  currency: z.enum(["KRW", "USD"]).default("KRW"),
  totalAssetAmount: z.number().nullable().optional(),
  cashBalance: z.number().default(0),
  cashIncludedInHoldings: z.boolean().optional().default(false),
  isAggregatorScreen: z.boolean().default(false),
  detectedAccountIdMasked: z.string().nullable().optional(),
  holdings: z.array(ExtractedHoldingZodSchema).default([]),
  calculatedSumEval: z.number().optional(),
  discrepancy: z.number().optional(),
  discrepancyPass: z.boolean().optional(),
  requiresManualReview: z.boolean().optional(),
  auditNotes: z.array(z.string()).optional().default([]),
});

export type ValidatedPortfolioCapture = z.infer<typeof PortfolioCaptureZodSchema>;
export type ValidatedHolding = z.infer<typeof ExtractedHoldingZodSchema>;
