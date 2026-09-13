// src/server/geminiResilience.ts
// Robust resilience layer for Gemini API (Circuit breaker on 429 quota, Retry on 503)

import { GoogleGenAI } from "@google/genai";

export interface ResilienceOptions {
  primaryModel?: string;
  fallbackModel?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

export interface ResilienceResult {
  text: string | null;
  usedModel: string;
  isQuotaExhausted?: boolean;
}

// Circuit breaker state for quota exhaustion
let quotaExhaustedUntil: number = 0;
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> {
  let timeoutHandle: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Gemini call timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Checks if the quota circuit breaker is currently open
 */
export function isQuotaCircuitBreakerOpen(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

/**
 * Trips the circuit breaker when 429/RESOURCE_EXHAUSTED is encountered
 */
export function tripQuotaCircuitBreaker(): void {
  quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN_MS;
  console.info(
    "[Gemini Resilience] Quota limit detected. Circuit breaker active for 10 minutes. Running in high-precision heuristic mode."
  );
}

/**
 * Resets the circuit breaker manually (e.g. if new key or user requested refresh)
 */
export function resetQuotaCircuitBreaker(): void {
  quotaExhaustedUntil = 0;
}

/**
 * Checks specifically whether an error is a 429 quota exhaustion
 */
export function isQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  const msg = error.message || error.toString() || "";
  const status = error.status || "";
  const code = error.code || (error.error && error.error.code);

  return (
    status === "RESOURCE_EXHAUSTED" ||
    code === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("quota")
  );
}

/**
 * Checks whether an error is a transient server error (503 High Demand / Unavailable)
 */
export function isServerTransientError(error: any): boolean {
  if (!error) return false;
  if (isQuotaExhaustedError(error)) return false; // Quota exhaustion is NOT a transient server error
  const msg = error.message || error.toString() || "";
  const status = error.status || "";
  const code = error.code || (error.error && error.error.code);

  return (
    status === "UNAVAILABLE" ||
    code === 503 ||
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("fetch failed")
  );
}

/**
 * Executes a Gemini generateContent call with model cascading, backoff, and quota circuit breaker
 */
export async function generateContentWithResilience(
  ai: GoogleGenAI | null,
  params: {
    contents: any;
    config?: any;
  },
  options: ResilienceOptions = {}
): Promise<ResilienceResult> {
  if (!ai) {
    return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: false };
  }

  // If circuit breaker is active, do not make any network calls to Gemini
  if (isQuotaCircuitBreakerOpen()) {
    return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: true };
  }

  const primaryModel = options.primaryModel || "gemini-3.8-flash";
  const fallbackModel = options.fallbackModel || "gemini-3.1-flash-lite";
  const maxRetries = options.maxRetries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 600;
  const timeoutMs = options.timeoutMs ?? 7000;

  // 1. Try Primary Model
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callWithTimeout(
        ai.models.generateContent({
          model: primaryModel,
          contents: params.contents,
          config: params.config,
        }),
        timeoutMs
      );
      return { text: response.text || null, usedModel: primaryModel, isQuotaExhausted: false };
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        tripQuotaCircuitBreaker();
        return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: true };
      }

      // Only retry if it's transient 503 server congestion
      if (isServerTransientError(err) && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If server is unavailable, try fallback model once
      if (isServerTransientError(err) && fallbackModel && fallbackModel !== primaryModel) {
        break;
      }

      return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: false };
    }
  }

  // 2. Try Fallback Model (only if 503 occurred and circuit breaker is not tripped)
  if (!isQuotaCircuitBreakerOpen()) {
    try {
      const response = await callWithTimeout(
        ai.models.generateContent({
          model: fallbackModel,
          contents: params.contents,
          config: params.config,
        }),
        timeoutMs
      );
      return { text: response.text || null, usedModel: fallbackModel, isQuotaExhausted: false };
    } catch (fallbackErr: any) {
      if (isQuotaExhaustedError(fallbackErr)) {
        tripQuotaCircuitBreaker();
        return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: true };
      }
      return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: false };
    }
  }

  return { text: null, usedModel: "offline-rule-engine", isQuotaExhausted: true };
}

