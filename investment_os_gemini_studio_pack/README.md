# Investment OS Gemini AI Studio 개발 패키지 (v1.0)

본 패키지는 증권계좌 캡처 업로드 → Gemini 구조화 추출 → 합계 검산 → 중복 판정 → 사용자 모바일 검수 → 최신 기준선 반영으로 이어지는 Investment OS 캡처 OCR 파이프라인의 설계서, 헌법, 스키마, 명령어 모음입니다.

## 파일 구성
- `INITIAL_BUILD_PROMPT.txt`: Gemini AI Studio 최초 입력용 마스터 프롬프트
- `PRINCIPLES.md`: 변경 불가 투자 및 데이터 헌법 (15대 검수 기준 포함)
- `PROGRAM_ARCHITECTURE.md`: 모바일 PWA 및 캡처 처리 파이프라인 구조도
- `OCR_SYSTEM_PROMPT.md`: 한국 증권사 앱 특화 Gemini Vision OCR 전용 프롬프트
- `schemas/portfolio_capture.schema.json`: Structured Output 강제용 JSON Schema
- `COMMANDS.md`: 0~11단계 순차 개발 실행 명령어
