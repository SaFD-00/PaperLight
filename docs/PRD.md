# PRD: AI 논문 리더 (가칭: PaperLight)

> **버전:** v3.0
> **작성일:** 2026-05-19
> **상태:** Draft
> **레퍼런스:** [Moonlight](https://www.themoonlight.io/ko), [NotebookLM Audio Overview](https://notebooklm.google/), [Zotero](https://www.zotero.org/), [SciSpace](https://typeset.io/)
> **디자인 분리 문서:** [`docs/DESIGN.md`](DESIGN.md) (스크린샷 인덱스, 와이어프레임, 디자인 토큰)

---

## 0. 변경사항 (Changelog)

### v3.1
1. **§7.5 default 모델 교체** — `openrouter/qwen/qwen3.6-35b-a3b` → **Gemini API `gemini-3.1-flash-lite`** (qwen이 primary였던 task 전부). vision/podcast 특수 task(figure=gpt-5, table=gemini-2.5-pro, podcast=gpt-5)와 fallback 체인은 유지.

### v3.0 (Major)
1. **§0.5 Workspace 모델** 신설 — Zotero식 **상단 탭바**(Library 탭 + 논문 탭) 도입. 사용자가 폴더 뷰와 PDF 뷰를 탭으로 자유 전환.
2. **§5.6 Library View (Zotero 4-pane)** 신설 — 좌 컬렉션 트리 / 메인 리스트 / 우 디테일 / 하단 태그 패널 + Bulk 작업·키보드 네비.
3. **§5.5 Floating Selection Menu** 신설 — Moonlight 패턴, 텍스트 선택 200ms 후 등장.
4. **§5.7 Tonal Variant** 신설 — Compact / Cozy / Spacious 3단 행 높이·타이포 (Zotero 데스크탑 톤 옵션).
5. **§5.3 Top Toolbar** — 5개 토글(오토 하이라이트 / 이미지 설명 / 단락 설명 / Quick Skim / 자동 번역)의 단축키·시각 상태·Off 동작 명세.
6. **§5.4 Right AI Panel** — Moonlight 인터랙션 세부(키워드 칩 점프, 펄스 하이라이트, 후속 질문 자동 전환, 스트리밍 인디케이터).
7. **§7.0 인증** 신설 — Google OAuth 단일, OIDC, httpOnly Cookie + Refresh Token rotation.
8. **§7.5 default 모델** — `openrouter / qwen/qwen3.6-35b-a3b` ⭐ 실험·실행 기본. Task별 Qwen 우선 + GPT-5/Gemini/Claude fallback.
9. **§7.8 PDF Engine** 신설 — Mozilla pdf.js + KaTeX + Shadow DOM iframe 격리 (Moonlight 기술 구조).
10. **§7.9 Observability** 신설 — Sentry + PostHog + Langfuse + Prometheus/Grafana + OpenTelemetry.
11. **§7.10 Deployment** 신설 — Vercel(FE) + Render·Railway(BE) + Supabase(DB) + Cloudflare R2 + asia-northeast2 우선.
12. **§7.11 Data Lifecycle** 신설 — 30일 grace + 소프트 삭제 + GDPR Article 20 export.
13. **§8.5 데이터 모델** 신설 — User / Paper / Collection / Tag / LibraryItem / Tab / Note / Highlight / Podcast / Cache.
14. **§15 키보드 단축키 차트** 신설 — 패널·탭·F-15·Cmd Palette·토글·본문 네비.
15. **§16 PWA & 모바일** 신설 — Phase 3 PWA, DAU 1k 게이트 후 네이티브 결정.
16. **§17 i18n 리소스** 신설 — `next-intl`, `frontend/src/locales/`.
17. **§9 결제** — v1 보류(Free 전용), Phase 2 말 또는 v2로 연동 이관.
18. **§10 마일스톤** — 절대 날짜 제거, 주(週) 수만 유지.
19. **§14 결정사항** — 기존 Open Questions 5개 모두 결정 처리.
20. **DESIGN.md 분리** — 디자인 토큰·와이어프레임·스크린샷 인덱스를 별도 문서로.

### v2.3
1. **F-15. Paragraph-level Description** 신설.
2. **3단 설명 계층**: Macro(§F-06) / Meso(§F-14) / Micro(§F-15).
3. **Top Toolbar에 `📝 단락 설명` 토글 + Quick Skim Mode**.
4. **우측 패널 `📝 Paragraph Insights` 탭** 신설.

### v2.2 / v2.1 / v2.0
(생략 — Git history 참고)

---

## 0.5 Workspace 모델 (Tabbed Interface) ⭐ v3.0 신설

> **핵심**: PaperLight는 단일 단방향 뷰가 아니라 **탭드 워크스페이스**다. 사용자는 컬렉션을 둘러보다가 논문을 새 탭에 열고, 여러 논문을 동시에 비교·이동·청취하면서 작업한다. (Zotero 패턴)

### 0.5.1 탭 구조
- **첫 탭 = Library (고정)**: 아이콘 📚, 라벨 "내 라이브러리", **닫기 ✕ 없음**.
- **추가 탭 = 개별 논문**: 제목 (최대 28자 ellipsis), 닫기 ✕, 우클릭 컨텍스트 메뉴.

### 0.5.2 탭 동작
| 동작 | 설명 |
| --- | --- |
| 새 탭 열기 | Library 리스트에서 논문 **더블클릭** → 새 탭 + 자동 전환 |
| 백그라운드 탭 | **Cmd + 클릭** → 새 탭 생성하되 현재 탭 유지 |
| 닫기 | 탭 ✕ 클릭 또는 `⌘W` |
| 최근 닫은 탭 복원 | `⌘⇧T` (마지막 5개까지 복원 가능) |
| 탭 전환 | `⌘⇧←` / `⌘⇧→` 또는 `⌘1`~`⌘9` |
| 탭 고정 (Pin) | 우클릭 → "Pin Tab" (✕ 사라지고 작은 도트로 표시) |
| 탭 순서 변경 | 드래그 (Library 탭은 항상 맨 왼쪽 고정) |
| 컨텍스트 메뉴 | 닫기 / 다른 탭 닫기 / 오른쪽 모두 닫기 / Pin / Unpin / 새 창에서 열기 |

### 0.5.3 동시 열림 정책
- **최대 10개** (Library + 논문 9). 11번째 열림 시 가장 오래된 **비고정** 탭이 자동 정리 (LRU).
- 정리된 탭은 "최근 닫은 탭" 큐에 추가 → `⌘⇧T`로 복원 가능.

### 0.5.4 상태 저장
- 사용자 단위 서버 동기화 (Postgres `tabs` 테이블).
- 디바이스 간 별도 (Mobile은 Library 단일 탭 강제).
- 페이지 새로고침 시 직전 탭 셋 + 마지막 활성 탭 복원.

### 0.5.5 시각 명세
```
┌─────────────────────────────────────────────────────────────────┐
│ 📚 내 라이브러리 │ How Mobile World... ✕ │ AlphaFold 3 ✕ │ + │ ← 36px 탭바
├─────────────────────────────────────────────────────────────────┤
│  Top Toolbar (56px)                                              │
├─────────────────────────────────────────────────────────────────┤
│  Tab content (Library view OR Reader view)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 개요

### 1.1 한 줄 설명
"PDF 뷰어 안에서 모든 AI 기능이 끝나는" 논문 읽기 도구. 보고, 듣고, 정리하고, 발견한다.

### 1.2 핵심 가치 제안
- **No Re-upload**: 한 번 열면 끝.
- **Context-aware**: 논문 전체를 인지한 답변.
- **In-place**: 화면을 떠나지 않음.
- **Multi-modal**: 읽기 + **듣기(Podcast)** + 시각화.
- **Tabbed Workflow** ⭐: 여러 논문을 동시에 탭으로 비교·이동.

### 1.3 비전
> 논문을 여는 순간, 가장 잘 아는 동료가 옆에 앉아 함께 읽어주고, 출퇴근 길에는 그 논문을 라디오처럼 들려주는 도구.

---

## 2. 타겟 사용자

| 페르소나 | 상황 | 핵심 Pain | PaperLight 해결 |
| --- | --- | --- | --- |
| **예비 대학원생 (Alice)** | 영어 논문 입문 | 어디부터 봐야 할지 모름 | 맥락 번역 + Summary + Podcast |
| **재학 대학원생 (Bob)** | 매주 5~10편 정독 | 시간 부족 | Summary + Auto Highlight + Podcast + Tabbed 비교 |
| **AI 실무자 (Charlie)** | arXiv 신착 추적 | 옥석 가리기 어려움 | Podcast(출퇴근) + Deep Search + Quick Skim |
| **연구실 PI (Dr. Kim)** | 팀 지식 자산 관리 | 노트 분산 | Team Library + 공유 Podcast |

---

## 3. 성공 지표

### 3.1 북극성 지표
- **D30 Retention ≥ 35%**
- **Paper-Read-Per-User-Per-Week ≥ 5편**
- **유료 전환율 (MAU) ≥ 7%** (결제 연동 시점부터)
- **Podcast 청취 완료율 ≥ 60%** (10분 이상)
- **동시 열림 탭 평균 ≥ 2.5** ⭐ v3.0 신설 — 탭드 워크플로 채택도

### 3.2 기능별 KPI
| 기능 | KPI | 목표 (3개월) |
| --- | --- | --- |
| Explanation | 텍스트 선택 후 사용률 | ≥ 40% |
| AI Chat | 세션당 메시지 | ≥ 6 |
| Summary | 자동 열람률 | ≥ 60% |
| **AI Podcast** | **생성 → 청취율** | **≥ 45%** |
| Auto Highlight | 채택률 | ≥ 30% |
| Deep Search | 추천 클릭 | ≥ 15% |
| **Library 4-pane** | 컬렉션/태그 사용률 | ≥ 50% |

### 3.3 기술 SLO
- 첫 페이지 렌더링 < 2초
- AI 첫 토큰 < 1.5초
- PDF 파싱 (50p) < 20초
- **Podcast 생성 (10분 분량) < 90초**
- **탭 전환 < 80ms** ⭐ v3.0 신설

---

## 4. 기능 요구사항

> 형식: **F-XX. 이름** — 설명 / 트리거 / 입출력 / 우선순위(P0/P1/P2)

### F-01. PDF 뷰어 (P0)
- **엔진**: Mozilla pdf.js + KaTeX (수식). 자세한 기술 구조는 §7.8.
- **격리**: Shadow DOM iframe 옵션 — 호스트 페이지 CSS/JS 누수 차단 (Moonlight 패턴).
- arXiv ID / URL / 파일 업로드 모두 지원.
- 텍스트 선택 시 **Floating Selection Menu** (§5.5).
- 기본 페이지 모드: **연속 스크롤 + 100%** (단일/듀얼은 토글).
- 다크 모드, 핀치 줌, 페이지 점프 (`g g`, `G`).
- **스크린샷 모드**: 도표 영역을 직접 드래그하여 Explanation 요청.

### F-02. Translation (P0) — 페이지별 병행 컬럼
- **각 PDF 페이지 오른쪽에 그 페이지 번역을 나란히** (PDF 연속 스크롤 안의 컬럼, 스크롤·줌 자동 동기화).
- **본문만 번역**: Figure 캡션·표·수식·페이지번호 등 비본문을 보수적으로 제거(노이즈 제거).
- 맥락 기반 (분야별 용어 사전 적용 §5.12).
- 토글: 자동 번역 ON/OFF(상단 [T]), 언어 선택. 글꼴(산세리프/세리프)·리더 글꼴 크기 조절(설정).
- 원문↔번역 문장 양방향 교차 하이라이트(hover).
- 👍/👎 피드백 — 모델 학습 시그널.

### F-03. AI Chat (P0)
- 우측 패널, 스트리밍, 인용 표시.
- 응답의 인용 클릭 → 본문 점프 + 0.5초 펄스 하이라이트.
- **퀵 질문 칩**: "이 논문의 핵심이 뭐야?", "기존 연구랑 뭐가 달라?", "한계점이 뭐야?".
- 후속 질문 추천 3개 자동 생성 + 클릭 시 Chat 탭으로 자동 전환.

### F-04. Explanation (P0)
- **수식 / 정의 / 약어** 선택 시 즉시 풀이 (Figure/Table은 **F-14**로 위임).
- 수식: 변수표 + 직관 해석 + LaTeX 원문.
- 정의/약어: 정의 + 원어 + 예시 + 본문 첫 등장 위치.
- 본문 근거 인용 필수 (페이지 / 섹션).

### F-05. Citation (P0)
- 본문 인용 마커 호버 → 카드 (제목/저자/연도/abstract).
- 클릭 → 전체 카드 + "열기" 버튼 (새 탭으로 외부 논문 열기).
- Crossref / Semantic Scholar / arXiv API 사용.

### F-06. Summary — 다층 (P0)
- **TL;DR** (1문장)
- **3-Point Summary** (Problem / Method / Result) — Moonlight "3줄 요약"
- **Section-by-Section**
- **Contribution List**
- **Keyword Dictionary** (자동 추출 핵심 용어 사전) — Moonlight "키워드 사전"
- **자동 사전 생성**: Ingestion 시 즉시 (§7.2).

### F-07. Preview (P1)
- 본문의 `Figure 3`, `Table 2` cross-ref 호버 → 미니 프리뷰.

### F-08. Library — Zotero 4-pane (P0)
> **§5.6 Library View와 동일** — UI 명세는 그쪽 참조.

- 좌 250px 컬렉션 트리 / 중앙 가변 리스트 / 우 320px 디테일 / 하단 120px 태그 패널.
- **무한 깊이 컬렉션 트리** + **멀티 태그** + **3-상태** (To Read / Reading / Read).
- 특수 폴더: Recently Read / Starred / Unread / Trash.
- BibTeX, RIS, EndNote 가져오기/내보내기.
- 검색 (제목 / 저자 / 본문 / 노트 / 태그).
- **Bulk 작업**: 다중 선택 후 우클릭 → 태그 일괄·상태 변경·컬렉션 이동.

### F-09. Scholar Deep Search (P1)
- 라이브러리 임베딩 평균 → 사용자 관심 벡터.
- Semantic Scholar / OpenAlex 검색 + 재랭킹.
- "왜 추천됐는지" 설명.

### F-10. Auto Highlight (P1, 자동 생성은 P0)
- 카테고리별 색상: Contribution(노랑) / Method(파랑) / Result(초록) / Limitation(빨강).
- 강도 조절 (Sparse / Medium / Dense).
- **Ingestion 시 자동 생성** (Default ON, 단축키 `A`로 토글).

### F-11. Markup (P1)
- 사용자 하이라이트 + 노트 (Markdown).
- 노트 안에서 AI Chat 호출 (`/ai` 슬래시 커맨드).
- 저장: Postgres + S3 백업 (Markdown 원본).
- Export: Markdown / Notion(OAuth) / Obsidian(.md 다운로드) / BibTeX.

### F-12. Team / 협업 (P2)
- 공유 라이브러리, 공유 노트, 코멘트.

### F-13. **AI Podcast (P0)**
> NotebookLM Audio Overview처럼 논문을 2인 대담 한국어/영어 팟캐스트로 변환.

#### 13.1~13.6 (v2.0 정의 유지)
- 호스트 페르소나, 옵션, 생성 파이프라인, UI, 비용 통제는 v2.0 그대로.
- **수동 생성** — Ingestion 시 자동 생성 X (비용 컨트롤).
- **재생 중 PDF 본문 동기 하이라이트** ← 차별 포인트.

### F-14. **Figure / Table Description (P0)**
> v2.2 정의 유지. Ingestion 시 자동 생성. 단축키 `G`로 토글.
> **인라인 비전 설명 (v3.1)**: 본문 번역은 Figure/Table을 제외하고(본문만), Figure/Table은 각각 **개별적으로** 설명을 본다. 리더가 도표 위 "설명" 버튼을 띄우고, 클릭 시 해당 영역을 crop한 이미지 + 캡션/본문 텍스트를 비전 모델(figure→gpt-5, table→gemini-2.5-pro)에 함께 보내 `POST /api/explain/figure`로 스트리밍 설명(그림/표 분석 팝오버). on-demand + 캐시.
> **후속 채팅 (v3.2)**: 첫 설명 후 후속 질문 칩 + 미니 채팅으로 이어서 묻는다(매 턴 이미지 재첨부, history 누적, 종료 시 후속 질문 3개 자동 생성).
> **정밀 bbox + pregen 비전 (v3.2)**: 도표 영역은 `config/ingestion.yaml`의 `parser: marker`면 marker-pdf 정밀 bbox(`GET /api/papers/{id}/figures`), 기본 `pymupdf`면 캡션 앵커 휴리스틱(과잉 crop 허용)으로 폴백. marker bbox가 있으면 pregen 사전생성도 영역을 렌더해 **비전**으로 figure/table을 미리 설명(없으면 텍스트 reasoning 폴백).

### F-15. **Paragraph-level Description (P0)**
> v2.3 정의 유지. Ingestion 시 자동 생성. 단축키 `P` (토글) / `H` (Inline Hint) / `I` (Importance Highlight) / `K` (Quick Skim).

---

## 5. UI/UX 디자인

> **상세 디자인 토큰·와이어프레임은 [`docs/DESIGN.md`](DESIGN.md)** 참조. 본 섹션은 정책·요구사항.

### 5.1 디자인 원칙
1. **친숙함 (Familiarity)** — PDF 뷰어 사용자가 학습 곡선 없이 적응 (Moonlight 톤).
2. **밀집 정보 (Density)** — Zotero식 데스크탑 정보 밀집 패턴, 토글로 조절(§5.7 Tonal Variant).
3. **흐름 보존 (Flow Preservation)** — 본문 시선을 빼앗지 않음. 팝오버 우선, 모달 최소화.
4. **온보딩 친화** — 빈 상태에서도 무엇을 할지 명확.

### 5.2 전체 레이아웃 (Tabbed + 3-Column Collapsible)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tab Bar (36px)  [📚 Library][How Mobile World... ✕][AlphaFold 3 ✕][+]    │
├─────────────────────────────────────────────────────────────────────────┤
│ Top Toolbar (56px)                                                       │
│ [◀TOC] [Thumbs] [🔍]  [페이지 1/45] [- 100% +]                             │
│        [A][G][P][K][T]  [🌐ko ▾] [⌘K] [⋯] [👤] [▶]                       │
├────────────┬────────────────────────────────────┬───────────────────────┤
│ ② Left     │   ③ Center (PDF + Translation)    │   ④ Right AI Panel    │
│  Sidebar   │  ┌──────────────────┬───────────┐  │ [📖📝🎧💬🔖⭐]          │
│ - TOC      │  │   PDF 페이지       │ 번역 컬럼  │  │  Tab content          │
│ - Thumbs   │  │   (각 페이지 옆)   │ (페이지별) │  │                       │
│ (180px)    │  └──────────────────┴───────────┘  │  (380px)              │
└────────────┴────────────────────────────────────┴───────────────────────┘
```

**총 헤더**: 92px (탭바 36px + 툴바 56px). **비율**: Left 12% / Center 58% / Right 30%.
**Both Open이 default** (§5.2.1).

#### 5.2.1 패널 접기/펴기 (Collapsible Panels)
| 상태 | 단축키 | 설명 |
| --- | --- | --- |
| Both Open (default) | — | 좌·우 모두 펼침 |
| Left Collapsed | `[` | 좌측 hide |
| Right Collapsed | `]` | 우측 48px Icon-Rail 유지 |
| Focus Mode | `\` | 양쪽 다 접음 |

- 접힘 폭 전환: 250ms `cubic-bezier(0.4, 0, 0.2, 1)`.
- 디바이스 간 별도 저장. 모바일 PWA = Focus Mode default.
- 키보드 입력 중(`textarea` focus) 단축키 비활성화.

### 5.3 Top Toolbar — 토글 5종 세부 명세 ⭐ v3.0 강화

| 토글 | 단축키 | 기능 | ON 시각 | OFF 동작 |
| --- | --- | --- | --- | --- |
| 오토 하이라이트 | `A` | F-10 카테고리 색상 표시 | brand-primary 배경 | 하이라이트 숨김, 캐시 유지 |
| 이미지 설명 (F-14) | `G` | 모든 도표에 💡 배지 + hover popover | brand-primary 배경 | 배지 숨김, 클릭 시 popover만 |
| 단락 설명 (F-15) | `P` | 모든 단락에 💡 배지 | brand-primary 배경 | 배지 숨김 |
| Quick Skim (F-15) | `K` | 본문이 1줄 요점으로 임시 대체 | warning-soft 배경 | 원문 복원 |
| 자동 번역 | `T` | F-02 페이지별 번역 컬럼 | brand-primary 배경 | 컬럼 숨김, 캐시 유지 |

- 모든 토글의 상태는 **사용자 단위 + 논문별 override** 가능.
- OFF 시 캐시는 유지하여 재토글 시 즉시 복원 (LLM 재호출 X).
- 좌측: 사이드바 토글 `[` / 썸네일 모드 / 🔍 검색.
- 중앙: 페이지 인디케이터 (입력 가능 `3/45`) + 줌.
- 우측: 🌐 언어 셀렉터 (Content Language §5.11) / `⌘K` Cmd Palette / ⋯ (설정: 테마·Density·**번역 글꼴·리더 글꼴 크기**) / 아바타 / `]` 우측 패널 토글.

### 5.4 Right AI Panel ⭐ v3.0 디테일 강화

#### 5.4.1 상단 탭 (6개 아이콘 Rail)
- 라벨 없이 아이콘만 노출 → 각 아이콘 호버 시 한 문장 기능 설명 tooltip (`aria-label` + `title`).
- 📖 **Summary** — TL;DR / 3줄 / Section / 키워드 / Figures & Tables 인덱스
- 📝 **Paragraph Insights** — F-15 모드 4종 + Critical 필터
- 🎧 **Podcast** — 생성 / 플레이어
- 💬 **Chat** — 토론 (스트리밍)
- 🔖 **Notes** — 내 노트 / 하이라이트 / Markdown 에디터
- ⭐ **Related** — 추천 논문 / 인용 네트워크

#### 5.4.2 Summary 탭 인터랙션 (Moonlight 패턴 정확 명세)
- **키워드 사전 칩**:
  - 칩 클릭 → 본문에서 해당 용어 첫 등장 위치로 점프
  - 점프 직후 0.5초 펄스 하이라이트 (yellow soft → fade out)
  - 호버 시 한국어 설명 tooltip
- **3줄 요약 카드**:
  - 각 줄에 §참조 페이지 뱃지 (`p.3`, `§2.1`)
  - 뱃지 클릭 → 본문 점프 + 펄스
- **후속 질문 추천 3개**:
  - 칩 클릭 → 자동으로 Chat 탭으로 전환 + 질문 자동 입력 + 전송

#### 5.4.3 Chat 탭 — 입력창 명세
- `무엇이든 질문하세요...` placeholder
- 하단 옵션: `[+ Add Reference]` (다른 논문 첨부) / `[Qwen3.6-35B ▾]` (모델 선택, default = OpenRouter Qwen)
- 스트리밍 중 우측 패널 헤더에 점멸 인디케이터 (●)
- 우측 패널이 접힌 상태에서 응답 도착 → Icon-Rail 해당 탭에 알림 도트

#### 5.4.4 Podcast 탭
> v2.0 정의 유지 — 옵션 카드 + 플레이어 + 챕터 점프.

#### 5.4.5 Paragraph Insights 탭
> v2.3 §15.11 정의 유지.

### 5.5 Floating Selection Menu ⭐ v3.0 신설 (Moonlight 패턴)

**트리거**: 본문에서 텍스트 선택 후 **200ms hover** (선택 직후가 아닌 짧은 정지 후 — accidental selection 방지).

**액션 5종**:
| 아이콘 | 액션 | 동작 |
| --- | --- | --- |
| 💡 | Explain | F-04 풀이 popover |
| 🌐 | Translate | 선택 텍스트만 즉시 번역 popover |
| 💬 | Ask | Chat 탭으로 전환 + 선택 컨텍스트 자동 첨부 |
| 🖍 | Highlight | 사용자 하이라이트 (색상 선택 미니 팔레트) |
| 📋 | Copy | 클립보드 복사 |

**위치 알고리즘**:
- Anchor = 선택 영역의 중앙 상단 8px 위.
- 뷰포트 가장자리 회피: 위쪽 공간 부족 시 아래로 flip, 우측 끝 → 좌측 align.
- 스크롤 시 메뉴 따라 이동 (sticky to selection).
- 선택 해제 또는 ESC → fade out.

**다국어 라벨**: UI Language (§5.11) 따름.

### 5.6 Library View — Zotero 4-pane ⭐ v3.0 신설

> **F-08 Library의 구체 명세.** Library 탭(첫 탭) 활성 시 본 뷰가 렌더링.

#### 5.6.1 4-pane 레이아웃
```
┌──────────┬─────────────────────────────────────────┬─────────────┐
│ ①Collec  │ ② Main List (정렬 가능 컬럼)               │ ③ Detail    │
│  Tree    │ ┌──┬──────────┬──────┬────┬────┬────┐  │  Panel      │
│ (250px)  │ │  │제목       │저자  │연도│상태│태그│  │ (320px)     │
│          │ ├──┼──────────┼──────┼────┼────┼────┤  │             │
│ My Lib   │ │  │Mobile WM │Doe   │2026│📖  │AI  │  │ Title       │
│ ├ Recent │ │  │AlphaFold │Smith │2024│✅  │Bio │  │ Authors     │
│ ├ Starred│ │  │...       │      │    │    │    │  │ Venue       │
│ ├ Unread │ │  │          │      │    │    │    │  │ arXiv ID    │
│ ├ Trash  │ │  │          │      │    │    │    │  │ ...         │
│ │        │ │  │          │      │    │    │    │  │ Notes (3)   │
│ ▼ GUI    │ │  │          │      │    │    │    │  │ Highlights  │
│  ├ Mobi  │ │  │          │      │    │    │    │  │ (12)        │
│  └ Web   │ │  │          │      │    │    │    │  │             │
│ ▼ LLM    │ │  │          │      │    │    │    │  │             │
├──────────┴─┴──┴──────────┴──────┴────┴────┴────┘──┴─────────────┤
│ ④ Tag Cloud (120px)                                              │
│  [AI ×12] [Mobile ×7] [GUI Agents ×5] [RLHF ×4] [Diffusion ×3]…  │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.6.2 ① Collection Tree (좌 250px)
- **무한 깊이** 트리. 드래그&드롭으로 재계층.
- 우클릭 메뉴: 새 컬렉션 / 새 하위 컬렉션 / 이름 변경 / 색상 / 삭제(Trash로).
- 컬렉션 아이콘: 폴더 (기본) / 별 (Starred) / 시계 (Recently Read) / 휴지통 (Trash).
- 우측 카운트 뱃지: 컬렉션 내 논문 수.
- 활성 컬렉션 = brand-primary-soft 배경.
- 단축키: `↑/↓` 트리 이동, `→` 펼침, `←` 접음, `Enter` 활성화.

#### 5.6.3 ② Main List (중앙 가변)
- 컬럼: ☑ / 제목 / 저자 / 연도 / 추가일 / 상태 / 태그 / 진행률 (사용자가 컬럼 토글 가능).
- **정렬**: 컬럼 헤더 클릭. 사용자 단위 저장.
- **상태 아이콘**: 📖 To Read / 👀 Reading / ✅ Read.
- **진행률 막대**: 0~100% (스크롤 위치 추적, F-15 Critical 단락 읽음 비율 가중 평균).
- **키보드 네비**:
  - `↑/↓` 항목 이동
  - `Enter` 새 탭으로 열기
  - `Space` Quick Look popover (디테일 + 첫 페이지 썸네일)
  - `Delete` Trash로 이동
  - `⌘A` 전체 선택, `⌘클릭` 다중 선택
- **Bulk 작업** (다중 선택 후 우클릭):
  - 태그 일괄 추가 / 제거
  - 상태 변경
  - 컬렉션 이동
  - Export (BibTeX / RIS)
  - 삭제 (Trash)

#### 5.6.4 ③ Detail Panel (우 320px)
| 필드 | 표시 |
| --- | --- |
| Title | 큰 폰트 (16px) + 줄바꿈 |
| Authors | 쉼표 구분, 4명 초과 시 "+N more" |
| Venue / Journal | 학회/저널 + 연도 |
| arXiv ID / DOI | 클릭 시 외부 링크 |
| URL | 원본 URL |
| Date Added | 상대시간 ("3일 전") + hover 절대시간 |
| Date Modified | 마지막 수정 |
| Tags | 칩 컬렉션, ✕로 제거, + 버튼으로 추가 |
| Notes count | 클릭 시 Notes 탭으로 |
| Highlights count | 클릭 시 본문 + 하이라이트 모드로 |
| Progress | 진행률 % + 마지막 읽은 페이지 |

#### 5.6.5 ④ Tag Cloud (하 120px)
- 라이브러리 전체 태그를 사용 빈도 폰트 크기로 표시 (max 5 단계).
- 태그 클릭 → 메인 리스트 필터 적용 (다중 태그 = AND).
- 필터 활성 시 상단 칩 stack 표시 + ✕로 개별 해제.

#### 5.6.6 검색
- 상단 검색 바 (Top Toolbar의 🔍 또는 `⌘F`).
- 범위 토글: 제목 / 저자 / 본문 / 노트 / 태그.
- 즉시 결과 (debounce 150ms).

### 5.7 Tonal Variant ⭐ v3.0 신설 (Zotero 영감)

| 톤 | 행 높이 | 폰트 | 패딩 | 사용처 |
| --- | --- | --- | --- | --- |
| **Compact** | 28px | 13px | 4px | Zotero식 정보 밀집. 대량 라이브러리 관리. |
| **Cozy (default)** | 40px | 14px | 8px | 일반 사용. 친숙한 톤. |
| **Spacious** | 56px | 15px | 12px | 큰 모니터 / 접근성 우선. |

- 설정: Settings → Appearance → Density.
- Library 4-pane과 Reader 모두 동일 톤 적용.
- 모바일 PWA = Cozy 고정 (터치 친화).

### 5.8 디자인 시스템

> **상세 토큰은 [`docs/DESIGN.md`](DESIGN.md) §3 참조.**

- **테마**: Light default. Settings → Appearance → "Auto (OS) / Light / Dark".
- **색상**: §DESIGN.md §3.1 — brand primary, surface, text, highlight categories, dark mode 전체 정의.
- **타이포**: 한글 Pretendard / 영문 Inter / mono JetBrains Mono.
- **모서리**: card 12px, button 8px, input 10px.
- **아이콘**: Lucide Icons (stroke 1.5px).

### 5.9 친숙성 디테일 (v2.0 유지)
1. 빈 상태 일러스트
2. 온보딩 코치마크 (Skip 가능, 5단계: Tabbed UI → 텍스트 선택 → Right Panel → Library → Settings)
3. 친근한 에러 메시지
4. AI 응답 👍/👎 피드백
5. 게이미피케이션 (정독러 100 배지)

### 5.10 추천 추가 기능 12개 (v2.0 유지)
| # | 기능 | 우선순위 |
| --- | --- | --- |
| 1 | AI Podcast ⭐ | P0 (F-13) |
| 2 | Mind Map | P1 |
| 3 | Flashcard 생성 | P1 |
| 4 | Code Lab | P2 |
| 5 | 비교 모드 (Compare) | P1 — Tabbed UI와 시너지 |
| 6 | 인용 네트워크 | P2 |
| 7 | Voice Q&A | P2 |
| 8 | 브라우저 익스텐션 | P1 |
| 9 | Reading Progress | P2 |
| 10 | Reproducibility 체크 | P2 |
| 11 | Daily Digest | P1 |
| 12 | Focus Mode | P2 |

### 5.11 콘텐츠 언어 설정 (구 §5.7)

> v2.1 정의 유지. 3-Layer 분리 (UI / Content / Translation Target).

| 레이어 | 기본값 |
| --- | --- |
| UI Language | `ko` |
| Content Language ⭐ | `ko` |
| Translation Target | Content Language 따름 |

지원 언어: `ko` / `en` / `ja` / `zh-CN` / `es`.
우선순위: **Per-Paper > User Default > System Default (ko)**.

### 5.12 전문 용어 보존 (구 §5.8)

> v2.1 정의 유지. Glossary YAML + 프롬프트 가이드라인.

```
❌ Bad : "이 논문은 변환기 구조와 주의 메커니즘을 사용하여..."
✅ Good: "이 논문은 Transformer 구조와 Attention 메커니즘을 사용하여..."
```

글로서리: `config/glossary/_core.yaml` + 도메인별 + `user_custom.yaml`.

---

## 6. 사용자 플로우

### 6.1 핵심 동선: 논문 1편 정독
```
업로드 → (BG: 파싱+임베딩+Summary+Auto-Highlight+F-14+F-15 자동 사전 생성)
  → Library에서 더블클릭 → 새 탭에서 열림
  → Summary 탭 자동 펼침 (TL;DR 먼저 노출)
  → 사용자가 본문 정독 시작
      ├ 수식 클릭 → Explanation 팝오버
      ├ 텍스트 선택 → Floating Selection Menu (200ms)
      ├ 인용 [12] 호버 → 참고문헌 카드
      ├ 도표 클릭 → F-14 popover
      └ 단락 호버 → F-15 한 줄 요점 tooltip
  → 추천 논문 (Related 탭) → Cmd+클릭 → 백그라운드 탭에 추가
```

### 6.2 청취 동선: 출퇴근 Podcast
```
Library에서 어제 추가한 5편 선택 → 우클릭 → "Generate Podcast (Standard)"
  → 큐 모드로 5편 연속 재생
  → 흥미로운 부분 [Save] → "오늘 밤 정독 리스트" 자동 추가
```

### 6.3 스크리닝 동선: 10편 30분 안에
```
arXiv ID 일괄 입력 → 모두 백그라운드 파싱 + Summary + 1분 Short Podcast
  → TL;DR + 1분 Podcast 듣고 정독할 1~2편 선별
  → 나머지는 Archive
```

### 6.4 Critical 단락만 정독 (F-15 활용)
```
선별된 1편 → 단축키 P (단락 설명) + I (Importance Highlight)
  → Critical 단락만 노란 배경
  → 30분 정독 → 10분으로
```

### 6.5 Quick Skim — 5분 훑기
```
새 논문 → 단축키 K → 본문이 한 줄 요점으로 임시 대체
  → 5분 안에 흐름 파악
```

### 6.6 Tabbed 비교 동선 ⭐ v3.0 신설
```
Library에서 논문 2~3편 선택 → 우클릭 → "Open in Tabs"
  → 모두 새 탭으로 열림
  → ⌘⇧← / → 로 탭 전환하며 비교
  → 한 논문에서 발견한 인용 → Cmd+클릭 → 새 탭에 추가
```

---

## 7. 기술 아키텍처

### 7.0 인증 & 계정 ⭐ v3.0 신설

#### 7.0.1 인증 방식
- **Google OAuth 2.0 / OIDC** 단일 (v1).
- Apple / GitHub / Email OTP는 v2 이후 검토.

#### 7.0.2 세션
- **httpOnly Cookie** (`__Host-paperlight_session`, SameSite=Lax, Secure).
- Access Token JWT (15분) + Refresh Token (30일, rotation).
- 디바이스별 세션 관리 (Settings → Sessions → 개별 로그아웃).

#### 7.0.3 사용자 데이터
- 이메일 / 프로필 사진 / 이름 (Google에서 받음).
- 닉네임 (사용자가 변경 가능).
- 가입 즉시 default Collection ("My Library") + 특수 폴더 4개 생성.

### 7.1 High-Level
```
[Next.js Client (Vercel, Seoul edge)]
     │  (SSE / WebSocket)
     ▼
[FastAPI Gateway (Render/Railway, Tokyo)]
   ├─ /api/auth/*       (Google OAuth)
   ├─ /api/tabs/*       ⭐ v3.0 — 탭 상태 동기화
   ├─ /api/library/*    (Collections / Tags / LibraryItems)
   ├─ /api/papers/*
   ├─ /api/chat/*       (SSE)
   ├─ /api/podcast/*    (SSE + 오디오)
   ├─ /api/notes/*      (Markdown + S3 백업)
   └─ /api/export/*     (Notion OAuth / BibTeX / GDPR ZIP)
     │
     ▼
┌──────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Ingestion    │ Agent Orchestr.  │ Podcast Worker   │ Library Svc.     │
│ Worker       │ (LangGraph)      │ (Celery)         │ (CRUD)           │
└──────────────┴──────────────────┴──────────────────┴──────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Storage: Supabase Postgres / Qdrant Cloud / Cloudflare R2 /  │
│          Redis Cloud                                          │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Observability: Sentry / PostHog / Langfuse / OTel→Grafana    │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ External: OpenRouter(Qwen default) / OpenAI / Gemini /        │
│           ElevenLabs / Crossref / Semantic Scholar / arXiv    │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Ingestion 파이프라인
1. **파싱**: PyMuPDF + marker-pdf (수식 = marker-pdf만, MathPix 미사용).
2. **메타데이터**: GROBID 또는 LLM 추출.
3. **참고문헌 보강**: Crossref / Semantic Scholar.
4. **청킹**: 섹션 단위 + 슬라이딩 윈도우 (512 토큰).
5. **임베딩**: `text-embedding-3-large` (OpenAI) → Qdrant. DAU 5k 이후 self-host `bge-m3` 검토.
6. **자동 사전 생성** ⭐: Summary + Auto-Highlight + F-14 (figure_description, table_description) + F-15 (paragraph_description, paragraph_importance) + **References(F-05)** 추출·보강. **번역(F-02)·설명(F-04)은 임의 선택/페이지 의존이라 pregen 제외 — on-demand + 응답 캐시. Podcast도 수동.**

### 7.3 Agent 설계 (LangGraph)
> v2.0 정의 유지. Retriever, Reranker, Critique, Citation, Podcast Graph.

### 7.4 백엔드 디렉토리 구조
> v2.3 §7.4 정의 유지. `paperlight/api/tabs.py` 추가.

### 7.5 설정 시스템: `config/` YAML + `.env` 분리

> v2.1 §7.5 정의 유지. **default 모델 교체.**

#### 7.5.1~7.5.3 (디자인 철학·디렉토리·`.env`)
v2.1 정의 유지.

#### 7.5.4 `config/models.yaml` ⭐ default = Gemini API `gemini-3.1-flash-lite`
```yaml
version: "2026.05.19"

# 실험·실행 기본 모델 (Gemini API gemini-3.1-flash-lite)
default:
  provider: gemini
  model: gemini-3.1-flash-lite

tasks:
  summary:
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: openai, model: gpt-5 }
      - { provider: gemini, model: gemini-2.5-pro }

  chat:
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: gemini, model: gemini-2.5-pro }
      - { provider: openrouter, model: anthropic/claude-sonnet-4.6 }

  explanation:
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: openai, model: gpt-5 }

  translation:
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: gemini, model: gemini-2.5-flash }
      - { provider: openai, model: gpt-5-mini }

  figure_description:        # F-14 — Vision 필요, Qwen은 텍스트 reasoning fallback
    provider: openai
    model: gpt-5
    fallback:
      - { provider: gemini, model: gemini-2.5-pro }
      - { provider: openrouter, model: qwen/qwen3.6-35b-a3b }   # vision 미지원, 텍스트 보강용

  table_description:
    provider: gemini
    model: gemini-2.5-pro
    fallback:
      - { provider: openai, model: gpt-5 }
      - { provider: openrouter, model: qwen/qwen3.6-35b-a3b }

  paragraph_description:     # F-15 batch
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: gemini, model: gemini-2.5-flash }

  paragraph_importance:
    provider: gemini
    model: gemini-3.1-flash-lite
    fallback:
      - { provider: gemini, model: gemini-2.5-flash-lite }

  podcast_outline:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: qwen/qwen3.6-35b-a3b }

  podcast_script:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: qwen/qwen3.6-35b-a3b }

  podcast_critique:
    provider: gemini
    model: gemini-2.5-pro

  critique:
    provider: gemini
    model: gemini-3.1-flash-lite

  classifier:
    provider: gemini
    model: gemini-3.1-flash-lite

  highlight:
    provider: gemini
    model: gemini-3.1-flash-lite

  domain_classifier:
    provider: gemini
    model: gemini-3.1-flash-lite

