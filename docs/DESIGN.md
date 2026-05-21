# PaperLight — Design Document

> **버전**: v1.0 (PRD v3.0과 동기)
> **작성일**: 2026-05-19
> **목적**: PRD §5에서 분리한 디자인 토큰·와이어프레임·인터랙션 명세 모음.

---

## 1. 레퍼런스 인덱스

본 문서가 차용·확장한 외부 패턴들. **실제 스크린샷은 사용자 데스크탑 로컬 파일** (커밋되지 않음).

### 1.1 Moonlight — 기능 영감
- **URL**: https://www.themoonlight.io/ko
- **차용 요소**:
  - 3-Column (좌 썸네일 / 중 PDF+번역 분할 / 우 AI 패널)
  - Top Toolbar의 빠른 토글 5종 (오토 하이라이트 / 이미지 설명 / 자동 번역 / 단락 설명 / Quick Skim)
  - 우측 AI 패널의 키워드 사전 · 3줄 요약 · 후속 질문 칩
  - **Shadow DOM iframe**으로 pdf.js 격리 (HTML 분석에서 확인)
  - **Floating Selection Menu** (텍스트 선택 200ms 후 5개 액션)
  - 번역 품질 👍/👎 피드백

### 1.2 Zotero — 데스크탑 UX 영감
- **URL**: https://www.zotero.org/
- **차용 요소**:
  - **상단 탭바**: Library 탭 + 개별 논문 탭 (한 화면에서 폴더 ↔ 논문 전환)
  - **4-pane Library**: 좌 컬렉션 트리 / 중 리스트 / 우 디테일 / 하단 태그 클라우드
  - 무한 깊이 컬렉션 트리 + 멀티 태그
  - 정보 밀집 데스크탑 톤 (Compact density)
  - 메인 리스트의 정렬·필터·다중 선택·Bulk 작업
  - 우측 디테일 패널에 arXiv ID / DOI / Notes count

### 1.3 NotebookLM — Podcast 영감
- **URL**: https://notebooklm.google/
- **차용 요소**: Audio Overview의 2인 대담 형식 → F-13 AI Podcast.

### 1.4 SciSpace — 비교 분석
- **URL**: https://typeset.io/
- **차용 요소**: 비교 모드 (Compare) — Phase 3 v1.

---

## 2. 컴포넌트 와이어프레임

### 2.1 글로벌 셸 (Library + Reader 공통)
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📚 내 라이브러리 │ How Mobile World... ✕ │ AlphaFold 3 ✕ │ +        │  36px Tab Bar
├─────────────────────────────────────────────────────────────────────┤
│ [◀TOC][Thumbs][🔍] [3/45] [- 100% +]                                │  56px Top Toolbar
│        [A][G][P][K][T]              [🌐ko ▾][⌘K][⋯][👤][▶]          │
├─────────────────────────────────────────────────────────────────────┤
│  ↓ Tab content (Library 4-pane OR Reader 3-col)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Library View — Zotero 4-pane
```
┌──────────┬───────────────────────────────────────┬─────────────────┐
│ ① Tree   │ ② List                                │ ③ Detail        │
│ (250px)  │                                       │ (320px)         │
│          │ ☑ 제목         저자     연도 상태 태그 │                 │
│ ▼ My Lib │ ─────────────────────────────────────│ 📄 Mobile World │
│  ⏰ Recent │ ☐ Mobile WM    Doe      2026 📖  AI │ Model Guides...  │
│  ⭐ Star  │ ☐ AlphaFold 3  Smith    2024 ✅  Bio│                 │
│  📥 Unread│ ☐ ...                                │ Authors: ...    │
│  🗑 Trash │ ...                                   │ Venue: arXiv    │
│          │                                       │ Year: 2026      │
│ ▼ GUI    │                                       │ arXiv: 2509.10..│
│  ├ Mobile│                                       │ DOI: -          │
│  └ Web   │                                       │ Added: 3일 전    │
│ ▼ LLM    │                                       │                 │
│ ▼ Biology│                                       │ Tags: AI, GUI...│
│          │                                       │ Notes (3) ▶     │
│          │                                       │ Highlights (12)▶│
│          │                                       │ Progress: 38%   │
├──────────┴───────────────────────────────────────┴─────────────────┤
│ ④ Tag Cloud:  AI×12  Mobile×7  GUI Agents×5  RLHF×4  Diffusion×3...│ 120px
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Reader View — 3-Column
```
┌──────────┬─────────────────────────────────────┬──────────────────┐
│ ② Sidebar│ ③ Center (PDF + Translation)        │ ④ Right Panel    │
│ (180px)  │ ┌────────────────┬──────────────┐  │ ┌──────────────┐ │
│          │ │                │ 번역          │  │ │📖📝🎧💬🔖⭐ ▶│ │
│ TOC      │ │   PDF 페이지     │ (병행)       │  │ ├──────────────┤ │
│ ├ Intro  │ │                │              │  │ │ 키워드 사전    │ │
│ ├ Method │ │                │              │  │ │ [Mobile WM]   │ │
│ └ Result │ │                │              │  │ │ [GUI Agents]  │ │
│          │ │                │              │  │ │ ...           │ │
│ [Thumbs] │ └────────────────┴──────────────┘  │ │               │ │
│          │                                     │ │ 3줄 요약       │ │
│          │                                     │ │ 1. ...p.2      │ │
│          │                                     │ │ 2. ...p.5      │ │
│          │                                     │ │ 3. ...p.10     │ │
│          │                                     │ │               │ │
│          │                                     │ │ 후속 질문      │ │
│          │                                     │ │ • 핵심은?      │ │
│          │                                     │ │ • 차별점은?    │ │
│          │                                     │ └──────────────┘ │
└──────────┴─────────────────────────────────────┴──────────────────┘
```

### 2.4 Floating Selection Menu (Moonlight 패턴)
```
                  [💡 Explain  🌐 Translate  💬 Ask  🖍 Highlight  📋]
                  ↑ 선택 영역 위 8px, 200ms hover 후 fade in
