# PaperLight — Roadmap

> **버전**: v1.0
> **작성일**: 2026-05-20
> **기준**: [PRD v3.0](./PRD.md) §4, §10
> **목적**: "언제·어떤 순서로" 구현할지 — PRD가 "무엇"에 답한다면 이 문서는 "순서·우선순위"에 답한다.

---

## 1. 마일스톤 요약

| Phase | 기간 | 범위 | 핵심 산출물 | 상태 |
|-------|------|------|------------|------|
| **0** | 4주 | 데모 프로토타입 | Tab Bar + 3-Column Reader + pdf.js Shadow DOM + F-04 Explanation + F-02 Translation | ✅ S6 완료 (T0~T10) — 사용자 브라우저 AC 검증 대기 |
| **1 (MVP)** | 8주 | 100명 베타 | Google OAuth + Library 4-pane + Ingestion 자동 사전 생성 + Chat+Citation | 🚧 S7a ✅ · S7b Auth Stub/Mock 🚧 · S8 arXiv import ✅ · S9 Ingestion ✅ (다음 S10 LLM Abstraction) |
| **2 (GA)** | 12주 | 정식 런칭 | F-13 Podcast (수동) + F-09 Deep Search + F-07 Preview + Export + Observability 안정화 | ⬜ 대기 |
| **3 (확장)** | 12주+ | 확장·모바일 | F-12 Team + Mind Map + Compare + PWA | ⬜ 대기 |

> **Game Gate**: Phase 3에서 DAU ≥ 1,000 AND PWA 사용률 ≥ 35% 충족 시 네이티브 모바일 검토. 그 전까지는 PWA만.

---

## 2. Phase 0 — 데모 프로토타입 (4주)

**목표**: 인증 없이 로컬에서 PDF를 띄우고, 텍스트를 선택해 Qwen 설명을 받고, 번역을 병행 표시하는 데모. 탭 2개 이상 띄울 수 있어야 함.

**원칙**: FE 셸 우선 → mock 데이터로 시작 → BE는 최소 Tab API + Explanation/Translate SSE 프록시만.

### 2.1 Task 체크리스트

| ID | Task | 의존성 | 핵심 파일 | 우선도 | 상태 |
|----|------|--------|-----------|--------|------|
| T0 | 디자인 토큰·폰트·테마 셋업 | — | `frontend/src/styles/tokens.css`, `frontend/src/app/layout.tsx`, `frontend/src/lib/theme.ts` | **P0** | ✅ |
| T1 | Tab Bar 컴포넌트 + Tab 상태 (Zustand) | T0 | `frontend/src/components/shell/TabBar.tsx`, `frontend/src/stores/tabs.ts` | **P0** | ✅ |
| T2 | 3-Column Reader Shell | T0, T1 | `frontend/src/components/reader/ReaderShell.tsx`, `frontend/src/components/reader/{Sidebar,Center,RightPanel}.tsx` | **P0** | ✅ |
| T3 | Top Toolbar (5-토글 placeholder + 페이지 컨트롤) | T0 | `frontend/src/components/shell/TopToolbar.tsx` | **P0** | ✅ |
| T4 | pdf.js Shadow DOM iframe wrapper (F-01) | T2 | `frontend/src/components/reader/PdfViewer.tsx`, `frontend/public/pdfjs/`, `frontend/src/lib/pdf/shadow-iframe.ts` | **P0** | ✅ |
| T5 | Tab API 최소 구현 (단일 사용자, 로컬 SQLite) | — | `backend/paperlight/api/tabs.py`, `backend/paperlight/storage/db.py`, `backend/paperlight/models/tab.py` | **P0** | ✅ |
| T6 | Floating Selection Menu (F-04 트리거) | T4 | `frontend/src/components/reader/FloatingSelectionMenu.tsx`, `frontend/src/stores/reader.ts` | P0 | ✅ |
| T7 | Explanation API + 우측 패널 표시 (F-04) | T6, T5 | `backend/paperlight/api/explain.py`, `backend/paperlight/providers/openrouter_provider.py`, `frontend/src/components/panels/ExplanationPanel.tsx`, `frontend/src/lib/sse.ts` | P0 | ✅ |
| T8 | Translation 병행 패널 (F-02) | T4 | `backend/paperlight/api/translate.py`, `frontend/src/components/panels/TranslationPane.tsx` | P0 | ✅ |
| T9 | Density·Theme 토글 (Settings 시드) | T0 | `frontend/src/stores/settings.ts`, `frontend/src/components/shell/SettingsMenu.tsx` | P1 | ✅ |
| T10 | Library 탭 (빈 셸 + 일러스트 only) | T1 | `frontend/src/components/library/LibraryShell.tsx` | P1 | ✅ |

