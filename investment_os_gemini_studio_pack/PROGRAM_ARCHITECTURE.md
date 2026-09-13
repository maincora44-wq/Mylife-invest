# Investment OS - 프로그램 아키텍처 및 캡처 처리 파이프라인 (PROGRAM_ARCHITECTURE.md)

## 1. 시스템 전체 흐름도 (End-to-End Pipeline)

```text
[모바일 클라이언트 (React/PWA)]
  ├── 1. 계좌 캡처 이미지 선택 (카메라 촬영 / 갤러리 업로드 / 다중 파일 지원)
  ├── 2. 클라이언트단 EXIF 제거 및 개인정보 마스킹 미리보기
  │
  ▼ [POST /api/ocr/extract (Multipart/Base64)]
[서버사이드 파이프라인 (Node.js/Express + Python 엔진 연계)]
  ├── 3. Gemini Vision 멀티모달 API 호출 (JSON Schema Structured Output 강제)
  ├── 4. 서버사이드 결정론적 검산기 (Arithmetic Verifier)
  │      └── evalSum + cashBalance == totalAssetAmount 확인 (오차 한도 체크)
  ├── 5. 중복 판정 엔진 (Deduplication Engine)
  │      ├── 동일 계좌번호 마스킹 및 증권사 패턴 대조 (기존 스냅샷 갱신 여부)
  │      └── 마이데이터 통합 화면(Toss 등)과 개별 증권사 중복 등록 감지
  │
  ▼ [JSON 응답 (Extraction & Verification Result)]
[모바일 검수 UI (CaptureReview Modal)]
  ├── 6. 신뢰도별 하이라이트 (>=0.95 정상, 0.80~0.95 노란색 검수, <0.80 빨간색 수동확인)
  ├── 7. 사용자가 행별 종목명/수량/평가금액 즉석 인라인 수정 가능
  ├── 8. 검산 불일치 시 [승인] 버튼 잠김 (사용자가 수정하여 차액 0 맞출 때 해제)
  │
  ▼ [사용자 [최종 승인 및 기준선 반영] 클릭]
[포트폴리오 코어 엔진 (Portfolio Engine)]
  ├── 9. 과거 스냅샷 보존 + 최신 기준선(Baseline) 갱신
  ├── 10. Look-through 실질 노출 및 5대 위험묶음 즉시 재계산
  └── 11. 레짐 상태, 여유 한도, SGOV 재투입 가능액 갱신
```

## 2. 모바일 반응형 및 해상도 대응
- 최소 폭 **360px 모바일 화면**에서도 표가 깨지지 않도록 모바일 카드형/인라인 수정 폼 제공
- 터치 타깃 44px 이상 확보
- 카메라 직접 촬영(HTML5 `<input type="file" accept="image/*" capture="environment">`) 완벽 지원