─────────────── 선택된 텍스트 ───────────────
```

### 2.5 Right AI Panel — Summary 탭 디테일
```
┌──────────────────────────────────┐
│ 📖 Summary  📝 📝🎧💬🔖⭐         │
├──────────────────────────────────┤
│ ▼ 키워드 사전                     │
│   [Mobile World Model]            │  ← 클릭 → 본문 첫 등장 점프 + 0.5초 펄스
│   [GUI Agents] [Prediction...]    │
│   [AndroidWorld] [AITZ]           │
│                                  │
│ ▼ 3줄 요약                        │
│   1. 이 연구는 ...        [p.2]   │  ← 페이지 뱃지 클릭 → 본문 점프
│   2. World Model을 활용 ... [p.5] │
│   3. 결과적으로 ...      [§4.2]   │
│                                  │
│ ▼ 한 줄 요약 (TL;DR)              │
│   "이 논문은 ...을 통해 ..."       │
│                                  │
│ ▼ Section by Section              │
│   - Introduction: ...             │
│   - Method: ...                   │
│                                  │
│ ▼ Figures & Tables (F-14)         │
│   📊 Figure 1: 결과 시각화 [→]    │
│   📋 Table 1: 성능 비교  [→]      │
│                                  │
│ ▼ 후속 질문 추천                   │
│   [이 논문의 핵심은?]              │  ← 클릭 → Chat 탭 + 자동 전송
│   [기존 연구와 차이는?]            │
│   [한계점은?]                     │
└──────────────────────────────────┘
```

### 2.6 Tab Bar 디테일
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📚 내 라이브러리 │ How Mobile World... ✕ │ ● AlphaFold 3 ✕ │ +     │
│  ↑ 고정 (✕없음)  ↑ 일반 탭            ↑ 활성(파란 도트)        ↑ 새탭│
└─────────────────────────────────────────────────────────────────────┘

우클릭 컨텍스트 메뉴:
  ┌─────────────────────────┐
  │ 닫기              ⌘W    │
  │ 다른 탭 모두 닫기         │
  │ 오른쪽 탭 모두 닫기       │
  │ ──────                  │
  │ Pin Tab                │
  │ 새 창에서 열기            │
  └─────────────────────────┘
```

---

## 3. 디자인 토큰

### 3.1 색상

