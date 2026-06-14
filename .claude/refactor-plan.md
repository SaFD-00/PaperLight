# PaperLight 리팩토링 계획 (실행 추적용)

> 조사 문서: [themoonlight 기능](research/themoonlight-features.md) · [Zotero 파싱](research/zotero-parsing.md)
> 브랜치: `refactor/moonlight-clean`

## 목표

themoonlight.io 스타일의 깔끔한 **단일 사용자 로컬 AI 논문 리더 웹앱**. PDF 업로드 → 강력한 본문 파싱 → 번역/요약/하이라이트/노트 + AI 챗/설명/인용 프리뷰. unicorn.studio 스타일 모션 랜딩 + 미니멀 리더.

## 확정 결정

1. **기능**: 핵심 + AI 어시스트. KEEP = PDF 뷰어·본문 파싱·요약·번역·자동 하이라이트·노트/마크업·AI 챗·설명·인용 카드. DROP = 4-pane 라이브러리·Collections/Tags·Scholar Deep Search.
2. **스택**: FastAPI + Next.js + SQLite + 서버측 LLM + 브라우저 pdf.js. 제거 = Qdrant·Redis·R2/MinIO(→로컬 FS)·Sentry/PostHog/Langfuse·Alembic·LangGraph.
3. **입력**: 로컬 PDF 파일 업로드 신설(arXiv 임포트 보조 유지).
4. **디자인**: WebGL/모션 랜딩(랜딩 라우트 dynamic import, reduced-motion 폴백) + 미니멀 리더.
5. **제거**: 팟캐스트(F-13), 로그인/인증(→ 단일 로컬 사용자, `get_user_id`=상수).

## 실행 순서

1. **Phase 0** — 브랜치 + 조사 문서 ✅
2. **Phase 1** — 인증/로그인 제거 (`get_user_id`→`LOCAL_USER_ID` 상수, auth 디렉터리/login UI 삭제)
3. **Phase 2** — 팟캐스트 제거 (api/agent/audio/tts/model/prompt + 프론트 패널/탭)
4. **Phase 3** — 스택 단순화 (Postgres→SQLite, Qdrant→SQLite 임베딩, R2→로컬 FS, 관측도구·Alembic·Redis·LangGraph 제거)
5. **Phase 4** — PDF 업로드 입력 (`POST /api/papers/upload` + 드래그&드롭 UI)
6. **Phase 5** — 기능 정리 (패널 탭, 라이브러리→미니멀 홈, Deep Search/Discover 제거)
7. **Phase 6** — 파싱 강화 (Zotero 폰트 휴리스틱: 저자 밴드·소속 사전·다국어/다줄 캡션 + 회귀 테스트)
8. **Phase 7** — 디자인 (모션 랜딩 + 미니멀 리더)

## 핵심 제약

- 인증 제거: `get_user_id` 상수 반환으로 라우트 시그니처/소유권 필터 보존(8개 라우터).
- Qdrant 제거: `agents/chat.py::retrieve()` **시그니처 유지**, 본문만 SQLite 임베딩 코사인으로 교체(챗·설명·pregen 4개 기능이 의존).
- object store 디스크 영속화 필수(현재 in-memory).
- 파싱: offset 불변식 유지.

## 동작 보존 핵심(변경 금지)

pdf.js Shadow-DOM iframe(`frontend/public/pdfjs/`, `lib/pdf/shadow-iframe.ts`), 본문 추출 `bodyFilter.js`(강화는 하되 인터페이스 보존), 번역 파이프라인.