embedding:
  provider: openai
  model: text-embedding-3-large
  fallback:
    - { provider: local, model: bge-m3 }   # DAU 5k 이후 self-host

reranker:
  provider: local
  model: bge-reranker-v2-m3
  fallback:
    - { provider: cohere, model: rerank-multilingual-v3.0 }

tts:
  default_provider: openai
  providers:
    openai:
      model: tts-1-hd
      voice_a: alloy
      voice_b: echo
    elevenlabs:                # 한국어 품질 부족 시 fallback
      voice_a_id_env: ELEVENLABS_VOICE_A_ID
      voice_b_id_env: ELEVENLABS_VOICE_B_ID
      model: eleven_multilingual_v2
```

#### 7.5.5~7.5.12 (hyperparameters / providers / prompts / loader / hot-reload)
v2.3 정의 유지. `providers.yaml`에 `openrouter` rate limit / `qwen` 헤더 추가.

### 7.6 데이터 모델 (Podcast)
> v2.0 정의 유지. 전체 데이터 모델은 §8.5 참조.

### 7.7 API 명세
> v2.0 정의 + 다음 추가:
- `GET /api/tabs` — 사용자 탭 셋
- `POST /api/tabs` — 탭 열기 (paper_id)
- `DELETE /api/tabs/{tab_id}` — 탭 닫기
- `POST /api/tabs/reorder` — 순서 변경
- `POST /api/tabs/{tab_id}/pin` / `unpin`

### 7.8 PDF Engine ⭐ v3.0 신설

#### 7.8.1 라이브러리
- **Mozilla pdf.js** (latest stable, MIT) — 텍스트 추출, 셀렉션, 페이지 렌더.
- **KaTeX** — 수식 렌더링 (pdf.js가 추출한 LaTeX 원문을 클라이언트에서 렌더).
- **marker-pdf** (server-side) — 레이아웃 분석, 도표 BBox, 단락 ID.

#### 7.8.2 클라이언트 격리: Shadow DOM iframe
> **Moonlight 패턴 차용** (`Moonlight.txt` 분석 — `<template shadowrootmode="open">` 내부 iframe).

```html
<div data-component="PdfHost">
  <template shadowrootmode="open">
    <iframe src="/pdf-viewer.html?paperId=..." allow="clipboard-write" />
  </template>