### 2.2 의존성 그래프

```
T0 ──┬─► T1 ──┬─► T2 ──► T4 ──┬─► T6 ──► T7
     │        │              │
     ├─► T3   └─► T10        └─► T8
     └─► T9

T5 (BE) ── 병렬 진행, T7에서 합류
```

### 2.3 주차별 실행 그룹

| 주차 | 묶음 | 산출물 |
|------|------|--------|
| Week 1 | T0 → T1 → T3 | 셸 골격, 핫 리로드 가능한 데모 |
| Week 2 | T2 → T4 (T5 BE 병행 시작) | PDF 렌더링까지 동작 |
| Week 3 | T6 → T7, T8 | Explanation 풀 루프 + Translation |
| Week 4 | T9 → T10 + Polish | E2E 시나리오 점검, 데모 영상 |

### 2.4 Phase 0 종료 조건 (Acceptance Criteria)

> 시연·E2E 검증은 [fixtures/pilot-papers/](../fixtures/pilot-papers/)에 등록된 파일럿 논문 2편을 고정 입력으로 사용한다.
>
> | # | Slug | Title | arXiv |
> |---|------|-------|-------|
> | 1 | `2602.09856-code2world` | Code2World: A GUI World Model via Renderable Code Generation (Zheng et al., 2026) | [2602.09856](https://arxiv.org/abs/2602.09856) |
> | 2 | `2605.10347-mobile-world-model-gui-agents` | How Mobile World Model Guides GUI Agents? (Xu et al., 2026) | [2605.10347](https://arxiv.org/abs/2605.10347) |
>
> 두 논문 모두 GUI World Model 도메인 — F-09 Deep Search·F-13 Podcast 비교 실험에도 재사용. 추가/변경 절차는 [fixtures README](../fixtures/pilot-papers/README.md) 참조.

1. 빈 라이브러리 탭 + 파일럿 논문 PDF 1편을 새 탭에서 열기 — Phase 0은 [fixtures/pilot-papers/](../fixtures/pilot-papers/)의 고정 fixture 2편만 사용. arXiv URL paste·파일 업로드 경로는 [Phase 1](#3-phase-1--mvp-8주--outline) arXiv import 묶음에서 합류.
2. 파일럿 논문 2편을 동시에 띄우고 ⌘1·⌘2로 전환 (전환 < 80ms, [PRD §8.1](./PRD.md) SLO)
3. PDF에서 텍스트 선택 → Floating Menu → "💡 Explain" → 우측 패널에 Qwen 응답 스트리밍
4. Translation 토글 → 현재 페이지 한국어 번역 병행 표시
5. Density Compact/Cozy/Spacious 전환 — 행 높이·폰트 즉시 반영
6. Light/Dark 테마 전환 + `prefers-reduced-motion` 시 모션 50%로 단축

### 2.5 세션 분할 (기능 의미 단위)

> Phase 0 T0~T10을 한 세션에 다 다루기 어려우므로, **"한 세션 = 한 기능 의미 묶음"**으로 분할.
> 각 세션 시작 시 `/workflow:development "Phase 0 S{n} 시작"` 형태로 진입.

| S# | 묶음 | 포함 Task | 핵심 산출 | 세션 종료 조건 |
|----|------|-----------|-----------|----------------|
| **S1** | FE 셸 골격 | T0 + T1 + T2 + T3 | 디자인 토큰·테마·폰트, Tab Bar(Zustand), 3-Column Reader Shell, Top Toolbar | mock 데이터로 빈 셸 + 탭 추가/전환/닫기 동작 |
| **S2** | pdf.js Viewer | T4 | Shadow DOM iframe wrapper, host↔iframe postMessage 채널 5종 | 파일럿 PDF 1편 렌더 + `JUMP_TO` 동작 |
| **S3** | BE Tab API | T5 | `api/tabs.py`, 로컬 SQLite 어댑터, `models/tab.py` | T1 Zustand ↔ BE 양방향 동기 (last-write-wins) |
| **S4** | Explanation Flow | T6 + T7 | Floating Selection Menu, `api/explain.py`, OpenRouter provider, `ExplanationPanel` SSE | 본문 선택 → 우측 패널에 Qwen 응답 스트리밍 |
| **S5** | Translation | T8 | `api/translate.py`, `TranslationPane` 병행 표시 | 현재 페이지 한국어 병행 ON/OFF |
| **S6** | Polish | T9 + T10 | Density·Theme 토글, Library 빈 셸 일러스트 | [§2.4](#24-phase-0-종료-조건-acceptance-criteria) AC 6개 전부 통과 |

#### 의존성 그래프

```
S1 ──┬──► S2 ──► S4 ──► S6
     │
     ├──► S5
     │
     └──► S3 (S4 합류 지점에서 사용)
```

#### 진행 규칙

1. 각 세션 시작 시 [§2.1](#21-task-체크리스트) 표의 해당 task 행을 ⬜ → 🚧 갱신.
2. 세션 종료(PR 머지) 시 [§2.1](#21-task-체크리스트) ⬜/🚧 → ✅, 그리고 [PRD §18.2](./PRD.md#182-기능별-상태-f-01--f-15) 표 동기 갱신.
3. 한 세션이 30 커밋·1만 line을 초과하면 sub-session(`S2a`/`S2b`)으로 재분할.

---

## 3. Phase 1 — MVP (8주) — outline

**목표**: 100명 베타. 인증·라이브러리·Ingestion 자동 사전 생성·Chat 통합.

### 3.1 주요 작업 묶음

> **부재 API key 제약** (2026-05-20 사용자 확정): COHERE rerank → Phase 1 스킵 (Phase 2 이관) / QDRANT Cloud → docker-compose 로컬 Qdrant / ELEVENLABS → Phase 2 OpenAI tts-1-hd 단독.

| 세션 | 묶음 | 범위 | 관련 F-넘버 / PRD 섹션 | 상태 |
|------|------|------|------------------------|------|
| **S7a** | **Schema** | Postgres 지원 + Alembic + 10 엔티티 ORM + Tab user-scoped | [PRD §8.5](./PRD.md) | ✅ |
| **S7b** | **Auth (Stub/Mock 모드)** | JWT (HS256, access 15m / refresh 30d) + httpOnly Cookie + Refresh Token rotation + reuse detection + `/api/auth/dev/mock-login` + `useAuth` Zustand store + `/login` 페이지. 실 Google OAuth call은 자격 정보 발급 후 별도 PR | [PRD §7.3](./PRD.md) | 🚧 |
| **S8** | **arXiv import + Paper API** | arXiv ID/URL → meta(fixture-first → arXiv Atom fallback) → Paper 생성 + object_store(S3/MinIO 또는 in-process Local) 저장 + BackgroundTask ingest. presigned URL(TTL 10분, PRD §7.3). `/import` 페이지 + `usePapers` store + Library "+ 논문 추가" | F-01 보강 | ✅ |
| **S9** | **Ingestion pipeline** | PyMuPDF 파서(marker는 `INGEST_PARSER=marker` follow-up) → char 청킹(≈512토큰 슬라이딩) → embedder(stub 결정적 dim=1024 기본, fastembed bge-m3 opt-in) → 로컬 Qdrant(`:memory:` fallback) 색인 + Chunk ORM/alembic 0003. ingestion SSE 진행률. rerank는 Phase 2 | [PRD §7.2](./PRD.md) | ✅ |
| **S10** | **LLM Abstraction** | LLMProvider 추상화 (Qwen default + OpenAI vision + Gemini table fallback) + models.yaml 라우팅 | [PRD §7.5](./PRD.md) | ⬜ |
| **S11** | **Auto pre-gen** | Summary (다층) + F-10 Auto-Highlight + F-14 Figure/Table + F-15 Paragraph 자동 + Right Panel 4개 | F-06, F-10, F-14, F-15 | ⬜ |
| **S12** | **Chat + Citation** | F-03 + F-05 — SSE 스트리밍, 인용 점프, 후속 질문 칩 | F-03, F-05 | ⬜ |
| **S13** | **Library 4-pane** | F-08 — Zotero 패턴 (Tree/List/Detail/TagCloud), 무한 트리, 멀티 태그, 3-상태, Bulk | F-08, [PRD §5.6](./PRD.md) | ⬜ |
| **S14** | **Markup** | F-11 — 사용자 하이라이트 + Markdown 노트 + S3 백업 + pdf.js 채널 3개 추가 | F-11 | ⬜ |
| **S15** | **Observability** | Sentry + PostHog + Langfuse 통합 (Phase 1은 트레이스 가시화까지) | [PRD §7.6](./PRD.md) | ⬜ |
| **S16** | **CI + 종료 회귀** | GitHub Actions — frontend lint/test/build + backend pytest + docker-compose smoke + Playwright Phase 1 신규 suite | — | ⬜ |

### 3.2 Phase 1 종료 조건

- KPI 측정 가능: 가입·논문 업로드·읽기 진행률·Chat 호출이 PostHog에 기록
- 100명 베타 유저 초대 가능 (closed beta, OAuth만)
- Ingestion 50p PDF 처리 < 20초 ([PRD §8.1](./PRD.md) SLO)

---

## 4. Phase 2 — GA (12주) — outline

**목표**: 정식 런칭. Podcast가 차별점.

### 4.1 주요 작업 묶음

| 묶음 | 범위 | 관련 F-넘버 |
|------|------|-------------|
| **F-13 Podcast** | 2인 대담 스크립트 (LangGraph) → TTS (OpenAI tts-1-hd default + ElevenLabs fallback) → 챕터·동기 하이라이트 | F-13 |
| **F-09 Deep Search** | 라이브러리 임베딩 평균 → 관심 벡터 → Semantic Scholar/OpenAlex 검색 + 재랭킹 | F-09 |
| **F-07 Preview** | Figure/Table cross-ref 호버 미니 프리뷰 | F-07 |
| **Export** | Notion OAuth, Obsidian `.md`, BibTeX/RIS/EndNote | F-11 보강 |
| **i18n** | en/ja/zh-CN/es 메시지 카탈로그 (ko는 Phase 0~1에 완료) | [PRD §17](./PRD.md) |
| **Observability 안정화** | Prometheus + Grafana 추가, OpenTelemetry distributed trace | [PRD §7.6](./PRD.md) |
| **GDPR ZIP** | `GET /api/export/gdpr-zip` — 사용자 데이터 추출 | [PRD §8.2](./PRD.md) |
| **결제 검토** | Pro/Team/Edu/BYO 티어 검토 — 실제 도입은 v2 결정 | [PRD §9](./PRD.md) |

### 4.2 Phase 2 종료 조건

- F-13 Podcast 생성 < 90초 ([PRD §8.1](./PRD.md) SLO)
- D30 Retention ≥ 35%, Paper-Read/User/Week ≥ 5 ([PRD §3](./PRD.md) KPI)
- 결제 도입 여부 결정 + 가격 정책 v1.0 확정

---

## 5. Phase 3 — 확장·모바일 (12주+) — outline

**목표**: 팀 협업과 모바일 PWA로 사용자 폭 확장.

### 5.1 주요 작업 묶음

| 묶음 | 범위 | 관련 F-넘버 |
|------|------|-------------|
| **F-12 Team** | 공유 라이브러리, 공유 노트, 코멘트, 권한 매트릭스 | F-12 |
| **Mind Map** | 라이브러리 컬렉션을 그래프로 시각화 | — |
| **Compare** | 2~3개 논문 동시 비교 뷰 (SciSpace 영감) | — |
| **Browser Extension** | arXiv/PubMed에서 "PaperLight로 열기" 버튼 | — |
| **PWA** | Reader + Library + Podcast 오프라인 캐시, 모바일 레이아웃 | [PRD §16](./PRD.md) |
| **Native gate** | DAU ≥ 1,000 + PWA 사용률 ≥ 35% 달성 시 iOS/Android 네이티브 검토 | — |

### 5.2 Phase 3 종료 조건

- 동시 탭 평균 ≥ 2.5 ([PRD §3](./PRD.md) KPI)
- PWA 사용률 결정에 충분한 데이터 수집
- 네이티브 결정 (Go/No-go)

---

## 6. 진행 추적 규칙

1. **Phase 0 task 상태**는 이 ROADMAP §2.1 표에서 ⬜ → 🚧 → ✅ 로 갱신 (PR 머지 시점에 함께).
2. **F-넘버별 상태**는 [PRD §18 구현 현황](./PRD.md#18-구현-현황-implementation-status)에서 관리.
3. **Phase 1~3 디테일**은 해당 Phase 진입 직전에 `/workflow:development`로 새 PLAN을 생성하고, 결정사항을 본 문서에 반영.
4. **마일스톤 변경**은 [PRD §10](./PRD.md)과 본 §1 표를 동시에 갱신.

---

## 7. 관련 문서

- [PRD.md](./PRD.md) — 무엇을 만드는가
- [DESIGN.md](./DESIGN.md) — 어떻게 보이는가
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 어떻게 짜여있는가