#### Light 모드 (default)
```css
/* Brand */
--brand-primary:        #7C5CFC;   /* 보라, Moonlight 톤 */
--brand-primary-hover:  #6A4AE8;
--brand-primary-soft:   #EFE9FF;
--brand-primary-text:   #FFFFFF;

/* Surface */
--bg-base:              #FAFAFB;
--bg-surface:           #FFFFFF;
--bg-muted:             #F4F4F6;
--bg-overlay:           rgba(0, 0, 0, 0.4);

/* Border */
--border-subtle:        #E8E8EC;
--border-default:       #D4D4DA;
--border-strong:        #B0B0B8;

/* Text */
--text-primary:         #1A1A1F;
--text-secondary:       #5B5B66;
--text-muted:           #8B8B96;
--text-inverse:         #FFFFFF;

/* Highlight 카테고리 (F-10) */
--hl-contribution:      #FFF4C2;   /* 부드러운 노랑 */
--hl-method:            #DEEBFF;   /* 부드러운 파랑 */
--hl-result:            #D6F3E0;   /* 부드러운 초록 */
--hl-limitation:        #FFE0E0;   /* 부드러운 빨강 */

/* F-15 Importance */
--importance-critical-bg:    #FFF4C2;
--importance-skippable-bg:   #F4F4F6;
--importance-skippable-text: #8B8B96;

/* Feedback */
--success:              #2EA66B;
--warning:              #E0A11D;
--danger:               #D8443D;
--info:                 #2D6FE0;
```

#### Dark 모드
```css
--bg-base:              #15151A;
--bg-surface:           #1E1E24;
--bg-muted:             #25252D;

--border-subtle:        #2E2E36;
--border-default:       #3A3A44;
--border-strong:        #4D4D58;

--text-primary:         #F5F5F8;
--text-secondary:       #B0B0BC;
--text-muted:           #7A7A85;

--brand-primary:        #9B82FF;
--brand-primary-soft:   #2A2440;

/* Highlight 다크 톤 */
--hl-contribution:      #4D421E;
--hl-method:            #1E3A55;
--hl-result:            #1F4A2E;
--hl-limitation:        #4D2424;

--importance-critical-bg:    #4D421E;
--importance-skippable-bg:   #25252D;
--importance-skippable-text: #6A6A75;
```

### 3.2 타이포그래피
| 토큰 | 한글 (Pretendard) | 영문 (Inter) | 행간 |
| --- | --- | --- | --- |
| `--font-display` | 24px / 700 | 24px / 700 | 1.3 |
| `--font-title` | 18px / 600 | 18px / 600 | 1.4 |
| `--font-body` | 14px / 400 | 14px / 400 | 1.6 |
| `--font-body-lg` | 16px / 400 | 16px / 400 | 1.6 |
| `--font-meta` | 12px / 400 | 12px / 400 | 1.5 |
| `--font-mono` | — | JetBrains Mono 13px | 1.5 |

수식 = KaTeX default + `--font-mono` 14px.

**번역 글꼴 (F-02 페이지별 번역 컬럼)**: 번역 컬럼은 산세리프(Pretendard) / 세리프(Noto Serif KR, 본명조) 중 선택(설정에 영속). 컬럼은 iframe 안이라 viewer.css `@font-face`로 자체 호스팅하며 host가 `SET_TRANSLATION_FONT`로 전달.

**리더 글꼴 크기 (F-02)**: `--reader-font-scale`(0.8–1.4, 기본 1.0)을 `html` 폰트 크기에 곱해 번역 컬럼 + 리더 UI 텍스트를 함께 조절(PDF 원문 줌과는 독립). 리더 라우트에서만 적용되어 Library는 무영향. 설정 위치: 우상단 설정(⋯) 메뉴.

### 3.3 Spacing (4의 배수)
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

### 3.4 Radius
```css
--radius-sm:  4px;    /* 칩 / 뱃지 */
--radius-md:  8px;    /* 버튼 */
--radius-lg:  10px;   /* 입력 */
--radius-xl:  12px;   /* 카드 */
--radius-2xl: 16px;   /* 모달 */
--radius-full: 9999px;
```