</div>
```

**이점**:
- 호스트 페이지 CSS/JS 누수 차단 (pdf.js의 글로벌 스타일이 우리 UI를 깨지 않음).
- pdf.js 업데이트가 React 트리에 영향 없음.

**Annotation 레이어**:
- iframe 외부(호스트 페이지)에서 React Portal로 띄움.
- `postMessage`로 iframe ↔ host 통신 (selection / scroll / page).

#### 7.8.3 페이지 모드 default
- 연속 스크롤 (default) + 100% 줌.
- 단일 / 듀얼은 Top Toolbar에서 토글.

### 7.9 Observability ⭐ v3.0 신설

| 스택 | 용도 | 도입 시점 |
| --- | --- | --- |
| **Sentry** | Web + Server 에러 트래킹, source map | Phase 0 |
| **PostHog** | 행동 분석, feature flag, funnel | Phase 0 |
| **Langfuse** | LLM trace (prompt / response / 비용 / latency) | Phase 0 |
| **Prometheus + Grafana** | FastAPI / Postgres / Redis / Qdrant 메트릭 | Phase 2 |
| **OpenTelemetry** | 표준 trace 수집 (vendor-neutral) | Phase 2 |

**Trace 키**: `user_id`, `paper_id`, `tab_id`, `task` (LLM task name), `request_id`.

### 7.10 Deployment & Region ⭐ v3.0 신설

| 컴포넌트 | 서비스 | 리전 |
| --- | --- | --- |
| Frontend | **Vercel** | Seoul edge (Cloudflare 보강) |
| Backend (API) | **Render** or Railway | **Tokyo (ap-northeast-1)** |
| Database | **Supabase Postgres** | **Seoul (ap-northeast-2)** |
| Auth | Supabase Auth (Google OAuth 위임) | Seoul |
| Vector DB | **Qdrant Cloud** | ap-northeast-1 |
| Object storage | **Cloudflare R2** (S3 호환) | Auto-routing |
| Cache / Queue | Redis Cloud | ap-northeast-1 |
| TTS 출력 | Cloudflare R2 + Cloudflare Stream | Auto |

**리전 우선순위**: Seoul (ap-northeast-2) → Tokyo (ap-northeast-1) → Singapore (ap-southeast-1).

**CI/CD**: GitHub Actions → Vercel(FE 자동) / Render(BE 자동) / Supabase Migration (PR 머지 시).

### 7.11 Data Lifecycle ⭐ v3.0 신설

#### 7.11.1 계정 삭제
1. 사용자가 Settings → "계정 삭제" 클릭.
2. 30일 grace 안내 + 비밀번호(또는 Google 재인증) 확인.
3. **즉시 로그아웃** + `user.soft_deleted_at = now()` + 모든 세션 무효화.
4. 30일 이내 재로그인 → 복구 가능.
5. 30일 경과 → 백그라운드 job이 hard delete:
   - PDFs (R2), 노트 (Postgres + S3), 하이라이트, Podcasts (R2), 캐시 (Redis + DB)
   - User row → 익명화 stub (회원 수 통계 유지용, PII 모두 제거)

#### 7.11.2 데이터 Export (GDPR Article 20)
- Settings → "내 데이터 내보내기" → 메일로 ZIP 링크 (24h 유효).
- ZIP 내용: PDFs / `notes.md` 합본 / `library.bib` / `highlights.json` / `podcasts/*.mp3`.

#### 7.11.3 Cache 만료
| 종류 | TTL |
| --- | --- |
| LLM 응답 (Chat 등) | 30일 |
| Summary / F-14 / F-15 / Auto-Highlight | 영구 (논문 불변) |
| Podcast (동일 옵션) | 영구 |
| Translation | 30일 |
| Embedding | 영구 |

---

## 8. 비기능 요구사항

### 8.1 성능
- TTFT p95 < 1.5초
- 동시 사용자 1,000명
- Podcast 10분 생성 < 90초 (병렬 TTS)
- PDF 50p < 20초
- **탭 전환 < 80ms** ⭐
- **Library 1만 논문 렌더 < 500ms** (가상화 리스트)

### 8.2 보안 / 프라이버시
- PDF AES-256 암호화 저장 (R2 SSE-C)
- Presigned URL 5분 만료
- "데이터 학습 비활성" 프로바이더만 (OpenAI org 설정 / Anthropic API / OpenRouter `X-Title` 명시)
- 사용자 API 키 BYO 옵션 (Pro 이상)
- httpOnly Cookie + SameSite=Lax + CSRF 토큰

### 8.3 안정성
- 외부 API retry + circuit breaker
- LLM 실패 시 자동 fallback (§7.5)
- 99.5% uptime
- Postgres point-in-time recovery (Supabase 기본)
- R2 versioning

### 8.4 비용 통제
- LLM 응답 캐시 (해시 키)
- Summary / F-14 / F-15 / Podcast 영구 캐시
- **Qwen3.6-35B default**로 토큰당 비용 ~1/10 (vs GPT-5)
- 사용자별 일일 토큰 한도 (v2 결제 연동 후)
- 사용량 대시보드 (Langfuse + 관리자 페이지)

### 8.5 데이터 모델 ⭐ v3.0 신설

```
User
  id (uuid, PK)
  email (unique)
  name, avatar_url
  google_sub (OIDC)
  default_content_language ('ko')
  density ('compact' | 'cozy' | 'spacious')
  theme ('auto' | 'light' | 'dark')
  soft_deleted_at (nullable)
  created_at, updated_at

Paper
  id (uuid, PK)
  user_id (FK User)
  title, authors[], year
  venue, arxiv_id, doi, url
  pdf_r2_key
  status ('to_read' | 'reading' | 'read')
  progress_pct
  date_added, last_opened_at
  meta_jsonb              -- abstract, keywords, etc.
  ingestion_status ('pending'|'parsing'|'embedding'|'ready'|'failed')

Collection
  id (uuid, PK)
  user_id (FK User)
  parent_id (nullable, self-FK)   -- 무한 깊이 트리
  name, color, icon
  position (int)                  -- 형제 간 정렬
  is_special ('recently_read'|'starred'|'unread'|'trash' | null)

LibraryItem                       -- Paper ↔ Collection (다대다)
  paper_id (FK Paper)
  collection_id (FK Collection)
  date_added
  PK (paper_id, collection_id)

Tag
  id (uuid, PK)
  user_id (FK User)
  name, color
  UNIQUE (user_id, name)

PaperTag
  paper_id (FK Paper)
  tag_id (FK Tag)
  PK (paper_id, tag_id)

Tab
  id (uuid, PK)
  user_id (FK User)
  paper_id (FK Paper, nullable)   -- null = Library 탭
  position (int)
  pinned (bool)
  is_library (bool)               -- 첫 탭 식별
  opened_at, last_active_at

Note
  id (uuid, PK)
  user_id (FK User)
  paper_id (FK Paper)
  markdown_text
  s3_backup_key
  created_at, updated_at

Highlight
  id (uuid, PK)
  user_id (FK User)
  paper_id (FK Paper)
  page (int)
  bbox jsonb
  text
  category ('contribution'|'method'|'result'|'limitation'|'user_custom')
  color
  note (nullable)
  source ('user'|'auto')
  created_at

Podcast
  id (uuid, PK)
  paper_id (FK Paper)
  user_id (FK User)
  options jsonb                   -- language, length, level, focus, voices
  status ('pending'|'scripting'|'synthesizing'|'done'|'failed')
  duration_sec
  script_md
  chapters jsonb
  audio_r2_key
  srt_r2_key
  cost_usd
  created_at

Cache
  key (text, PK)                  -- hash(task + inputs)
  task (text)
  paper_id (FK, nullable)
  response_jsonb
  cost_usd
  hit_count
  expires_at (nullable)
  created_at

ChatSession                       -- S12: 논문별 대화 스레드 (user당 1 get-or-create)
  id (uuid, PK)
  paper_id (FK Paper)
  user_id (FK User)
  created_at, updated_at

ChatMessage                       -- S12: 대화 메시지 (멀티턴 컨텍스트 + 히스토리)
  id (uuid, PK)
  session_id (FK ChatSession)
  role ('user'|'assistant')
  content (text)
  citations jsonb (nullable)      -- [{chunkId, page}] — 답변 근거 chunk (페이지 점프용)
  created_at
```

---

## 9. 가격 정책 (v1 보류)

> **v1은 Free 전용.** 가격 시안은 유지하되 실제 결제 연동은 **Phase 2 말 또는 v2**로 이관.

| 플랜 (시안) | 가격 | 일일 AI 호출 | 월 Podcast | 비고 |
| --- | --- | --- | --- | --- |
| Free (v1 현재) | $0 | 무제한 | **무제한 (베타)** | 베타 기간 모든 기능 무료 |
| Pro (v2 이후) | $12/월 | 무제한 | 30개 | 개인 |
| Team (v2 이후) | $9/인/월 (5인+) | 무제한 | 무제한 | 공유 라이브러리 |
| Edu (v2 이후) | $6/월 | 무제한 | 30개 | 학생 인증 |
| BYO (v2 이후) | -$3/월 할인 | 본인 키 | 본인 키 | API 키 직접 제공 |

**결제 연동 시 PG**: 추후 결정 (후보: Stripe / Toss).

---

## 10. 마일스톤 (절대 날짜 제거 — 주 수만)

### Phase 0: 프로토타입 (4주)
- 탭드 워크스페이스 (Library 탭 + 논문 탭)
- PDF 뷰어 (pdf.js + Shadow DOM)
- F-04 Explanation + F-02 Translation (단일 LLM = Qwen3.6)
- **목표**: 데모 가능

### Phase 1: MVP (8주)
- Google OAuth + Supabase 연동
- Library 4-pane (Zotero 패턴) + 컬렉션 + 태그 + 상태
- Ingestion 파이프라인 (자동 사전 생성: Summary / Auto-Highlight / F-14 / F-15)
- Chat Graph + Citation
- LLM Provider Abstraction (§7.5, Qwen default)
- arXiv import
- **목표**: 100명 베타

### Phase 2: 정식 런칭 (12주)
- AI Podcast (F-13) — 수동 생성
- Scholar Deep Search
- Notion / Obsidian Export
- Observability 풀스택 (Sentry / PostHog / Langfuse 안정화)
- **결제 연동 (v2로 이관 가능)**
- **목표**: 정식 GA

### Phase 3: 확장 (12주+)
- Team / 공유 라이브러리
- Mind Map / Compare 모드
- 브라우저 익스텐션
- **PWA** (Reader + Podcast + Library)
- 모바일 네이티브는 DAU 1k + PWA 사용률 ≥ 35% 게이트 후 결정

---

## 11. 범위 외 (v1)
- 논문 작성 어시스턴트
- 실시간 동시 편집
- 모바일 네이티브 (Phase 3 PWA만)
- TTS 외 영상 생성
- **결제 (v2)**

---

## 12. 리스크 & 완화

| 리스크 | 영향 | 가능성 | 완화 |
| --- | --- | --- | --- |
| LLM 비용 폭증 (특히 Podcast) | 높음 | 중 | 캐시 / Qwen default / BYO / 사용량 한도 |
| Podcast 환각 | 높음 | 중 | Critic Agent / 본문 인용 강제 / 피드백 루프 |
| TTS 한국어 부자연 | 중 | 중 | OpenAI default → 부족 시 ElevenLabs 폴백 |
| PDF 파싱 실패 (수식/스캔본) | 중 | 높음 | marker-pdf 보강 / 부분 기능 / MathPix 미사용 |
| 저작권 | 높음 | 낮음 | 본인 업로드만 / Podcast 공유 금지 |
| 경쟁사 (Moonlight, SciSpace, NotebookLM, Zotero) | 중 | 높음 | Podcast + 한국어 + 멀티 프로바이더 + Tabbed Library + F-15 단락 통찰 |
| **Qwen3.6 한국어 학술 문체 부족 가능성** ⭐ | 중 | 중 | task별 fallback (GPT-5/Gemini) + 베타 사용자 피드백 A/B |
| **Shadow DOM iframe ↔ React 이벤트 전파** ⭐ | 중 | 중 | postMessage + React Portal로 annotation 레이어 분리 |

---

## 13. 차별화 포인트 (vs 경쟁)

| 항목 | Moonlight | NotebookLM | SciSpace | Zotero | **PaperLight** |
| --- | --- | --- | --- | --- | --- |
| 논문 특화 PDF 뷰어 | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Tabbed 워크스페이스** | ❌ | ❌ | ❌ | ✅ | **✅ (강화: Library + Reader 통합 탭)** |
| 맥락 번역 | ✅ | ❌ | △ | ❌ | ✅ |
| **2인 대담 Podcast** | ❌ | ✅ | ❌ | ❌ | **✅** |
| **Podcast ↔ 본문 동기 하이라이트** | ❌ | ❌ | ❌ | ❌ | **✅ (유일)** |
| Critique Agent (환각 차단) | 불명 | ❌ | ❌ | — | **✅** |
| **Figure/Table 구조화 설명** | △ | ❌ | △ | ❌ | **✅ (Type Classifier + 캐시 + 다국어)** |
| **단락별 한 줄 요점 + 중요도 분류** | △ | ❌ | △ | ❌ | **✅** |
| **Quick Skim Mode** | ❌ | ❌ | ❌ | ❌ | **✅ (유일)** |
| **단락 ↔ 단락 ↔ Figure 연결 그래프** | ❌ | ❌ | ❌ | ❌ | **✅ (유일)** |
| **Library 4-pane (컬렉션 트리 + 태그 + 상태)** | △ | ❌ | △ | ✅ | **✅ (Zotero 패턴 + AI 통합)** |
| 멀티 LLM Provider | ❌ | ❌ | ❌ | ❌ | **✅ (`config/yaml`로 자유 선택, Qwen default)** |
| BYO API Key | ❌ | ❌ | ❌ | ❌ | **✅** |
| 한국어 UI / 한국어 Podcast | ✅ / ❌ | △ / △ | ❌ | ❌ | **✅ / ✅** |
| Notion / Obsidian Export | △ | △ | △ | △ | **✅ (Native OAuth)** |

---

## 14. 결정사항 (구 Open Questions — v3.0에서 모두 해소)

| # | 항목 | 결정 |
| --- | --- | --- |
| 1 | TTS 한국어 자연성 | **OpenAI tts-1-hd default.** 사용자 피드백에서 한국어 부자연 보고가 임계점 넘으면 ElevenLabs로 자동 전환. |
| 2 | Podcast 화자 일관성 | **두 보이스 모두 다른 보이스 사용** (alloy + echo). 동일 모델 내 톤 차이는 충분치 않다고 결정. |
| 3 | Self-hosted vs API 임베딩 | **API (OpenAI) default. DAU 5,000 돌파 후 self-host (`bge-m3`) 마이그레이션 검토.** |
| 4 | 저작권 | **본인 업로드만 허용. Podcast 외부 공유 금지.** v1 정책. |
| 5 | 수식 인식 | **MathPix 미도입. marker-pdf만 사용.** 정확도 부족 시 사용자 알림 + 부분 기능 제공. |

---

## 15. 키보드 단축키 차트 ⭐ v3.0 신설

| 카테고리 | 키 | 동작 |
| --- | --- | --- |
| **패널** | `[` | 좌측 사이드바 토글 |
| | `]` | 우측 AI 패널 토글 (48px Icon-Rail) |
| | `\` | Focus Mode (양쪽 접기) |
| **탭** | `⌘W` | 현재 탭 닫기 |
| | `⌘⇧T` | 최근 닫은 탭 복원 (최대 5개) |
| | `⌘⇧←` / `⌘⇧→` | 이전 / 다음 탭 |
| | `⌘1`~`⌘9` | N번째 탭 |
| **F-15 모드** | `H` | Inline Hint (단락 옆 💡 배지) |
| | `I` | Importance Highlight (중요도 색상) |
| | `K` | Quick Skim (한 줄 요점으로 임시 대체) |
| **Cmd Palette** | `⌘K` | 모든 명령 / 검색 / 점프 (VSCode 패턴) |
| **Top Toolbar 토글** | `A` | 오토 하이라이트 |
| | `G` | 이미지 설명 (F-14) |
| | `P` | 단락 설명 (F-15 배지) |
| | `T` | 자동 번역 (F-02) |
| **본문 네비** | `←` / `→` | 이전 / 다음 페이지 |
| | `Space` | 한 페이지 아래 |
| | `Home` / `End` | 첫 / 마지막 페이지 |
| | `g g` / `G` | 첫 페이지 / 마지막 페이지 (vim 영감) |
| **Library** | `⌘F` | 검색 |
| | `Enter` | 선택 논문을 새 탭에서 열기 |
| | `Space` | Quick Look popover |
| | `Delete` | Trash로 이동 |
| **글로벌** | `?` | 단축키 도움말 모달 |

- 키 입력 중 (`textarea` / `input` focus) 단축키 비활성화.
- 모든 단축키는 Settings → Keybindings에서 재정의 가능.

---

## 16. PWA & 모바일 ⭐ v3.0 신설

### 16.1 Phase별 범위
| Phase | 모바일 범위 |
| --- | --- |
| 0~2 | **데스크탑 Web만** |
| 3 | **PWA**: 설치 가능 / 오프라인 캐시 / Push 알림 |
| 게이트 후 | **네이티브 (iOS Swift + Android Kotlin Compose)** — DAU 1,000 + PWA 사용률 ≥ 35% |

### 16.2 PWA 기능 셋
- ✅ Reader (읽기 / Floating Selection Menu)
- ✅ Podcast (재생 / 큐 / 다운로드)
- ✅ Library 뷰 (검색 / 필터 / Open in tabs)
- △ 노트 작성 (지원하지만 데스크탑 우선)
- ❌ 태그 / 컬렉션 관리 (데스크탑에서)
- ❌ 4-pane Library (Mobile은 단일 List + bottom sheet detail)

### 16.3 모바일 UI
- Tabbed → 모바일은 **드로어** (햄버거 → 최근 논문 리스트).
- 패널 = Focus Mode default. 우측 패널 = bottom sheet swipe up.
- Cozy density 고정.

---

## 17. i18n 리소스 ⭐ v3.0 신설

### 17.1 라이브러리
- **`next-intl`** (Next.js 15 App Router 호환).
- 메시지 파일: `frontend/src/locales/{ko,en,ja,zh-CN,es}.json`.

### 17.2 분리 원칙
- **UI Language**: `next-intl` 리소스.
- **Content Language** (AI 출력): LLM 프롬프트 system 메시지 placeholder (§5.11).
- 두 언어가 다를 수 있음 (UI=ko, Content=en).

### 17.3 번역 워크플로
1. 한국어 원본을 PM이 작성 (`ko.json`).
2. 다른 언어는 Qwen3.6-35B 사전 번역 (`bin/translate-locales.ts`).
3. 인간 검수 (네이티브 스피커) — PR로 반영.
4. 누락된 키는 fallback (`ko`).

---

## 18. 구현 현황 (Implementation Status) ⭐ v3.0 신설

> **마지막 갱신**: 2026-05-20 (Phase 1 S15 Observability 완료)
> **참조**: [ROADMAP.md](./ROADMAP.md) — Phase별 task 분해
> **현재 마일스톤**: → **Phase 1** — S7a ✅ · S7b 🚧 (Auth Stub/Mock) · S8 ✅ · S9 ✅ · S10 ✅ · S11 ✅ (Auto pre-gen) · S12 ✅ (Chat+Citation) · S13 ✅ (Library 4-pane) · S14 ✅ (Markup) · S15 ✅ (Observability) · 다음 **S16 CI**

### 18.1 Phase 진척도

| Phase | 상태 | 메모 |
|-------|------|------|
| Phase 0 (4주) | ✅ 완료 | S1~S6 (T0~T10) 완료, Playwright E2E 8/8 PASS (chromium) — [ROADMAP §2](./ROADMAP.md) |
| Phase 1 (8주) | 🚧 진행 | S7a ✅ · S7b 🚧 (Auth Stub/Mock) · S8 ✅ (arXiv import) · S9 ✅ (Ingestion: PyMuPDF→chunk→embed→Qdrant) · S10 ✅ (LLM Abstraction: models.yaml 라우팅 + fallback + 응답 캐시) · S11 ✅ (Auto pre-gen: summary/highlight/F-14/F-15 → 영구 캐시 + Right Panel Summary·Insights 탭) · S12 ✅ (Chat+Citation: RAG SSE 채팅 + 대화 영속화 + 인용 페이지 점프 + References 패널) · S13 ✅ (Library 4-pane: `/api/library` 컬렉션 트리·태그·상태·Bulk·본문 검색·BibTeX/RIS/EndNote import-export + FE 4-pane) · S14 ✅ (Markup: `/api/annotations` 하이라이트 CRUD·노트 upsert+S3 백업·Markdown/Obsidian export + pdf.js overlay 채널 3개 + Floating Menu 5액션 + NotesPanel /ai) · S15 ✅ (Observability: Sentry FE+BE 에러 + Langfuse `stream_task` LLM 트레이스 + PostHog FE 큐레이션 이벤트, 전부 env 게이팅·키 부재 시 no-op). 다음 S16 CI. [ROADMAP §3](./ROADMAP.md) |
| Phase 2 (12주) | ⬜ 대기 | Outline만 — [ROADMAP §4](./ROADMAP.md) |
| Phase 3 (12주+) | ⬜ 대기 | Outline만 — [ROADMAP §5](./ROADMAP.md) |

### 18.2 기능별 상태 (F-01 ~ F-15)

> 범례: ⬜ Not started · 🚧 In progress · ✅ Done

| F# | 이름 | Phase | 상태 | 비고 |
|----|------|-------|------|------|
| F-01 | PDF 뷰어 (pdf.js + Shadow DOM) | 0 | ✅ (Phase 0 범위) | S2 — pdf.js 4.10 + Shadow DOM iframe + 7-채널 postMessage (LOAD/JUMP/ZOOM/HIGHLIGHT/TOGGLE_TRANSLATION/REQUEST_PAGE_TEXT/PAGE_TEXT). Phase 1에서 arXiv import 합류 시 보강. |
| F-02 | Translation (페이지별 컬럼) | 0 | ✅ (Phase 0 범위) | S5 — `/api/translate` SSE(aligned) + TopToolbar [T] 토글. **각 페이지 옆 번역 컬럼**(viewer.js `.page-row`, lazy 스트리밍·페이지별 캐시), **본문만 파싱**(bodyFilter.js: Figure/표/수식/페이지번호 제거, offset 보존 segments), iframe 내부 양방향 교차 하이라이트, **글꼴(세리프/산세리프)·리더 글꼴 크기** 설정(persist). |
| F-03 | AI Chat | 1 | ✅ | S12 — `POST /api/chat` RAG SSE(`agents/chat.py` 질문 임베딩→Qdrant 검색→grounded 답변) + `{citations}`/`{followups}` 이벤트 + 대화 영속화(`ChatSession`/`ChatMessage`)·멀티턴 + `GET /api/chat/{id}` 히스토리 + ChatPanel(정적 퀵칩 + 후속칩 + 인용 칩→페이지 점프). 응답 캐시 `chat-v1` TTL 30일 |
| F-04 | Explanation | 0 | ✅ (Phase 0 범위) | S4 — Floating Menu + `/api/explain` OpenRouter SSE relay + ExplanationPanel 스트리밍. + `/api/explain/figure`(F-14 인라인 비전 설명, crop 이미지+텍스트). |
| F-05 | Citation | 1 | ✅ | S12 — `GET /api/papers/{id}/references`(`agents/references.py` 본문 참고문헌 추출 + Crossref/arXiv enrich, `REFERENCE_PROVIDER=stub` 기본 오프라인 + Cache memo) + References 패널 카드(제목/저자/연도 + 외부 열기). 본문 [12] in-PDF 마커 오버레이·bbox 펄스는 marker-pdf 후속 |
| F-06 | Summary (다층) | 1 | ⬜ | Ingestion 자동 |
| F-07 | Preview | 2 | ⬜ | Phase 2 |
| F-08 | Library (4-pane) | 1 | ✅ | S13 — Zotero 패턴 4-pane(①CollectionTree 무한 깊이·특수폴더 / ②PaperList 정렬·멀티선택·Bulk / ③DetailPanel 메타·태그·상태 / ④TagCloud AND 필터) + `/api/library`(컬렉션 CRUD·태그 get-or-create·상태/별표/휴지통·Bulk·검색(제목/저자/태그/**본문**)·BibTeX/RIS/EndNote import-export). 신규 마이그레이션 0(기존 0001 모델 재사용). drag&drop·우클릭은 보류(버튼·드롭다운) |
| F-09 | Scholar Deep Search | 2 | ⬜ | Phase 2 |
| F-10 | Auto Highlight | 1 | ⬜ | Ingestion 자동 |
| F-11 | Markup (노트+하이라이트) | 1 | ✅ | Phase 1 (S14) — Notion OAuth export 보류 |
| F-12 | Team / 협업 | 3 | ⬜ | Phase 3 |
| F-13 | AI Podcast ⭐ | 2 | ⬜ | Phase 2 — 차별 포인트 |
| F-14 | Figure/Table Description | 1 | 🚧 | Ingestion 자동(pregen 텍스트 reasoning) + **인라인 비전 설명**: 리더가 캡션 감지→도표 crop 이미지+텍스트를 비전 모델로 `/api/explain/figure` 스트리밍(그림/표 분석 팝오버). 프로바이더 멀티모달 content(`providers/content.py`). 정밀 bbox는 marker-pdf 후속 |
| F-15 | Paragraph-level Description | 1 | ⬜ | Ingestion 자동 |

### 18.3 인프라·플랫폼 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 모노레포 디렉토리 트리 | ✅ | backend/ + frontend/ + config/ + docs/ |
| 백엔드 FastAPI 스캐폴드 | ✅ | api/ 5개 라우터 stub |
| 프론트엔드 Next.js 15 스캐폴드 | ✅ | components/ 비어있음 |
| Docker Compose (PG·Qdrant·Redis·MinIO) | ✅ | 로컬 실행 가능 |
| 디자인 토큰 CSS | ✅ | S1 T0 — `frontend/src/styles/tokens.css` + Tailwind v4 `@theme inline` 매핑 |
| Pretendard·Inter 폰트 셋업 | ✅ | S1 T0 — `next/font/local` (Pretendard variable) + `next/font/google` (Inter, JBMono) |
| pdf.js 정적 자산 (`public/pdfjs/`) | ✅ | S2 T4 — `scripts/copy-pdfjs.mjs` postinstall로 viewer/worker 복사 |
| Alembic DB 마이그레이션 | ✅ | S7a — 10 엔티티 + Tab (`0001_phase1_init.py`). S7b — `sessions` (`0002_session.py`). S9 — `chunks` (`0003_chunks.py`). S12 — `chat_sessions`+`chat_messages` (`0004_chat.py`) |
| Auth (Google OAuth + JWT + Cookie) | 🚧 | S7b stub/mock 모드 — `python-jose` HS256 + httpOnly cookie (access 15m / refresh 30d, `Path=/api/auth/refresh`) + refresh rotation + reuse detection + `/api/auth/dev/mock-login`. 실 Google OAuth call은 자격 정보 발급 후 별도 PR |
| arXiv import + Paper API (S8) | ✅ | `/api/papers` import/list/detail/pdf-url/ingestion(SSE). fixture-first meta(→arXiv Atom fallback) + object_store(S3/MinIO 또는 in-process Local) + presigned URL(TTL 10분) + BackgroundTask ingest. FE `/import` + `usePapers` |
| Ingestion pipeline (S9) | ✅ | PyMuPDF 파서 → char 청킹(≈512토큰) → embedder(`stub` 결정적 dim=1024 기본 / `fastembed` bge-m3 opt-in) → Qdrant(`:memory:` fallback) 색인 + Chunk ORM. marker 파서·rerank·auto pre-gen(S11)은 후속 |
| Object store (R2/MinIO/Local) + Vector (Qdrant) | ✅ | `storage/object_store.py`(S3 boto3 / Local HMAC presigned) + `storage/vector.py`(paper_chunks dim=1024 cosine). env `S3_ENDPOINT`/`QDRANT_URL`로 백엔드 선택 |
| LLM Abstraction (S10) | ✅ | `config/models.yaml`(default + 13 task) + `providers/router.py`(`candidates`/`primary_model`/`stream_task` fallback) + Provider 레지스트리(OpenRouter 실 + 실 OpenAI/Gemini graceful + `LLM_PROVIDER=stub` 오프라인) + `providers/cache.py` 응답 캐시(Cache ORM, 키 `sha256(task+paper_id+chunk_id+model+prompt_version)`). explain/translate 라우터+캐시 경유. Langfuse(S15)·hot-reload는 후속 |
| Auto pre-gen (S11) | ✅ | ingestion `ready` 직후 `agents/pregen.py`가 6 task(summary·highlight·figure/table_description·paragraph_description/importance)를 `stream_with_cache(ttl=0)` 경유 생성 → Cache 영구 저장(새 마이그레이션 0). 전체-논문 산출물은 `chunk_id` 센티넬(`summary:{pid}`)로 키 재구성. GET `/papers/{id}/summary`·`/insights` + Right Panel Summary·Insights 탭. figure/table은 본문 텍스트 reasoning(이미지·bbox는 marker-pdf 후속), Auto-Highlight도 Cache text-anchored(`Highlight` 테이블 미사용). **References(F-05)도 pregen 말미에 `get_references` 호출로 미리 채움(격리, memo 30일) → 패널 첫 클릭 대기 제거** |
| Chat + Citation (S12) | ✅ | `agents/chat.py`(retrieve: 질문 embed→Qdrant top-k / build_messages: grounded + 직전 N턴 / generate_followups best-effort) + `api/chat.py` `POST /api/chat` SSE(토큰→`{citations}`→`{followups}`→`[DONE]`, 영속은 generator 내 `session_scope()`로 격리)·`GET /api/chat/{id}` 히스토리. `ChatSession`/`ChatMessage` ORM + `0004_chat.py`. `agents/references.py`(헤딩 탐지+엔트리 분할, Crossref enrich `REFERENCE_PROVIDER=stub` 기본, Cache memo) + `GET /papers/{id}/references`. FE ChatPanel·ReferencesPanel + 인용 칩→store `requestJump`→PdfViewer `JUMP_TO`(viewer.js). chat 캐시 `chat-v1` TTL 30일. 본문 [12] in-PDF 오버레이·bbox 펄스는 marker-pdf 후속 |
| Library 4-pane (S13) | ✅ | `api/library.py`(`/api/library` 12 엔드포인트): Collection 트리 CRUD(self-FK 무한 깊이, PATCH parentId 순환 방지, DELETE 자식+LibraryItem 재귀 정리, is_special 삭제 거부) / `GET papers` 필터(collection/status/tagIds AND)+검색(scope title/author/tag/**content**=`chunks.text` ILIKE)+정렬+특수폴더 sentinel / membership add·remove / Tag get-or-create·Tag Cloud count·제거 / `PATCH papers/{id}`(status/starred/trashed) / `POST bulk`(status/addTag/removeTag/move/trash/restore) / import·export. `agents/bib.py` 순수함수(BibTeX/RIS/EndNote parse·export). 특수폴더 Starred(특수 컬렉션)·Unread·Recently Read·Trash=가상 필터 → **신규 마이그레이션 0**(0001 모델 재사용). FE `stores/library.ts` `useLibrary` + LibraryShell 4-pane(CollectionTree/PaperList(멀티선택·BulkToolbar)/DetailPanel/TagCloud)+SearchBar(debounce 150ms)+ImportExportMenu. 단일 클릭=선택·더블 클릭=리더. drag&drop·네이티브 우클릭은 보류 |
| Markup (S14) | ✅ | `api/annotations.py`(`/api/annotations`): 하이라이트 CRUD(page+정규화 bbox JSON, source=user) / 노트 get-or-create + PUT upsert + `object_store.put_text` R2 백업(`notes/{id}.md`, s3_backup_key) / Markdown·Obsidian export(GET `?format=`, obsidian=YAML frontmatter). `object_store`에 `put_text`/`get_text`/`note_key` 추가. **신규 마이그레이션 0**(0001 highlights/notes 재사용). FE pdf.js overlay 채널 3개(RENDER_HIGHLIGHTS·REMOVE_HIGHLIGHT host→iframe / HIGHLIGHT_CLICK iframe→host) + SELECTION_CHANGE 정규화 rects → `viewer.js` 스케일독립 overlay div. Floating Menu 5액션(설명·번역 popover·Ask→chat prefill·하이라이트 색상팔레트·복사). `stores/markup.ts` `useMarkup` + NotesPanel(자동저장 debounce 400ms·하이라이트 목록·`/ai` 인라인 SSE·export 다운로드). Notion OAuth export·F-10 자동 하이라이트는 보류 |
| i18n 메시지 카탈로그 (ko) | ⬜ | Phase 0~1 |
| i18n 4언어 (en/ja/zh-CN/es) | ⬜ | Phase 2 |
| CI workflow (GitHub Actions) | 🚧 | `.github/workflows/ci.yml` 파일만 존재, 내용 빈 상태 |
| Sentry / PostHog / Langfuse (S15) | ✅ | **전부 env 게이팅 — 키 부재 시 완전 no-op**(기존 148 pytest·23 Playwright·10 vitest 불변). BE `paperlight/observability/`: `settings`(pydantic-settings, 전부 optional) + `context`(request_id/user_id/paper_id contextvars, PRD §7.9) + `sentry.init_sentry`(lifespan, FastAPI/Starlette integration) + 순수 ASGI `RequestContextMiddleware`(SSE 무버퍼링·`X-Request-Id` 헤더·Sentry tag) + `langfuse_client.get_langfuse` + `stream_task` Langfuse generation 래핑(task/model/input/output/error, 키 없으면 제로 오버헤드) + chat/explain/translate paper_id contextvar·`capture_exception`. FE: `@sentry/nextjs`(withSentryConfig + instrumentation server/edge/client + `error.tsx`/`global-error.tsx`) + `posthog-js`(`lib/analytics` 래퍼 + `AnalyticsProvider` + 큐레이션 이벤트 7종: paper_opened·explain/translate_requested·chat_message_sent·highlight_created·note_saved·export_notes). **신규 마이그레이션 0**. Prometheus/Grafana/OpenTelemetry는 Phase 2 |
| Vercel·Render 프로덕션 배포 | ⬜ | Phase 1 베타 단계에서 활성 |

### 18.4 결정 완료 사항 (변경 없음)
- 기본 LLM: `gemini/gemini-3.1-flash-lite` (Gemini API) ([§7.5](#75-llm-라우팅)) — qwen은 이전 기본, 일부 fallback에 잔존
- TTS 기본: `openai/tts-1-hd`, fallback `elevenlabs` ([§14](#14-결정사항--구-open-questions--v30에서-모두-해소))
- 인증: Google OAuth 단일 (v1)
- 리전: Vercel Seoul edge / Render Tokyo / Supabase Seoul / Qdrant ap-northeast-1
- Phase 4 결정: v1은 결제 보류, Phase 2에 도입 검토

### 18.5 다음 액션
1. **다음 진입점**: **S16 CI + 종료 회귀** — GitHub Actions(frontend lint/test/build + backend pytest + docker-compose smoke + Playwright Phase 1 suite). (S15 Observability ✅ 완료: Sentry FE+BE + Langfuse `stream_task` 트레이스 + PostHog FE 큐레이션 이벤트, 전부 env 게이팅.)
2. **병행 보류**: **Google OAuth 실 호출 합류** — `GOOGLE_OAUTH_CLIENT_ID/SECRET` 발급 시 `/api/auth/login/google` 501 placeholder를 실제 OAuth 2.0/OIDC로 교체. dev mock-login 유지.
3. **S8/S9 후속 후보**: marker-pdf 파서(`INGEST_PARSER=marker`) 실구현 · fastembed bge-m3 실 임베딩 검증 · reader `/r/{id}`에 presigned PDF 실렌더 연결 · Celery+Redis 전환 · Cohere rerank(Phase 2).
4. **S10 후속 후보**: OpenAI/Gemini 실 키 발급 후 fallback 체인 실검증 · `models.yaml` hot-reload(PRD §7.5.5) · Langfuse 추적(S15) · embedding/reranker/tts 섹션의 라우터 연결.
5. **S11 후속 후보**: marker-pdf 도입 후 실 figure 이미지(vision)·bbox 추출 → bbox-anchored `Highlight` 행 삽입(현재는 Cache text-anchored) · pre-gen 동시성/배치·Celery(현재 순차) · F-15 인라인 PDF 오버레이(P/H/I/K·Quick Skim) · Summary 마크다운 실렌더(현재 pre-wrap).
5b. **S12 후속 후보**: 본문 [12] in-PDF 마커 오버레이 호버 카드 + 0.5초 펄스 하이라이트(bbox/marker-pdf 선행) · Crossref/Semantic Scholar/arXiv 실 API 검증(현재 stub 기본·graceful) · Chat [+ Add Reference] 다른 논문 첨부 + 모델 선택기 실동작 · Chat 멀티 스레드/히스토리 검색 UI · 멀티턴 컨텍스트 캐시 최적화 · Chat 답변 Markdown 실렌더(현재 pre-wrap).
5c. **S13 후속 후보**: drag&drop 트리 재계층 + 논문 드래그 이동 · 네이티브 우클릭 컨텍스트 메뉴 · 본문 검색 인덱스/성능 최적화(현재 `LIKE` 풀스캔) · 컬럼 토글·정렬상태 서버 저장 · 진행률 막대 정밀 계산(F-15 가중) · Quick Look popover(Space) · import 시 PDF 다운로드+ingestion 연결(현재 메타-only).
5d. **S14 후속 후보**: F-10 자동 하이라이트(source=auto, ingestion 연계) · 하이라이트별 인라인 노트(Highlight.note 컬럼·마이그레이션 필요) · Notion OAuth export · Markdown 실렌더(현재 pre-wrap, 렌더러 deps 필요) · iframe 텍스트 선택 + overlay E2E(Playwright shadow-DOM 한계) · 멀티-rect 선택 정밀도 · `paperlight-notes` 버킷 분리(현재 단일 버킷 `notes/` prefix) · 노트 백업 비동기/best-effort 전환.
5e. **S15 후속 후보**: 실제 키 라이브 스모크(Sentry/PostHog/Langfuse 대시보드 트레이스 가시화 직접 확인) · `tab_id` 트레이스 키(현재 BE LLM 경로 미가용 → FE/요청 헤더로 전파) · Langfuse `usage_details`/`cost_details`(토큰·비용) 기록 · Sentry source map 업로드(`SENTRY_AUTH_TOKEN` 발급 후) · PostHog session replay·feature flag·funnel 대시보드 · Prometheus/Grafana/OpenTelemetry(Phase 2) · pregen/references 등 비-스트리밍 LLM 경로 trace 메타 강화.
6. **부재 API key 제약** (2026-05-20 사용자 확정): COHERE rerank Phase 1 스킵(Phase 2 이관) / QDRANT Cloud 미사용 → docker-compose 로컬 Qdrant / ELEVENLABS Phase 2 OpenAI tts-1-hd 단독 / GOOGLE_OAUTH 자격 정보 발급 보류 → stub/mock 모드 / OpenAI·Gemini 키 보류 → graceful unavailable, OpenRouter+stub로 검증
7. S8/S9 검증: BE pytest 44/44 PASS + Playwright 11/11 PASS (Phase 0 8 회귀 + s8-import 3) + `alembic upgrade head` clean (0001 → 0002 → 0003)
8. S10 검증: BE pytest 60/60 PASS (S8/S9 44 + router 7 + providers 4 + llm_cache 5) + Playwright 11/11 회귀 PASS (SSE 계약 불변, FE 무변경) + ruff/mypy(신규 파일) clean
9. S11 검증: BE pytest 76/76 PASS (S10 60 + llm_cache +3 + pregen 6 + pregen_api 6 + ingestion +1) + Playwright 13/13 PASS (11 회귀 + s11-pregen 2) + vitest 6/6 + `alembic upgrade head` clean(신규 0) + ruff/mypy(신규 파일) clean
10. S12 검증: BE pytest 98/98 PASS (S11 76 + chat_agent 6 + chat 7 + references 5 + references_api 4) + Playwright 15/15 PASS (13 회귀 + s12-chat 2) + vitest 6/6 + `alembic upgrade head` 0001→0004 clean(up/down/up) + ruff/mypy(신규 파일) clean
11. S13 검증: BE pytest 127/127 PASS (S12 98 + library_collections 6 + library_papers 6 + library_tags 5 + bib 7 + library_io 5) + Playwright 19/19 PASS (15 회귀 + s13-library 4) + vitest 6/6 + `alembic upgrade head` 0001→0004 clean(신규 마이그레이션 0) + ruff/mypy(신규 파일) clean
12. S14 검증: BE pytest 142/142 PASS (S13 127 + annotations_highlights 6 + annotations_notes 4 + annotations_export 5) + Playwright 23/23 PASS (19 회귀 + s14-markup 4) + vitest 6/6 + `alembic upgrade head` 0001→0004 clean(신규 마이그레이션 0) + ruff/mypy(annotations.py·object_store.py) clean
13. S15 검증: BE pytest 148/148 PASS (S14 142 + observability 6) + Playwright 23/23 PASS (회귀, 신규 spec 0 — 관측성은 키 부재 시 host-관측 UI 무변) + vitest 10/10 (6 + analytics no-op 4) + `pnpm build` clean(withSentryConfig, 키 없음) + `alembic upgrade head` 0001→0004 clean(신규 마이그레이션 0) + ruff/mypy(observability·router.py) clean. **검증 결정상 라이브 트레이스 가시화는 보류** → 배포 env 가이드(§18.3 S15 행)로 문서화. 필요 env BE `SENTRY_DSN`/`SENTRY_ENVIRONMENT`/`SENTRY_TRACES_SAMPLE_RATE`/`LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_HOST`, FE `NEXT_PUBLIC_SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_ENVIRONMENT`/`NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` (+빌드 옵션 `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`)

---

## 부록 A. 용어집
- **Chunk**: 임베딩 단위 텍스트 조각 (보통 512 토큰)
- **BBox**: PDF 페이지 위 영역 좌표
- **Cross-reference**: 본문에서 같은 논문 내 다른 위치를 가리키는 참조
- **TTFT**: Time To First Token
- **BYO**: Bring Your Own (API Key)
- **TTS**: Text-To-Speech
- **OIDC**: OpenID Connect
- **PWA**: Progressive Web App
- **R2**: Cloudflare R2 (S3 호환 객체 저장소)

## 부록 B. 참고
- Moonlight: https://www.themoonlight.io/ko
- NotebookLM: https://notebooklm.google/
- Zotero: https://www.zotero.org/
- SciSpace: https://typeset.io/
- arXiv API: https://info.arxiv.org/help/api/
- Semantic Scholar: https://api.semanticscholar.org/
- LangGraph: https://langchain-ai.github.io/langgraph/
- OpenRouter: https://openrouter.ai/docs
- Qwen: https://qwenlm.github.io/
- ElevenLabs: https://elevenlabs.io/docs
- pdf.js: https://mozilla.github.io/pdf.js/
- KaTeX: https://katex.org/
- next-intl: https://next-intl-docs.vercel.app/
