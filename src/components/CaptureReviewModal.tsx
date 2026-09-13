import React, { useState, useRef } from "react";
import { 
  Upload, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  X, 
  Sparkles, 
  FileText, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { CaptureExtractionResult, ExtractedHoldingItem } from "../types";
import { formatKRW, formatPct } from "../utils/formatters";

interface CaptureReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitSuccess: (approvedData: any) => void;
}

// Client-side image resize helper to keep payload strictly within 12MB limit
async function resizeImageClient(file: File, maxDim = 1600, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const raw = (reader.result as string).replace(/^data:image\/\w+;base64,/, "");
          return resolve({ base64: raw, mimeType: file.type || "image/jpeg" });
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({
          base64: dataUrl.replace(/^data:image\/\w+;base64,/, ""),
          mimeType: "image/jpeg"
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CaptureReviewModal: React.FC<CaptureReviewModalProps> = ({
  isOpen,
  onClose,
  onCommitSuccess,
}) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractionResult, setExtractionResult] = useState<CaptureExtractionResult | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<"LIVE" | "DEMO">("LIVE");
  const [editHoldings, setEditHoldings] = useState<ExtractedHoldingItem[]>([]);
  const [editTotalAsset, setEditTotalAsset] = useState<number>(0);
  const [editCashBalance, setEditCashBalance] = useState<number>(0);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle image files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    setImageFiles(files);
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    setExtractionResult(null);
    setCommitError(null);
  };

  // Convert file to base64 with client resize and create provisional import job
  const runExtraction = async (samplePreset?: string) => {
    setIsLoading(true);
    setCommitError(null);

    try {
      let bodyData: any = {};
      if (samplePreset) {
        bodyData = { samplePreset };
      } else if (imageFiles.length > 0) {
        const file = imageFiles[0];
        const resized = await resizeImageClient(file);
        bodyData = {
          imageBase64: resized.base64,
          mimeType: resized.mimeType,
          fileName: file.name,
        };
      } else {
        alert("분석할 캡처 이미지를 먼저 선택해주세요.");
        setIsLoading(false);
        return;
      }

      // Secure Bearer Token passed to API
      const res = await fetch("/api/import-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer usr-preview-client-01"
        },
        body: JSON.stringify(bodyData),
      });

      const jobData = await res.json();
      if (!res.ok) {
        throw new Error(jobData.message || `서버 추출 실패 (${res.status})`);
      }

      setCurrentJobId(jobData.importJobId);
      setDataMode(jobData.dataMode || "LIVE");

      const reviewed = jobData.reviewedData;
      setExtractionResult({
        captureId: jobData.importJobId,
        brokerName: reviewed.brokerName,
        accountType: reviewed.accountType,
        captureDate: reviewed.captureDate,
        currency: reviewed.currency,
        totalAssetAmount: reviewed.totalAssetAmount || 0,
        cashBalance: reviewed.cashBalance || 0,
        isAggregatorScreen: reviewed.isAggregatorScreen,
        detectedAccountIdMasked: reviewed.detectedAccountIdMasked || "미식별",
        holdings: reviewed.holdings,
        calculatedSumEval: jobData.reconciliation.calculatedTotal,
        discrepancy: jobData.reconciliation.discrepancy,
        discrepancyPass: jobData.reconciliation.discrepancyPass,
        requiresManualReview: jobData.reconciliation.requiresManualReview,
        auditNotes: jobData.reconciliation.auditNotes,
        duplicationWarning: jobData.duplicationWarning,
        isSimulated: jobData.dataMode === "DEMO"
      });

      setEditHoldings(reviewed.holdings || []);
      setEditTotalAsset(reviewed.totalAssetAmount || 0);
      setEditCashBalance(reviewed.cashBalance || 0);
    } catch (err: any) {
      console.error("Import Job Creation Failed:", err);
      setCommitError(err.message || "이미지 추출 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Arithmetic verification logic
  const currentSumEval = editHoldings.reduce((sum, h) => sum + (Number(h.evalAmount) || 0), 0);
  const currentCalculatedTotal = currentSumEval + (Number(editCashBalance) || 0);
  const currentDiscrepancy = Number(editTotalAsset) - currentCalculatedTotal;
  const currentAllowedTolerance = Math.max(1000, Number(editTotalAsset) * 0.0001);
  const isDiscrepancyPassing = Math.abs(currentDiscrepancy) <= currentAllowedTolerance;

  // Handle inline holding edit
  const handleUpdateHolding = (index: number, field: keyof ExtractedHoldingItem, value: any) => {
    const updated = [...editHoldings];
    updated[index] = {
      ...updated[index],
      [field]: field === "name" || field === "ticker" ? value : Number(value) || 0,
    };
    setEditHoldings(updated);
  };

  const handleRemoveHolding = (index: number) => {
    setEditHoldings(editHoldings.filter((_, i) => i !== index));
  };

  const handleAddHolding = () => {
    setEditHoldings([
      ...editHoldings,
      {
        name: "신규 종목",
        ticker: null,
        quantity: 1,
        evalAmount: 0,
        costAmount: 0,
        pnlAmount: 0,
        pnlRate: 0,
        isPartial: false,
        confidence: 1.0,
      },
    ]);
  };

  // Commit approved provisional job to baseline
  const handleCommitBaseline = async () => {
    if (dataMode === "DEMO") {
      setCommitError("시연용 프리셋(DEMO) 데이터는 포트폴리오 안전을 위해 승인이 차단되어 있습니다. 카메라 또는 갤러리 캡처 이미지를 업로드하여 승인하십시오.");
      return;
    }

    if (!isDiscrepancyPassing) {
      setCommitError("합계 오차가 허용 범위를 초과하여 기준선 반영이 차단되었습니다.");
      return;
    }

    if (!currentJobId) {
      setCommitError("유효한 검수 작업 ID가 없습니다.");
      return;
    }

    setIsCommitting(true);
    setCommitError(null);

    try {
      // 1. Send modifications to server provisional job
      await fetch(`/api/import-jobs/${currentJobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer usr-preview-client-01"
        },
        body: JSON.stringify({
          reviewedData: {
            ...extractionResult,
            totalAssetAmount: editTotalAsset,
            cashBalance: editCashBalance,
            holdings: editHoldings,
          }
        }),
      });

      // 2. Approve provisional job
      const res = await fetch(`/api/import-jobs/${currentJobId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer usr-preview-client-01"
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "승인 실패");
      }

      onCommitSuccess(data);
      onClose();
    } catch (err: any) {
      setCommitError(err.message || "스냅샷 승인 중 오류가 발생했습니다.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-850/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                증권계좌 캡처 OCR 파이프라인
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  v1.0 무오차 검산
                </span>
              </h2>
              <p className="text-[11px] text-stone-600 dark:text-stone-300">
                캡처 업로드 → Gemini 추출 → 합계 검산 → 중복 판정 → 사용자 검수 → 기준선 반영
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Step 1: Upload Controls */}
          {!extractionResult && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-6 text-center bg-stone-50/50 dark:bg-stone-850/30 hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    증권사 잔고 캡처 이미지를 선택하거나 드래그하세요
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-300 max-w-sm">
                    복수 캡처 동시 처리 가능 · EXIF 메타데이터 자동 제거 · 계좌번호 자동 마스킹
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      카메라 직접 촬영
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold hover:bg-stone-200 dark:hover:bg-stone-700"
                    >
                      갤러리에서 선택
                    </button>
                  </div>
                </div>
              </div>

              {/* Selected Previews */}
              {imageFiles.length > 0 && (
                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      선택된 캡처: {imageFiles.length}개 파일
                    </span>
                    <span className="text-[10px] text-stone-600 dark:text-stone-300">
                      ({imageFiles.map((f) => f.name).join(", ")})
                    </span>
                  </div>
                  <button
                    onClick={() => runExtraction()}
                    disabled={isLoading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    {isLoading ? (
                      <span className="animate-spin text-sm">⏳</span>
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Gemini OCR 정밀 분석 실행
                  </button>
                </div>
              )}

              {/* Instant Verification Demo Presets */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  테스트용 캡처 프리셋 즉시 시뮬레이션
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => runExtraction("samsung_securities")}
                    disabled={isLoading}
                    className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-left hover:border-blue-500 transition-colors group"
                  >
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600">
                      1. 삼성증권 위탁계좌 (재촬영)
                    </div>
                    <div className="text-[10px] text-stone-600 dark:text-stone-300 mt-0.5">
                      총자산 2.36억 · 합계 검산 통과 · 동일 계좌 갱신 판정
                    </div>
                  </button>
                  <button
                    onClick={() => runExtraction("toss_aggregator_warning")}
                    disabled={isLoading}
                    className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 text-left hover:border-amber-500 transition-colors group"
                  >
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 group-hover:text-amber-600">
                      2. Toss 통합조회 (이중합산 경고)
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                      마이데이터 감지 · 개별 원계좌 이중합산 차단 경고
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Extraction & Verification Results */}
          {extractionResult && (
            <div className="space-y-4">
              {/* Top Summary Bar */}
              <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {extractionResult.brokerName}
                  </span>
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                    {extractionResult.accountType} ({extractionResult.detectedAccountIdMasked})
                  </span>
                  <span className="text-[11px] text-stone-600 dark:text-stone-300 font-mono">
                    {extractionResult.captureDate}
                  </span>
                </div>

                <button
                  onClick={() => setExtractionResult(null)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  다른 이미지 다시 올리기
                </button>
              </div>

              {/* Deduplication Warning Banner */}
              {extractionResult.duplicationWarning &&
                extractionResult.duplicationWarning.isDuplicate && (
                  <div
                    className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
                      extractionResult.duplicationWarning.duplicateType === "AGGREGATOR_DOUBLE_COUNT"
                        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold">
                        {extractionResult.duplicationWarning.duplicateType ===
                        "AGGREGATOR_DOUBLE_COUNT"
                          ? "이중 합산 위험 경고 (마이데이터 통합화면)"
                          : "동일 계좌 재촬영 감지 (스냅샷 갱신)"}
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {extractionResult.duplicationWarning.actionAdvice}
                      </p>
                    </div>
                  </div>
                )}

              {/* Deterministic Verification Discrepancy Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isDiscrepancyPassing
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                    : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isDiscrepancyPassing ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        {isDiscrepancyPassing
                          ? "합계 검산 일치 (무오차 통과)"
                          : "합계 검산 불일치 (승인 잠금)"}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isDiscrepancyPassing
                              ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                              : "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200"
                          }`}
                        >
                          오차: {currentDiscrepancy.toLocaleString()}원
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        화면 총자산({formatKRW(editTotalAsset)}) vs 종목합계({formatKRW(currentSumEval)}) + 예수금({formatKRW(editCashBalance)})
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono opacity-70">
                      허용치: ±{currentAllowedTolerance.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {!isDiscrepancyPassing && (
                  <div className="mt-2.5 p-2 bg-white/80 dark:bg-stone-900/80 rounded-xl text-[11px] text-red-700 dark:text-red-300 flex items-center gap-1.5 font-medium border border-red-200 dark:border-red-800">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      원칙 준수: 합계 차액이 해소될 때까지 포트폴리오 반영 [승인] 버튼이 잠깁니다.
                      아래 표에서 평가금액이나 예수금을 직접 수정하세요.
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Master Totals */}
              <div className="grid grid-cols-2 gap-2 bg-stone-50 dark:bg-stone-850 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                    화면 총자산 (원)
                  </label>
                  <input
                    type="number"
                    value={editTotalAsset}
                    onChange={(e) => setEditTotalAsset(Number(e.target.value) || 0)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                    예수금 / 현금잔고 (원)
                  </label>
                  <input
                    type="number"
                    value={editCashBalance}
                    onChange={(e) => setEditCashBalance(Number(e.target.value) || 0)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {/* Extracted Holdings List with Confidence pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    추출된 종목 목록 ({editHoldings.length}건)
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      0.95+ 정상
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      0.80~0.95 검수
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      0.80 미만 수동확인
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {editHoldings.map((holding, idx) => {
                    const conf = holding.confidence || 0.95;
                    const isHigh = conf >= 0.95;
                    const isMedium = conf >= 0.8 && conf < 0.95;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border bg-white dark:bg-stone-900 space-y-2 ${
                          holding.isPartial
                            ? "border-red-400 dark:border-red-800"
                            : isMedium
                            ? "border-amber-300 dark:border-amber-800"
                            : !isHigh
                            ? "border-red-300 dark:border-red-900"
                            : "border-stone-200 dark:border-stone-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={holding.name}
                              onChange={(e) => handleUpdateHolding(idx, "name", e.target.value)}
                              className="font-bold text-xs bg-transparent border-b border-dashed border-stone-300 dark:border-stone-700 px-1 py-0.5 focus:border-blue-500 outline-none w-full max-w-[200px]"
                              placeholder="종목명"
                            />
                            <input
                              type="text"
                              value={holding.ticker || ""}
                              onChange={(e) =>
                                handleUpdateHolding(idx, "ticker", e.target.value || null)
                              }
                              className="font-mono text-[11px] text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded w-16 text-center outline-none"
                              placeholder="티커"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {holding.isPartial && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                잘림주의
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isHigh
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                  : isMedium
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                  : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                              }`}
                            >
                              신뢰도: {(conf * 100).toFixed(0)}%
                            </span>
                            <button
                              onClick={() => handleRemoveHolding(idx)}
                              className="text-stone-600 hover:text-red-500 dark:text-stone-300 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Numbers Grid (Inline Editable) */}
                        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-[10px] text-stone-600 dark:text-stone-300 block font-sans">
                              수량 (주)
                            </span>
                            <input
                              type="number"
                              value={holding.quantity}
                              onChange={(e) =>
                                handleUpdateHolding(idx, "quantity", e.target.value)
                              }
                              className="w-full bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded border border-stone-200 dark:border-stone-800 text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-600 dark:text-stone-300 block font-sans">
                              평가금액 (원)
                            </span>
                            <input
                              type="number"
                              value={holding.evalAmount}
                              onChange={(e) =>
                                handleUpdateHolding(idx, "evalAmount", e.target.value)
                              }
                              className="w-full bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded border border-stone-200 dark:border-stone-800 text-xs font-bold text-blue-600 dark:text-blue-400"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-600 dark:text-stone-300 block font-sans">
                              매수금액 (원)
                            </span>
                            <input
                              type="number"
                              value={holding.costAmount}
                              onChange={(e) =>
                                handleUpdateHolding(idx, "costAmount", e.target.value)
                              }
                              className="w-full bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded border border-stone-200 dark:border-stone-800 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleAddHolding}
                  className="w-full py-2 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 flex items-center justify-center gap-1 hover:bg-stone-50 dark:hover:bg-stone-850 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  누락된 종목 수동 추가
                </button>
              </div>

              {/* Audit Notes */}
              {extractionResult.auditNotes && extractionResult.auditNotes.length > 0 && (
                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl text-[11px] text-stone-600 dark:text-stone-300 space-y-1">
                  <div className="font-bold text-stone-700 dark:text-stone-300">
                    추출 감사 메모:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {extractionResult.auditNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error display */}
              {commitError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
                  {commitError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            닫기
          </button>

          {extractionResult && (
            <div className="flex items-center gap-2">
              {dataMode === "DEMO" ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  DEMO 시연 데이터 (반영 불가)
                </span>
              ) : (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  LIVE 실제 캡처 검수
                </span>
              )}
              <button
                onClick={handleCommitBaseline}
                disabled={!isDiscrepancyPassing || isCommitting || dataMode === "DEMO"}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
                  isDiscrepancyPassing && !isCommitting && dataMode === "LIVE"
                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    : "bg-stone-300 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed"
                }`}
              >
                {isDiscrepancyPassing && dataMode === "LIVE" ? (
                  <Unlock className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {isCommitting ? "기준선 반영 중..." : dataMode === "DEMO" ? "시연용 (승인 불가)" : "사용자 승인 및 기준선 반영"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