### 3.5 Shadow (강하지 않게)
```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.04);
--shadow-md:  0 4px 12px rgba(0,0,0,0.08);
--shadow-lg:  0 12px 32px rgba(0,0,0,0.12);
--shadow-focus: 0 0 0 3px var(--brand-primary-soft);
```

> **그림자 대신 1px border 우선** — 친숙한 데스크탑 톤 유지.

### 3.6 Motion
```css
--motion-fast:    100ms ease-out;   /* hover */
--motion-default: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--motion-panel:   250ms cubic-bezier(0.4, 0, 0.2, 1);  /* 패널 접기 */
--motion-page:    400ms cubic-bezier(0.4, 0, 0.2, 1);  /* 탭 전환 */
```

---

## 4. Tonal Variant 매핑

| 토큰 | Compact | Cozy (default) | Spacious |
| --- | --- | --- | --- |
| List row height | 28px | 40px | 56px |
| Body font | 13px | 14px | 15px |
| Padding (cards) | 8px | 12px | 16px |
| Gap (list items) | 0px | 2px | 4px |
| Sidebar item h | 24px | 32px | 40px |

설정 위치: Settings → Appearance → Density.
Library 4-pane / Reader / Right Panel 전체에 동일 톤 적용.

---

## 5. 인터랙션 패턴

### 5.1 Hover
- 일반 버튼: `100ms ease-out`, 배경색 변경.
- 칩: 배경 `--brand-primary-soft` + border subtle.
- 아이콘 only 버튼: 호버 시 `title` 툴팁으로 기능을 한 문장으로 안내 (예: 우측 패널 Icon-Rail).

### 5.2 Click
- `80ms scale(0.98)` 마이크로 반응.
- 키워드 칩 / 페이지 뱃지: 클릭 → 본문 점프 + 0.5초 펄스 (yellow soft fade out).

### 5.3 Drag & Drop
- 컬렉션 트리: 드래그 시 ghost = 반투명, 드롭존 = brand-primary border 2px.
- 라이브러리 → 컬렉션: 다중 선택 후 드래그 → "N papers" pill.

### 5.4 Context Menu (우클릭)
- 라이브러리 리스트 / 컬렉션 트리 / 탭 / 본문 / 도표 모두 지원.
- 항목 ≥ 5개면 그룹 분리선.

### 5.5 Keyboard Navigation
> PRD §15 단축키 차트 참조.

### 5.6 Streaming (LLM 응답)
- 우측 패널 헤더에 점멸 인디케이터 ●.
- 응답 중 사용자가 탭 변경 → 백그라운드 계속 + 완료 시 알림 도트.

### 5.7 Loading
- 스피너 지양 → **Skeleton + Shimmer**.
- 라이브러리 빈 상태 → 일러스트 + "첫 논문을 올려보세요" 마이크로카피.

### 5.8 Toast / Inline Feedback
- 좌하단 toast, 4초 자동 사라짐.
- Critical 오류는 inline banner (top of content).

---

## 6. 마이크로카피 톤

- 친근하지만 학술 친화: "분석 중이에요 ✨" (X) / "분석하고 있습니다" (O).
- 에러: "앗, 잠시 길을 잃었어요. 다시 시도해볼까요?" — 사용자 책임 전가 X.
- 빈 상태: "첫 논문을 올려보세요. arXiv ID도 좋아요."
- 권한 요청: "Google 계정으로 안전하게 로그인합니다."

---

## 7. 접근성 (a11y)

- 모든 인터랙티브 요소 키보드 접근 가능.
- WCAG AA 색 대비 (4.5:1 본문 / 3:1 큰 텍스트).
- 다크 모드에서도 동일 기준.
- `prefers-reduced-motion` 시 motion 시간 50%로 단축.
- 스크린리더 라벨: 아이콘 only 버튼은 `aria-label`.

---

## 8. 시각 자산

| 자산 | 출처 | 라이선스 |
| --- | --- | --- |
| Lucide Icons | https://lucide.dev | ISC |
| Pretendard | https://github.com/orioncactus/pretendard | OFL-1.1 |
| Inter | https://rsms.me/inter/ | OFL-1.1 |
| JetBrains Mono | https://www.jetbrains.com/mono/ | OFL-1.1 |
| 일러스트 | (Phase 1에 자체 제작 또는 unDraw 사용) | TBD |

