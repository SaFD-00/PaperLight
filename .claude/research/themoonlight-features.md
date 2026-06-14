# themoonlight.io 기능 조사

> 조사일: 2026-06-14. 출처: themoonlight.io, docs.themoonlight.io, Chrome Web Store, 검색 결과.
> 목적: PaperLight를 themoonlight.io 스타일의 깔끔한 AI 논문 리더로 리팩토링하기 위한 레퍼런스 정리.

## 1. 제품 정체성

**Moonlight (themoonlight.io)** — "AI Colleague for Research Papers". 학술 논문을 빠르고 쉽게 읽고 이해하도록 돕는 **AI 기반 PDF 리더**.

- **형태**: 웹앱(파일 직접 업로드) + Chrome 확장(온라인/로컬 PDF에 오버레이).
- **입력**: **PDF 업로드**(온라인 PDF 또는 로컬 파일). *요약 텍스트 입력이 아님.*
- **출력**: 번역·요약·설명·Q&A·인용 정보·자동 하이라이트 등 AI 분석을 PDF 위/사이드바에 표시.
- **지표(마케팅)**: 300K+ 활성 사용자, MIT/Stanford/Harvard/Berkeley/Columbia, Google/NVIDIA/Samsung/Alibaba/Huawei 연구자 추천.

**중요**: themoonlight.io에는 **팟캐스트/오디오 기능이 없다.** (PaperLight가 자체 추가한 F-13은 제거 대상.)

## 2. 핵심 기능 10종

| # | 기능 | 설명 |
|---|------|------|
| 1 | **Translation** | 학술 용어를 보존하는 문맥 인지 번역. 모르는 단어/문장 즉시 번역. |
| 2 | **AI Chat** | 논문에 대해 연구 동료처럼 질문. 한계점·내 연구와의 연결 탐색. |
| 3 | **Explanation** | Text Explanation(복잡한 개념·문단 단순화) + Image Explanation(이미지/표/수식 원클릭 설명). |
| 4 | **Citation** | 스마트 인용 카드 — 참고문헌으로 스크롤하지 않고 인용 논문 정보 즉시 확인. |
| 5 | **Summary** | 빠른 3줄 요약 + 상세 방법 요약. 신규성·방법·결과 즉시 하이라이트. |
| 6 | **Preview** | 섹션 프리뷰 + 링크 프리뷰로 길 잃지 않고 탐색. |
| 7 | **Library** | 논문/인사이트를 라이브러리에 정리. |
| 8 | **Scholar Deep Search** | 논문 추천/교차 검색. |
| 9 | **Auto Highlight** | 핵심(신규성·방법·결과)을 자동 식별·하이라이트. |
| 10 | **Markup** | 색상별 하이라이트 + 노트, 사이드바 자동 저장. |

## 3. 사이트/페이지 구조

- **헤더 내비**: Features / Pricing / FAQ / Blog / Explore Literature / (이벤트) / 언어 선택(EN) / **Upload Paper** 버튼.
- **히어로**: 공지 배너("Team Pro Plan for Labs & Teams") + 메인 CTA "Get Started Free".
- **소셜 증거**: 기관 로고, 대학원생·AI 종사자 후기.
- **푸터**: FAQ, 소셜(Medium/GitHub/LinkedIn).
- **요금제**: Free tier + Team Pro(그룹 할인) + 프로모 코드.
- **부가**: `themoonlight.io/en/review/...` 경로의 자동 생성 "Literature Review" 콘텐츠(SEO).

## 4. 리더 UX (문서 + 기능 기반 추론)

PDF를 열면: 좌측 원문 PDF + 우측/오버레이 AI 패널. 텍스트 선택 → 번역/설명/챗/하이라이트 액션. 인용 클릭 → 인용 카드. 하이라이트·노트는 사이드바에 색상별로 누적.

## 5. PaperLight 리팩토링에의 시사점

- **유지(themoonlight 정합)**: PDF 입력, 번역, 요약(3줄+상세), AI 챗, 설명(텍스트+이미지/수식/표), 인용 카드, 자동 하이라이트, 마크업(하이라이트+노트).
- **이번 범위에서 제외(사용자 결정)**: 풀 라이브러리(4-pane)·Collections/Tags, Scholar Deep Search → 미니멀 "내 논문" 홈으로 축소.
- **완전 제거(themoonlight에 없음 + 사용자 요청)**: 팟캐스트, 로그인/요금제(단일 사용자 로컬 앱).
- **입력**: themoonlight과 동일하게 **로컬 PDF 파일 업로드**를 정식 입력으로(현 PaperLight는 arXiv 임포트만 존재 → 업로드 신설).
