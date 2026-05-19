# PRD: AI 논문 리더 (가칭: PaperLight)

> **버전:** v2.3
> **작성일:** 2026-05-19
> **상태:** Draft
> **레퍼런스:** [Moonlight](https://www.themoonlight.io/ko), [NotebookLM Audio Overview](https://notebooklm.google/)

---

## 0. 변경사항 (Changelog)

### v2.3
1. **F-15. Paragraph-level Description** 신설 — 모든 단락에 대해 한 줄 요점 + 핵심 개념 해설 + 단락 간 연결 + 중요도(Critical/Standard/Skippable) 자동 분류
2. **3단 설명 계층 정립**:
   - **Macro** = F-06 Summary (논문 전체 / 섹션)
   - **Meso**  = F-14 Figure/Table (도표 단위)
   - **Micro** = F-15 Paragraph (단락 단위) ⭐
3. **§5.3 Top Toolbar** — `📝 단락 설명` 토글 추가 + Quick Skim Mode 진입점
4. **§5.4 우측 패널** — `📝 Paragraph Insights` 탭 신설 (4개 모드: Inline Hint / Importance Highlight / Quick Skim / Side Panel)
5. **§7 기술** — `paragraph_description`, `paragraph_importance` task 추가 (비용 절감을 위해 Haiku/Flash 사용 + batch 처리)
6. **§13 차별화 표** — 단락별 중요도 분류 / 단락-단락 연결 그래프 / Quick Skim Mode 등 PaperLight 유일 항목 추가

### v2.2
1. **F-14. Figure / Table Description** 신설 — 도표 클릭 시 sub-figure 단위로 구조화된 설명 자동 생성 (Vision LLM)
2. **F-04 Explanation 범위 명확화** — 수식 / 정의 / 약어 위주로, Figure / Table은 F-14로 위임
3. **§7 기술** — Vision-capable LLM task 추가 (`figure_description`, `table_description`), `prompts/figure_description.yaml` 추가
4. **§5.4 UI** — Summary 탭에 "Figures & Tables" 인덱스 섹션 추가

### v2.1
1. **§5.2 / §5.3** — 좌·우 패널 **접기/펴기(Collapsible)** 명세 추가 (단축키, 상태 저장, 애니메이션)
2. **§5.7** — **콘텐츠 언어 설정** 신설 (UI / Content / Translation Target 3-Layer 분리, Default=ko)
3. **§5.8** — **전문 용어 보존(Technical Term Preservation)** 신설 (Glossary YAML, 프롬프트 가이드라인)
4. **§7.5 전면 개편** — `.env` 단일 → `config/*.yaml` + `.env` 분리 (models / hyperparameters / providers / prompts / glossary)

### v2.0
1. **§5. UI/UX 디자인** — Moonlight 스크린샷 기반 레이아웃 / 컴포넌트 / 디자인 시스템
2. **F-13. AI Podcast** — NotebookLM Audio Overview 패턴의 2인 대담 팟캐스트
3. **§7.5 LLM Provider Abstraction** — 멀티 프로바이더 라우팅
4. **§5.6 추가 기능** — Mind Map / Flashcard / Compare 등 12개 제안

---

## 1. 개요

### 1.1 한 줄 설명
"PDF 뷰어 안에서 모든 AI 기능이 끝나는" 논문 읽기 도구. 보고, 듣고, 정리하고, 발견한다.

### 1.2 핵심 가치 제안
- **No Re-upload**: 한 번 열면 끝.
- **Context-aware**: 논문 전체를 인지한 답변.
- **In-place**: 화면을 떠나지 않음.
- **Multi-modal**: 읽기 + **듣기(Podcast)** + 시각화.

### 1.3 비전
> 논문을 여는 순간, 가장 잘 아는 동료가 옆에 앉아 함께 읽어주고, 출퇴근 길에는 그 논문을 라디오처럼 들려주는 도구.

---

## 2. 타겟 사용자

| 페르소나 | 상황 | 핵심 Pain | PaperLight 해결 |
| --- | --- | --- | --- |
| **예비 대학원생 (Alice)** | 영어 논문 입문 | 어디부터 봐야 할지 모름 | 맥락 번역 + Summary + Podcast |
| **재학 대학원생 (Bob)** | 매주 5~10편 정독 | 시간 부족 | Summary + Auto Highlight + Podcast |
| **AI 실무자 (Charlie)** | arXiv 신착 추적 | 옥석 가리기 어려움 | Podcast(출퇴근) + Deep Search |
| **연구실 PI (Dr. Kim)** | 팀 지식 자산 관리 | 노트 분산 | Team Library + 공유 Podcast |

---

## 3. 성공 지표

### 3.1 북극성 지표
- **D30 Retention ≥ 35%**
- **Paper-Read-Per-User-Per-Week ≥ 5편**
- **유료 전환율 (MAU) ≥ 7%**
- **Podcast 청취 완료율 ≥ 60%** (10분 이상)

### 3.2 기능별 KPI

| 기능 | KPI | 목표 (3개월) |
| --- | --- | --- |
| Explanation | 텍스트 선택 후 사용률 | ≥ 40% |
| AI Chat | 세션당 메시지 | ≥ 6 |
| Summary | 자동 열람률 | ≥ 60% |
| **AI Podcast** | **생성 → 청취율** | **≥ 45%** |
| Auto Highlight | 채택률 | ≥ 30% |
| Deep Search | 추천 클릭 | ≥ 15% |

### 3.3 기술 SLO
- 첫 페이지 렌더링 < 2초
- AI 첫 토큰 < 1.5초
- PDF 파싱 (50p) < 20초
- **Podcast 생성 (10분 분량) < 90초**

---

## 4. 기능 요구사항

> 형식: **F-XX. 이름** — 설명 / 트리거 / 입출력 / 우선순위(P0/P1/P2)

### F-01. PDF 뷰어 (P0)
- arXiv ID / URL / 파일 업로드 모두 지원
- 텍스트 선택 시 floating menu (Explain / Translate / Ask / Highlight)
- 한 페이지 / 두 페이지 / 연속 스크롤
- 다크 모드, 핀치 줌
- **스크린샷 모드**: 도표 영역을 직접 드래그하여 Explanation 요청

### F-02. Translation (P0) — 병행 표시
- 본문 우측에 **나란히 표시** (스크롤 동기화)
- 맥락 기반 (분야별 용어 사전 적용)
- 토글: 자동 번역 ON/OFF, 인라인/병행, 언어 선택
- 사용자가 직접 번역 품질 피드백(👍/👎) — 모델 학습 시그널

### F-03. AI Chat (P0)
- 우측 패널, 스트리밍, 인용 표시
- 응답의 인용 클릭 → 본문 점프 + 하이라이트
- **퀵 질문 칩**: "이 논문의 핵심이 뭐야?", "기존 연구랑 뭐가 달라?", "한계점이 뭐야?" (Moonlight UI 참고)
- 후속 질문 추천 3개 자동 생성

### F-04. Explanation (P0)
- **수식 / 정의 / 약어** 선택 시 즉시 풀이 (Figure/Table은 **F-14**로 위임)
- 수식: 변수표 + 직관 해석 + LaTeX 원문
- 정의/약어: 정의 + 원어 + 예시 + 본문 첫 등장 위치
- 본문 근거 인용 필수 (페이지 / 섹션)

### F-05. Citation (P0)
- 본문 인용 마커 호버 → 카드 (제목/저자/연도/abstract)
- 클릭 → 전체 카드 + "열기" 버튼
- Crossref / Semantic Scholar / arXiv API 사용

### F-06. Summary — 다층 (P0)
- **TL;DR** (1문장)
- **3-Point Summary** (Problem / Method / Result) ← Moonlight의 "3줄 요약"에 해당
- **Section-by-Section**
- **Contribution List**
- **Keyword Dictionary** (자동 추출된 핵심 용어 사전) ← Moonlight UI의 "키워드 사전"

### F-07. Preview (P1)
- 본문의 `Figure 3`, `Table 2` 같은 cross-ref 호버 → 미니 프리뷰

### F-08. Library (P0)
- 폴더 / 태그 / 상태 (To Read / Reading / Read)
- 검색 (제목 / 저자 / 본문 / 노트)
- BibTeX, RIS, Endnote 가져오기/내보내기

### F-09. Scholar Deep Search (P1)
- 라이브러리 임베딩 평균 → 사용자 관심 벡터
- Semantic Scholar / OpenAlex 검색 + 재랭킹
- "왜 추천됐는지" 설명

### F-10. Auto Highlight (P1)
- 카테고리별 색상: Contribution(노랑) / Method(파랑) / Result(초록) / Limitation(빨강)
- 강도 조절 (Sparse / Medium / Dense)

### F-11. Markup (P1)
- 사용자 하이라이트 + 노트 (Markdown)
- 노트 안에서 AI Chat 호출 (`/ai` 슬래시 커맨드)
- Export: Markdown / Notion / Obsidian / BibTeX

### F-12. Team / 협업 (P2)
- 공유 라이브러리, 공유 노트, 코멘트

### F-13. **AI Podcast (P0)** ⭐ 신규

#### 13.1 개요
NotebookLM의 Audio Overview처럼, 논문을 **2인 대담 형식의 한국어/영어 팟캐스트**로 변환. 출퇴근/운동 중에도 논문 핵심을 흡수.

#### 13.2 호스트 페르소나 (Default)
- **호스트 A (가이드형)**: 질문을 던지고 일반 청취자 입장에서 풀어달라고 요청. 친근한 톤.
- **호스트 B (전문가형)**: 깊이 있는 설명, 인용/숫자 활용. 차분한 톤.
- 사용자가 페르소나를 커스터마이즈 가능 (이름, 톤, 어조).

#### 13.3 옵션
| 옵션 | 값 |
| --- | --- |
| **언어** | 한국어 / 영어 / 일본어 |
| **길이** | Short (3~5분) / Standard (8~12분) / Deep (15~20분) |
| **수준** | General(일반인) / Practitioner(실무자) / Researcher(연구자) |
| **포커스** | Overall / Methods Only / Results Only / Critique |
| **TTS 보이스** | OpenAI(alloy/echo/...) / ElevenLabs(custom) |

#### 13.4 생성 파이프라인
```
[Paper Chunks + Summary]
   ↓
[Outline Agent]              # 팟캐스트 구성: hook → context → method → result → critique → outro
   ↓
[Script Writer Agent]        # 대본 작성 (자연스러운 대화체, 인용 포함)
   ↓
[Script Critic Agent]        # 사실 검증 (논문 컨텍스트 외 발언 차단)
   ↓
[Script Polisher Agent]      # 어조/리듬 다듬기, 추임새/감탄사 자연스럽게
   ↓
[TTS 호출 (Multi-voice)]      # 화자별 다른 보이스
   ↓
[Audio Stitcher]             # FFmpeg로 연결, 간격/페이드
   ↓
[Output: MP3 + 자막(SRT) + 챕터 마커]
```

#### 13.5 UI
- 우측 AI 패널에 "🎧 Podcast" 탭
- "Generate" 버튼 → 옵션 선택 모달 → 진행 표시 (예상 시간)
- 완료 후 인라인 플레이어:
  - 재생 / 일시정지 / 1.0x~2.0x 배속
  - 챕터 점프 (Introduction / Method / Result / ...)
  - **재생 중인 부분이 PDF 본문에 동기 하이라이트** ← 차별 포인트
  - 자막(transcript) on/off
  - 다운로드 (MP3 / SRT)
- "이 부분에 대해 더 자세히" 버튼 → AI Chat으로 연결

#### 13.6 비용 통제
- Standard(10분) 1회 생성 비용 추정: TTS $0.30 + LLM $0.10 = **~$0.40**
- 캐시: 동일 논문 + 동일 옵션은 영구 캐시
- 무료 플랜: 월 3회 / Pro: 월 30회 / Team: 무제한

### F-14. **Figure / Table Description (P0)** ⭐ 신규

#### 14.1 개요
논문의 모든 figure / table에 대해 AI가 **구조화된 설명**을 자동 생성한다. 도표를 단순히 "보는" 것이 아니라 "**이해하는**" 것을 돕는 기능. (Moonlight의 "이미지 설명" 기능과 유사한 사용자 가치, 더 깊은 구조화 + 본문 연결.)

핵심 가치 — 다음 세 가지를 한 번에 해결:
- 처음 보는 그래프 / 표의 **축, 비교 대상, 범례** 의미 즉시 이해
- 서브플롯이 많은 figure (예: (a), (b), (c), (d))에서 **각 서브플롯 단위 해석**
- 본문 주장과의 연결 (this figure supports the claim that ...)

#### 14.2 트리거
| 트리거 | 동작 |
| --- | --- |
| Figure / Table 영역 **클릭** | Floating popover로 즉시 설명 |
| 상단 툴바 `📊 이미지 설명` 토글 **ON** | 모든 도표에 mini-icon 배지, hover 시 미리보기 |
| 본문의 `Figure 2`, `Table 1` cross-ref **클릭** | 해당 도표로 점프 + 자동으로 설명 popover 표시 |
| Summary 탭의 "Figures & Tables" 인덱스에서 클릭 | 본문 점프 + 설명 |

#### 14.3 출력 구조

##### Figure인 경우
```
[추론된 주제] (예: "결과 시각화", "모델 아키텍처", "Failure case 분석")

📌 한 줄 요약
이 그래프는 X와 Y를 Z로 비교하여 ... 를 보여줍니다.

📊 서브플롯별 분석  (서브플롯이 있는 경우)
(a) [라벨]
   - X축 / Y축 의미
   - 비교 대상
   - 핵심 관찰 (어떤 모델이 우수, 패턴, anomaly)
(b) [라벨]
   - ...

🔑 핵심 (Key Insight)
이는 [논문의 주장]을 뒷받침합니다. 본문 §X.X 와 연결됩니다.

⚠️ 한계 / 주의점 (선택적)
- 평가 지표가 X에 한정되어 있음
- N=3으로 표본이 작음
```

##### Table인 경우
```
📌 한 줄 요약
이 표는 X를 Y개 방법으로 비교하여 Z 지표를 측정합니다.

📐 구조
- 행: ... (예: 비교 모델들)
- 열: ... (예: 평가 데이터셋 / 지표)
- Bold 표시: 최고 성능

🏆 핵심 행 / 열
- 최고 성능: [Method X] on [Dataset Y] = N.NN
- Baseline 대비 +X.X%p 향상

🔑 본문 연결
본문 §X.X에서 "..." 라고 주장하는 근거.
```

#### 14.4 자동 분류 (Type Inference)
파싱 시 다음 메타를 추론하여 설명 톤을 조정한다.

| 차원 | 값 |
| --- | --- |
| **차트 종류** | bar / line / scatter / heatmap / box / pie / radar / 기타 |
| **목적** | Comparison(비교) / Trend(추세) / Distribution(분포) / Relation(관계) / Architecture(구조) |
| **위치 의미** | Main result / Ablation / Failure case / Method overview / Qualitative example |

이 분류는 sub-figure 단위로도 가능. 예: Figure 1의 (a)는 Main result, (b)는 Ablation.

#### 14.5 UI (Moonlight 패턴 차용 + 강화)

**Floating Popover** (모달 아님 — 본문 흐름 보존):
```
┌─────────────────────────────────────────────┐
│ 🌒 결과 시각화                  ⚙️ [Ko ▾] ✕ │   ← 추론된 제목, 언어, 닫기
├─────────────────────────────────────────────┤
│ 📌 이 그래프는 ...                          │
│                                             │
│ 📊 (a) World-model prediction quality       │
│   • X축: 모델 / Y축: 점수                   │
│   • Full Text, Delta Text 형식에서          │
│     MWM이 다른 모델보다 우수                │
│   • 특히 Delta Text에서 ...                 │
│                                             │
│ 📊 (b) Offline action selection             │
│   • ...                                     │
│                                             │
│ 🔑 핵심: MWM이 GUI 환경 ...                  │
├─────────────────────────────────────────────┤
│ [💬 이 그림에 대해 더 물어보기...] [↗ Chat] │   ← Follow-up + Chat 이어가기
└─────────────────────────────────────────────┘
```

상호작용:
- ⚙️ 설정: 상세도 (Brief / Standard / Deep), 본문 인용 ON/OFF
- 🌐 언어 셀렉터: 이 popover만 다른 언어로 (§5.7 Content Language override)
- ↗ Chat: 이 figure를 컨텍스트로 AI Chat 탭으로 점프, 대화 이어가기

#### 14.6 처리 파이프라인
```
[Ingestion 시 1회: Figure / Table BBox 검출 + 추출]
        ↓
   [PDF 파서 (PyMuPDF + marker-pdf)]
        ↓
   [Figure 객체: image + caption + adjacent text + subfigure BBoxes]
        ↓
   [캐시 저장 (S3 이미지 + DB 메타)]

[사용자 클릭 시: 설명 생성]
        ↓
   [캐시 조회 (paper_id + figure_id + lang + detail)]
        ↓  miss
   [Vision LLM 호출]
        - 입력: figure 이미지 + caption + 인접 본문 + 글로서리 용어
        - 모델: gpt-5 / gemini-2.5-pro / claude-opus-4.7
        ↓
   [Type Classifier]   # 차트 종류 / 목적 추론
        ↓
   [Structured Output (JSON)]
        ↓
   [보존 용어 후처리]  # §5.8 — Full Text, Delta Text, MWM 등 원어 유지
        ↓
   [본문 cross-ref 매핑]
        ↓
   [Output → Popover 렌더링]
```

#### 14.7 모델 요구사항
**Vision-capable LLM 필수.** `config/models.yaml`에 새 task 추가:
```yaml
tasks:
  figure_description:
    provider: openai
    model: gpt-5                      # Vision 지원
    fallback:
      - { provider: gemini, model: gemini-2.5-pro }
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }
  table_description:
    provider: gemini
    model: gemini-2.5-pro
    fallback:
      - { provider: openai, model: gpt-5 }
```

#### 14.8 캐싱 전략
- **Key**: `(paper_id, figure_id, content_language, detail_level)`
- **TTL**: 영구 (논문이 바뀌지 않으면 변하지 않음)
- 언어별 / 상세도별 독립 캐시
- 사용자 follow-up 질문은 캐싱하지 않음

#### 14.9 옵션
| 옵션 | 값 |
| --- | --- |
| **상세도** | Brief (3 문장) / Standard (서브플롯별, default) / Deep (수식·인용까지) |
| **본문 인용 포함** | ON / OFF |
| **언어** | Content Language 따름, popover 단위 override 가능 |

#### 14.10 비용 통제
- Standard 상세도 1회 생성: ~$0.02 (Vision 모델, 캐시 hit 시 $0)
- 캐시 hit률 목표 ≥ 90% (한 번 생성 후 재사용)
- 무료 플랜: 일 30회 / Pro: 무제한

#### 14.11 차별 포인트 (vs Moonlight)
| 항목 | Moonlight | PaperLight (F-14) |
| --- | --- | --- |
| 자동 설명 | ✅ | ✅ |
| Sub-figure 단위 분해 | ✅ | ✅ |
| 본문 cross-ref 자동 매핑 | △ | **✅ (§X.X 정확히 인용)** |
| Type Classifier (차트 종류 / 목적) | ❌ | **✅** |
| 캐시 + 다국어 즉시 전환 | △ | **✅** |
| 전문 용어 보존 (§5.8 연동) | △ | **✅** |
| Chat 이어가기 (figure 컨텍스트 유지) | △ | **✅** |

### F-15. **Paragraph-level Description (P0)** ⭐ 신규

#### 15.1 개요
논문의 **모든 단락(paragraph)에** 대해 AI가 다음 4가지를 자동 생성한다.
1. **한 줄 요점** (1-line takeaway)
2. **핵심 개념 해설** (이 단락에서 처음 등장하는/중요한 개념 풀이)
3. **단락 간 연결** (어느 단락의 결과인지 / 어디로 이어지는지 / 어떤 도표와 연결되는지)
4. **중요도 분류** (Critical / Standard / Skippable + 이유)

#### 15.2 설명 계층 (3-Tier)
PaperLight의 모든 설명 기능은 다음 3계층으로 정리된다.

| Tier | 단위 | 기능 | 트리거 |
| --- | --- | --- | --- |
| **Macro** | 논문 전체 / 섹션 | F-06 Summary | 자동 생성 |
| **Meso** | 도표 단위 | F-14 Figure / Table | 클릭 / 토글 |
| **Micro** ⭐ | 단락 단위 | **F-15 Paragraph** | 호버 / 클릭 / 토글 |

각 계층은 독립 동작하면서 서로 입력으로 활용:
- F-15 결과 → F-06 Section Summary 생성 입력
- F-15 중요도 → F-10 Auto Highlight, F-13 Podcast 챕터 구성 입력
- F-15 연결 정보 → F-07 Preview의 cross-ref 데이터

#### 15.3 트리거
| 트리거 | 동작 |
| --- | --- |
| 상단 툴바 `📝 단락 설명` 토글 ON | 모든 단락 옆에 💡 배지 + (옵션) 중요도 색상 |
| 단락 배지 **호버** | 1줄 요점 tooltip (가벼움) |
| 단락 배지 **클릭** | 인라인 카드 펼침 (한 줄 요점 + 개념 해설 + 연결 + 중요도) |
| 단락 본문 우클릭 → "이 단락 분석" | 인라인 카드 즉시 펼침 |
| 우측 패널 `📝 Paragraph Insights` 탭 | 전체 단락 요약 시퀀스 (스크롤하며 빠른 스캔) |
| 상단 툴바 `⚡ Quick Skim` 토글 | 본문이 한 줄 요점으로 임시 대체 (5분 스캔용) |

#### 15.4 출력 구조 (단락 1개당)
```
Paragraph N  (Section 2.3, p.4)

📌 한 줄 요점
   "VLM이 GUI Agent를 가능하게 했지만 행동 예측은 여전히 부족하다는 문제 제기."

🔍 핵심 개념 해설
   - **VLM** (Vision-Language Model): 이미지+언어를 함께 다루는 모델
   - **action consequence**: 행동이 가져올 결과 — 본 논문의 핵심 예측 대상
   - 본문에서 처음 도입된 개념: action consequence

🔗 단락 간 연결
   ← ¶3 (VLM의 배경 정의)
   → ¶7 (이 한계의 해결책으로 World Model 제시)
   ↔ Figure 1 (이 단락의 시각화)

🎯 중요도: Critical
   이유: 논문 동기(motivation)의 핵심. 정독 필수.
```

#### 15.5 중요도 (Importance Tier)
| Tier | 색상 (Importance Highlight 모드) | 의미 | 예시 단락 |
| --- | --- | --- | --- |
| **Critical** | `--hl-contribution` (노랑) | 논문 주장의 핵심 근거. 정독 필수 | Contribution, Main result, Motivation, Method core |
| **Standard** | 색상 없음 (default) | 주장을 보충. 정독 권장 | Detailed method, Related work |
| **Skippable** | 옅은 회색 (배경 dim) | 부수적 맥락 / 일반론 | Background recap, Acknowledgments, Boilerplate |

#### 15.6 4가지 사용자 모드
| 모드 | 동작 | 단축키 |
| --- | --- | --- |
| **Inline Hint** (default) | 단락 옆 💡 배지, 호버/클릭 인터랙션 | `H` |
| **Importance Highlight** | 단락 배경색을 중요도로 칠함 | `I` |
| **Quick Skim** | 본문 단락을 한 줄 요점으로 임시 대체 (5분 스캔용) | `K` |
| **Side Panel** | 모든 단락 요약을 우측 패널 시퀀스로 | (탭 클릭) |

이 4개 모드는 **동시 활성 가능**. 예: Importance Highlight + Side Panel = 색칠된 본문을 보며 우측 패널로 빠르게 인덱싱.

#### 15.7 처리 파이프라인
```
[Ingestion 시 1회 사전 생성]
   ↓
[PDF 파서 → 섹션/단락 분리 + paragraph_id 부여]
   ↓
[Domain Classifier (논문 도메인)]
   ↓
[Batch LLM 호출 — 단락 10개씩 묶음]
   - 입력: 단락 본문 + 섹션명 + 도메인 + 보존용어 + 인접 단락 (앞뒤 1개)
   - 출력: JSON {tldr, concepts, importance, related_paragraphs}
   ↓
[Importance Scorer (병렬)]    # 별도 가벼운 호출
   ↓
[Cross-link Builder]          # ¶ ↔ ¶ ↔ Figure 연결 그래프 구축
   ↓
[보존 용어 후처리 (§5.8)]
   ↓
[캐시 저장 — paper_id + paragraph_id + lang + detail]
```

#### 15.8 비용 통제 ⚠️ (가장 중요한 설계 제약)
**단락 수가 많아 비용 폭증 위험 → 다음 전략으로 통제:**

| 전략 | 효과 |
| --- | --- |
| **경량 모델 사용** (`claude-haiku-4.5` / `gemini-2.5-flash`) | 토큰당 비용 ~1/20 |
| **Batch 처리** (10단락/호출) | 호출 수 1/10 |
| **단락 본문 그대로 + 컨텍스트 최소화** | 입력 토큰 절감 |
| **사전 생성 + 영구 캐시** | 재방문은 $0 |
| **Lazy mode 옵션** | 토글 ON 시점에 생성, OFF면 비용 0 |

평균 100단락 논문 기준 사전 생성 비용 추정:
- 한 batch (10단락) = 입력 ~3000토큰 + 출력 ~1500토큰 (Haiku)
- 10 batches × $0.005 ≈ **~$0.05 / 논문**
- Pro 사용자 월 100편 가정 = $5/사용자 LLM 비용

#### 15.9 모델 / 설정 (config/yaml)
```yaml
# config/models.yaml
tasks:
  paragraph_description:
    provider: openrouter
    model: anthropic/claude-haiku-4.5      # 비용 우선
    fallback:
      - { provider: gemini, model: gemini-2.5-flash }

  paragraph_importance:
    provider: openrouter
    model: anthropic/claude-haiku-4.5
    fallback:
      - { provider: gemini, model: gemini-2.5-flash-lite }

# config/hyperparameters.yaml
tasks:
  paragraph_description:
    temperature: 0.3
    max_tokens: 600                # 단락 1개당 짧은 응답
    json_mode: true
    batch_size: 10                 # 한 번에 묶어서 처리
    include_neighbor_context: 1    # 앞뒤 1단락 컨텍스트로 포함

  paragraph_importance:
    temperature: 0.0
    max_tokens: 100
    json_mode: true
```

#### 15.10 UI 상세 (Inline Hint 모드)
```
본문 영역:
┌──────────────────────────────────────────────────────────┐
│ Recent advances in vision-language models have enabled   │ 💡  ← 호버 시 요점, 클릭 시 펼침
│ mobile GUI agents to perceive visual interfaces and      │
│ execute user instructions...                             │
└──────────────────────────────────────────────────────────┘
                                                              ↓ 클릭

본문 영역 (펼침 후):
┌──────────────────────────────────────────────────────────┐
│ Recent advances in vision-language models have enabled   │ 💡
│ mobile GUI agents to ...                                 │
│                                                          │
│ ╭──────────────────────────────────────────────────╮     │
│ │ 📌 VLM이 GUI Agent를 가능하게 했지만 행동 예측은 │     │
│ │    여전히 부족하다는 문제 제기.                  │     │
│ │                                                  │     │
│ │ 🔍 핵심 개념                                     │     │
│ │   • VLM (Vision-Language Model)                  │     │
│ │   • action consequence                           │     │
│ │                                                  │     │
│ │ 🔗 → ¶7 (해결책 제시)  ↔ Figure 1                │     │
│ │ 🎯 Critical · 논문 동기                          │     │
│ │                       [더 자세히] [↗ Chat]      │     │
│ ╰──────────────────────────────────────────────────╯     │
└──────────────────────────────────────────────────────────┘
```

**Importance Highlight 모드** (다른 동작):
```
[Critical 단락 — 노란 배경 강조]
[Standard 단락 — 색상 없음]
[Skippable 단락 — 회색 dim, 호버 시만 정상 색상]
```

**Quick Skim 모드** (다른 동작):
```
[원본 단락이] → [한 줄 요점으로 임시 대체]
"VLM이 GUI Agent를 가능하게 했지만 ..." 한 줄로 표시.
원문 보기는 클릭으로 토글.
```

#### 15.11 우측 패널 `📝 Paragraph Insights` 탭
```
┌──────────────────────────────────────┐
│ 📝 Paragraph Insights                │
├──────────────────────────────────────┤
│ 🔴 Critical 단락만 보기 [토글]        │
│                                      │
│ ¶1 (§1 Introduction)        🎯 Crit. │
│   VLM이 GUI Agent를 가능...          │
│   [→ 본문 점프]                      │
│                                      │
│ ¶2 (§1 Introduction)        ─        │
│   기존 모바일 world model은...        │
│                                      │
│ ¶3 (§1 Introduction)        🎯 Crit. │
│   World Model을 도입함으로써...       │
│                                      │
│ ¶4 (§1 Introduction)        ░ Skip   │
│   본 연구의 구성은 다음...            │
│                                      │
│ ▼ Section 2: Background              │
│ ▼ Section 3: Method                  │
│ ...                                  │
└──────────────────────────────────────┘
```

#### 15.12 다른 기능과의 연동
| 연동 대상 | 관계 |
| --- | --- |
| **F-06 Summary** | F-15 결과를 Section Summary 생성 입력으로 사용 |
| **F-10 Auto Highlight** | Critical 단락의 핵심 문장만 자동 하이라이트 (중복 회피) |
| **F-13 Podcast** | 중요도가 Podcast 챕터 구성에 반영 (Skippable은 건너뜀) |
| **F-07 Preview** | 단락 간 연결 정보가 cross-ref preview 데이터로 사용 |
| **F-11 Markup** | 사용자 노트에 단락 요점이 자동 첨부 옵션 |
| **F-15 ↔ F-14** | "이 단락이 설명하는 figure" 자동 매핑 |

#### 15.13 캐시
- 키: `(paper_id, paragraph_id, content_language, detail_level)`
- TTL: 영구 (원문 불변)
- 언어별 / 상세도별 독립 캐시
- 사용자 follow-up은 캐시하지 않음

#### 15.14 무료 / 유료 제한
| 플랜 | 단락 사전 생성 |
| --- | --- |
| Free | 일 50단락 (~1-2편) |
| Pro | 무제한 |
| Team | 무제한 + 팀 공유 캐시 |

#### 15.15 차별 포인트 (vs Moonlight / NotebookLM / SciSpace)
| 항목 | Moonlight | NotebookLM | SciSpace | **PaperLight (F-15)** |
| --- | --- | --- | --- | --- |
| 단락별 한 줄 요점 | △ | ❌ | △ | **✅** |
| 단락 **중요도** 자동 분류 (Critical/Standard/Skippable) | ❌ | ❌ | ❌ | **✅ (유일)** |
| 단락 ↔ 단락 ↔ Figure **연결 그래프** | ❌ | ❌ | ❌ | **✅ (유일)** |
| **Quick Skim Mode** (본문 한 줄 요점 임시 대체) | ❌ | ❌ | ❌ | **✅ (유일)** |
| Importance Highlight 색상 시각화 | ❌ | ❌ | ❌ | **✅** |
| 비용 통제 (Batch + Haiku/Flash) | ❌ | ❌ | ❌ | **✅** |

---

## 5. UI/UX 디자인

### 5.1 디자인 원칙
1. **친숙함 (Familiarity)** — PDF 뷰어 사용자가 학습 곡선 없이 적응
2. **부드러움 (Softness)** — 둥근 모서리, 따뜻한 색상, 친근한 마이크로카피
3. **밀도 조절 (Density Control)** — 정보가 많지만 한 번에 보이지 않게, 토글로 관리
4. **흐름 보존 (Flow Preservation)** — 본문에서 시선을 빼앗지 않음. 팝오버 우선, 모달 최소화
5. **온보딩 친화** — 빈 상태(empty state)에서도 무엇을 할지 명확

### 5.2 전체 레이아웃 (3-Column, Collapsible)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ① Top Toolbar (56px)                                                        │
│  [Logo] [◀TOC] [Thumbs] [🔍]  [페이지 1/45] [- 100% +] [🌐ko ▾] [⚡] [⋯] [👤]│
├────────────┬────────────────────────────────────┬────────────────────────────┤
│ ② Left     │   ③ Center (PDF + Translation)    │   ④ Right AI Panel         │
│  Sidebar   │  ┌──────────────────┬───────────┐  │  ┌──────────────────────┐  │
│ [◀ 접기]   │  │                  │ 번역 패널  │  │  │ [Tab: 📖🎧💬🔖⭐] [▶]│  │
│            │  │   PDF 페이지      │ (병행)    │  │  ├──────────────────────┤  │
│ - TOC      │  │                  │           │  │  │ 키워드 사전           │  │
│ - Thumbs   │  │                  │           │  │  │ 3줄 요약              │  │
│ - 모드토글   │  │                  │           │  │  │ 요약                  │  │
│            │  │                  │           │  │  │ Podcast / Chat 등    │  │
│ (180px,    │  └──────────────────┴───────────┘  │  └──────────────────────┘  │
│  접힘 0px) │                                    │  (380px, 접힘 48px Rail)  │
└────────────┴────────────────────────────────────┴────────────────────────────┘
```

**비율**: Left 12% / Center 58% / Right 30% (1440px 기준)
**반응형**: <1024px에서는 Right Panel이 우측에서 슬라이드 인/아웃하는 Drawer로 전환
**접힘 모드**: 좌측은 완전 hide (0px), 우측은 48px Icon-Rail 유지 (탭 아이콘만 노출)

#### 5.2.1 패널 접기/펴기 (Collapsible Panels) ⭐

**상태 (4가지)**
| 상태 | 단축키 | 설명 |
| --- | --- | --- |
| Both Open (default) | — | 좌·우 모두 펼침 |
| Left Collapsed | `[` | 좌측 hide, Center 확장 |
| Right Collapsed | `]` | 우측 Icon-Rail만, Center 확장 |
| Focus Mode | `\` | 양쪽 다 접음, PDF에 완전 몰입 |

**좌측 패널 접힘 동작**
- 0px로 완전히 hide
- 상단 툴바의 `[◀ TOC]` 버튼으로 재오픈
- 접힌 동안에도 단축키 `[`로 토글
- 사용자의 마지막 모드 (TOC vs 썸네일) 기억

**우측 패널 접힘 동작**
- 48px 너비의 **Icon-Rail** 유지 (모든 탭 아이콘이 세로 정렬로 노출)
- 아이콘 클릭 시 해당 탭을 펼치며 자동 펼침
- AI 응답이 스트리밍 중일 때 알림 도트 (●) 표시
- Podcast 재생 중이면 작은 진행률 인디케이터 표시

**상태 저장**
- 사용자 단위로 `localStorage` + 서버 동기화
- 디바이스 간 (모바일/데스크탑) 별도 저장 (모바일은 기본 Focus Mode)
- 논문별 override 가능 (예: 어떤 논문은 항상 양쪽 접힘으로 열기)

**애니메이션**
- 폭 전환: 250ms `cubic-bezier(0.4, 0, 0.2, 1)`
- 콘텐츠 fade in/out: 150ms
- 접히는 중 Center 영역은 LayoutEffect로 PDF 재렌더링 호출 → 가독성 유지

**Edge Cases**
- 좌·우 모두 접힌 상태에서 AI 응답 도착 → 우측 Icon-Rail의 해당 탭에 알림 도트
- 키보드 입력 중 (`textarea` focus 시)에는 단축키 비활성화
- 사용자 선호도 분석을 위해 토글 이벤트를 익명 로깅

### 5.3 컴포넌트 상세

#### ① Top Toolbar
| 위치 | 요소 | 설명 |
| --- | --- | --- |
| 좌측 | 로고 | 클릭 시 라이브러리로 이동 |
| 좌측 그룹 | **좌측 사이드바 토글** / 썸네일 모드 토글 / 검색 | 첫 번째 버튼이 좌측 패널 접기/펴기 (단축키 `[`) |
| 중앙 | 페이지 인디케이터 + 줌 | 입력 가능 (`3/45`) |
| 중앙 우측 | 빠른 액션 토글 | Auto Highlight / Image Description (F-14) / **Paragraph Description (F-15)** / **Quick Skim** / Auto Translate ON/OFF |
| 우측 그룹 | **🌐 언어 셀렉터** | Content Language 빠른 전환 (§5.7) |
| 우측 | 더보기(⋯) / 사용자 아바타 / **우측 패널 토글 (`]`)** | 마지막 버튼이 우측 패널 접기/펴기 |

> Moonlight UI에서 `오토 하이라이트`, `이미지 설명`, `자동 번역` 토글이 상단에 노출된 패턴을 차용. 가장 자주 켜고 끄는 옵션을 한 번의 클릭으로 접근.

#### ② Left Sidebar
- **두 가지 뷰 토글**: TOC 모드 / 썸네일 모드 (Moonlight 스크린샷 그대로)
- TOC 모드: 섹션 트리, 현재 보고 있는 섹션 하이라이트, 진행률 바
- 썸네일 모드: 페이지 미니 이미지 + 페이지 번호
- 사이드바 접기 버튼

#### ③ Center: PDF + Translation
- **분할 가능 (Split View)**: 원문만 / 원문+번역 병행 / 번역만
- 병행 모드에서 **스크롤 동기화** (한쪽 스크롤하면 반대쪽도 따라옴)
- 번역 패널 상단: 자동 ON 표시, 페이지 번호
- 번역 패널 하단: "번역 품질이 만족스러우셨나요?" + 👍/👎 (Moonlight UI 차용)

#### ④ Right AI Panel — 가장 정보 밀집된 영역
**상단 탭 (아이콘)**:
- 📖 **Summary** (요약 / 키워드 / 3줄 요약 / Figures & Tables 인덱스)
- 📝 **Paragraph Insights** (F-15 — 단락별 요점, 중요도 필터, Side Panel 모드)
- 🎧 **Podcast** (생성 / 플레이어)
- 💬 **Chat** (토론)
- 🔖 **Notes** (내 노트 / 하이라이트)
- ⭐ **Related** (추천 논문 / 인용 네트워크)

**Summary 탭 (디폴트)** — 아코디언 형태로 접기/펴기:
```
▼ 키워드 사전
  [Mobile World Model] [GUI Agents] [Prediction Formats] ...
  (각 칩 클릭 → 본문에서 해당 용어 첫 등장 위치로 점프)

▼ 3줄 요약
  1. 이 연구는 ...
  2. ...
  3. ...

▼ 한 줄 요약 (TL;DR)
  "이 논문은 X를 Y로 풀어 Z를 달성"

▼ 요약 (Section by Section)
  - Introduction: ...
  - Method: ...

▼ 기여점
  • ...
  • ...

▼ Figures & Tables  (F-14 인덱스)
  📊 Figure 1: 결과 시각화        [→ 보기]
  📊 Figure 2: GUI state 비교    [→ 보기]
  📋 Table 1: 성능 비교          [→ 보기]
  📋 Table 2: Ablation           [→ 보기]
  (각 항목 클릭 시 본문 점프 + 설명 popover 자동 열림)
```

**Podcast 탭**:
```
[옵션 카드]
  언어: [한국어 ▾]    길이: [Standard ▾]    수준: [Practitioner ▾]
  보이스 A: [Alloy ▾]  보이스 B: [Echo ▾]
  포커스: [Overall ▾]
  [🎧 Generate Podcast]   (예상 비용: 0.4 credits)

[생성 완료 후]
  ┌────────────────────────────────────────┐
  │  ▶ 00:12 / 10:34   [━━━●━━━━━] 1.0x   │
  │  📍 현재: "Method - World Model 구조"     │
  │  [⏮ Prev] [⏯] [⏭ Next]                │
  │  [📄 Transcript ▾] [⬇ MP3]            │
  └────────────────────────────────────────┘
  Chapters:
    00:00 Hook
    01:20 Background
    03:00 Method ← 재생 중
    06:10 Result
    08:30 Critique
    09:50 Wrap-up
```

**Chat 탭**:
- 메시지 영역 (스트리밍 응답)
- 인용은 작은 페이지 뱃지 (`p.3`)로 표시, 클릭 시 본문 점프
- 하단:
  - **퀵 칩**: `이 논문의 핵심이 뭐야?` `기존 연구랑 뭐가 달라?` `한계점이 뭐야?` (Moonlight 패턴)
  - 입력창: `무엇이든 질문하세요`
  - 옵션: `[+ Add Reference]` (다른 논문 끌어오기) / `[Gemini 2.5 ▾]` (모델 선택)

### 5.4 디자인 시스템

#### 색상 (Color Tokens)
```css
/* 친숙함을 위해 채도를 낮춘 파스텔 톤 */
--brand-primary: #7C5CFC;        /* 부드러운 보라 (Moonlight 톤 차용) */
--brand-primary-soft: #EFE9FF;
--bg-base: #FAFAFB;
--bg-surface: #FFFFFF;
--bg-muted: #F4F4F6;
--border-subtle: #E8E8EC;
--text-primary: #1A1A1F;
--text-secondary: #5B5B66;
--text-muted: #8B8B96;

/* 하이라이트 카테고리 */
--hl-contribution: #FFF4C2;  /* 부드러운 노랑 */
--hl-method:       #DEEBFF;  /* 부드러운 파랑 */
--hl-result:       #D6F3E0;  /* 부드러운 초록 */
--hl-limitation:   #FFE0E0;  /* 부드러운 빨강 */

/* 다크 모드 */
--dark-bg-base: #15151A;
--dark-bg-surface: #1E1E24;
/* ... */
```

#### 타이포그래피
- **한글**: Pretendard (가독성 우수, 한국어 친화)
- **영문**: Inter
- **모노스페이스**: JetBrains Mono (수식/코드)
- 본문 16px / 라인하이트 1.6 / 사이드 패널 14px

#### 모서리 & 그림자
- 카드: `border-radius: 12px`
- 버튼: `border-radius: 8px`
- 입력: `border-radius: 10px`
- 그림자: 최소화. 강한 그림자 대신 `border: 1px solid var(--border-subtle)`

#### 아이콘
- **Lucide Icons** (오픈소스, Tailwind 친화)
- 스트로크 1.5px (얇고 친근)

#### 마이크로 인터랙션
- 호버: 100ms ease-out, 배경색 변화
- 클릭: 80ms scale(0.98)
- 패널 열림/닫힘: 200ms cubic-bezier
- 로딩: skeleton + shimmer (스피너 지양)

### 5.5 친숙성을 위한 5가지 디테일

1. **빈 상태 일러스트** — 라이브러리 비었을 때 큰 일러스트 + "첫 논문을 올려보세요" 친근한 마이크로카피
2. **온보딩 코치마크** — 처음 PDF를 열면 텍스트 선택부터 채팅까지 5단계 코치마크 (Skip 가능)
3. **친근한 에러 메시지** — "앗, 잠시 길을 잃었어요. 다시 시도해볼까요?" 형식
4. **반응 표시 (Reaction)** — AI 응답에 👍/👎 + 자유 피드백
5. **소소한 칭찬** — 100편 읽으면 "정독러 100" 배지, 가벼운 게이미피케이션

### 5.6 추천 추가 기능 (12개)

| # | 기능 | 한 줄 설명 | 우선순위 |
| --- | --- | --- | --- |
| 1 | **AI Podcast** ⭐ | 2인 대담 팟캐스트 자동 생성 | **P0 (F-13에 정의)** |
| 2 | **Mind Map** | 논문 내 개념들 간 관계를 노드 그래프로 시각화 | P1 |
| 3 | **Flashcard 생성** | 논문 핵심을 Anki 형식 카드로 export | P1 |
| 4 | **Code Lab** | 논문 내 알고리즘/수식을 실행 가능한 Python 코드로 변환 + 노트북 환경 제공 | P2 |
| 5 | **비교 모드 (Compare)** | 2~3편 논문을 나란히 놓고 method/result 표로 자동 비교 | P1 |
| 6 | **인용 네트워크** | 이 논문이 인용한 + 이 논문을 인용한 논문 그래프 시각화 | P2 |
| 7 | **Voice Q&A** | 음성으로 질문 → 음성으로 답변 (출퇴근/운동 시) | P2 |
| 8 | **브라우저 익스텐션** | arXiv / Google Scholar에서 원클릭으로 PaperLight에 추가 | P1 |
| 9 | **Reading Progress** | 어디까지 읽었는지 자동 추적, 시간/단어수 통계 | P2 |
| 10 | **Reproducibility 체크** | Papers with Code 연동, 코드/데이터 링크 자동 표시, 주장-실험 매칭 | P2 |
| 11 | **Daily Digest** | 라이브러리 기반 매일 아침 신착 논문 Slack/Email 발송 | P1 |
| 12 | **Focus Mode** | 한 단락씩 보여주며 AI 코멘트와 함께 정독 가이드 (집중 모드) | P2 |

### 5.7 콘텐츠 언어 설정 (Content Language) ⭐

#### 5.7.1 언어의 3개 레이어
PaperLight는 언어를 다음 3개 **독립 레이어**로 관리한다. 분리해야 하는 이유: UI는 한국어로 쓰지만 AI 콘텐츠는 영어로 받고 싶은 사용자(글로벌 동료와 공유 등)가 존재.

| 레이어 | 정의 | 기본값 | 적용 대상 |
| --- | --- | --- | --- |
| **UI Language** | 메뉴/버튼/안내문 등 인터페이스 텍스트 | `ko` | i18n 리소스 |
| **Content Language** ⭐ | AI 생성 콘텐츠 (Summary / Chat / Explanation / Podcast 등) | `ko` | 모든 AI 출력 |
| **Translation Target** | 원문 번역 결과 언어 | Content Language 따름 | F-02 Translation |

#### 5.7.2 지원 언어 (v1)
| 코드 | 언어 | 비고 |
| --- | --- | --- |
| `ko` | 한국어 | **Default** |
| `en` | English | |
| `ja` | 日本語 | |
| `zh-CN` | 简体中文 | |
| `es` | Español | |

향후 추가: `de`, `fr`, `vi`, `id`, `pt`.

#### 5.7.3 우선순위 (Override Hierarchy)
```
Per-Paper 설정  >  User Default  >  System Default (ko)
```

#### 5.7.4 UI
- **글로벌 설정**: `Settings > Language Preferences` — 3개 셀렉터
- **빠른 전환**: 상단 툴바 우측 🌐 아이콘 → 드롭다운으로 **Content Language**만 빠르게 변경
- **논문별 override**: 우측 패널 상단 `⋯` 메뉴 > "이 논문의 언어 설정" → 활성화 시 글로벌과 무관하게 동작
- 변경 즉시 적용 (이미 생성된 Summary / Podcast는 캐시로 유지하되, "현재 언어로 재생성" 버튼 노출)

#### 5.7.5 적용 범위
**Content Language를 따르는 출력**
- ✅ Summary (TL;DR / 3줄 요약 / Section by Section / 기여점)
- ✅ Keyword Dictionary (용어 + 설명)
- ✅ Translation (Target Language)
- ✅ AI Chat 응답
- ✅ Explanation (수식/도표/정의)
- ✅ Auto Highlight 카테고리 레이블
- ✅ Podcast 대본 + TTS
- ✅ Follow-up 질문 추천
- ✅ Recommendation 사유

**언어 변환 대상이 아닌 것**
- ❌ 사용자 노트 (사용자가 직접 입력)
- ❌ 원본 PDF 본문
- ❌ 인용 마커 `[12]`, `(Smith, 2023)`
- ❌ 코드 / 수식 / 고유명사 (§5.8 전문 용어 보존 적용)

#### 5.7.6 구현 메모
- 모든 LLM 프롬프트 시스템 메시지에 `{content_language}` placeholder 주입
- Content Language는 ISO 639-1 코드로 통일 (`ko`, `en`, `ja`, `zh-CN`, `es`)
- 프롬프트 템플릿은 `config/prompts/*.yaml`에서 관리 (§7.5)

### 5.8 전문 용어 보존 (Technical Term Preservation) ⭐

#### 5.8.1 원칙
모든 번역 / 요약 / 설명에서 **전문 용어와 고유명사는 원어(주로 영어) 그대로 유지**한다.

```
❌ Bad : "이 논문은 변환기 구조와 주의 메커니즘을 사용하여..."
✅ Good: "이 논문은 Transformer 구조와 Attention 메커니즘을 사용하여..."
```

이유:
1. 연구자/실무자가 영어 문헌 / 코드 / 검색과의 연결성 유지
2. 직역된 한국어 용어는 표준화가 안 되어 오히려 혼란
3. 학습 / 인용 / 토론 친화성

#### 5.8.2 보존 대상 카테고리
| 카테고리 | 예시 |
| --- | --- |
| 모델 / 아키텍처 이름 | Transformer, BERT, GPT, ResNet, U-Net, Diffusion |
| 기술 개념 | attention, embedding, fine-tuning, in-context learning, prompt |
| 약어 | SOTA, OOD, MLP, GPU, RLHF, KV-cache, MoE |
| 데이터셋 / 벤치마크 | ImageNet, GLUE, MMLU, AndroidWorld, HumanEval |
| 학회 / 저널 | NeurIPS, ICML, CVPR, ACL, ICLR |
| 라이브러리 / 도구 | PyTorch, JAX, Transformers, Hugging Face, vLLM |
| 고유명사 | Stanford, DeepMind, OpenAI, Anthropic |
| 평가지표 | F1, BLEU, mAP, accuracy, perplexity |

#### 5.8.3 글로서리 시스템

**파일 구조** (`config/glossary/`)
```
config/glossary/
├── _core.yaml              # 모든 도메인 공통 (SOTA, GPU 등)
├── cs_ai_ml.yaml           # AI / ML
├── cs_systems.yaml         # 시스템 / 네트워크
├── cs_security.yaml        # 보안
├── bio.yaml                # 생물학
├── physics.yaml            # 물리학
└── user_custom.yaml        # 사용자 추가 (런타임 생성)
```

**스키마 예시 (`cs_ai_ml.yaml`)**
```yaml
version: "2026.05.19"
domain: "Computer Science - AI / ML"
terms:
  - term: "Transformer"
    aliases: ["transformer", "Transformers", "Transformer architecture"]
    preserve: true
    explanation:
      ko: "어텐션 메커니즘 기반 신경망 구조 (Vaswani et al., 2017)"
      en: "A neural network architecture based on attention mechanism."
      ja: "アテンション機構に基づくニューラルネットワーク構造"

  - term: "attention"
    aliases: ["self-attention", "cross-attention", "Attention"]
    preserve: true
    explanation:
      ko: "입력의 각 부분에 가중치를 할당하는 메커니즘"

  - term: "SOTA"
    aliases: ["State-of-the-Art", "state of the art", "state-of-the-art"]
    preserve: true
    explanation:
      ko: "현재까지의 최고 성능 (State-of-the-Art)"

  - term: "OOD"
    aliases: ["Out-of-Distribution", "out of distribution"]
    preserve: true
    explanation:
      ko: "학습 분포 바깥의 데이터 (Out-of-Distribution)"
```

#### 5.8.4 처리 파이프라인
```
[원문 텍스트]
   ↓
[Domain Classifier]         # 논문 도메인 분류 (Ingestion 시 1회)
   ↓
[Glossary Loader]           # 도메인별 glossary + _core + user_custom 로드
   ↓
[Term Detector]             # 원문에서 보존 대상 용어 탐지 (대소문자/형태변형 고려)
   ↓
[Prompt Composer]           # LLM 프롬프트에 보존 규칙 + 용어 리스트 주입
   ↓
[LLM Generation]            # 응답 생성
   ↓
[Post-Processor]            # 잘못 번역된 용어를 원어로 복구 (안전망)
   ↓
[Tooltip Enricher]          # 각 보존 용어에 한국어 설명 tooltip 메타데이터 부착
   ↓
[Output]
```

#### 5.8.5 LLM 프롬프트 가이드라인 (공통 시스템 메시지)
모든 작업 프롬프트의 system 메시지에 다음 블록이 주입된다.

```text
## 언어 규칙
1. 모든 응답은 {content_language}로 작성합니다.
2. 자연스럽고 정확한 학술 문체를 사용합니다.

## 전문 용어 보존 규칙 (중요)
다음 용어들은 번역하지 말고 **원어 그대로** 사용합니다:
{preserved_terms_list}

또한 다음 카테고리는 항상 원어 유지:
- 모델/아키텍처 이름 (BERT, GPT, ResNet, ...)
- 약어 (SOTA, OOD, GPU, RLHF, ...)
- 데이터셋/벤치마크 (ImageNet, GLUE, ...)
- 라이브러리/도구 (PyTorch, JAX, ...)
- 학회/저널 (NeurIPS, ICML, ...)
- 고유명사 (회사명, 기관명, 인명)

예시:
- ❌ "어텐션 메커니즘을 사용한 변환기"
- ✅ "Attention 메커니즘을 사용한 Transformer"

## 인용 규칙
- 본문 인용 시 페이지 번호 표시: "...라고 본문에서 언급됩니다 (p.3)"
- 본문 외 지식은 사용하지 않습니다.
```

#### 5.8.6 UI 표현
- 보존된 영어 용어는 본문에서 자연스럽게 표시 (별도 스타일링 없음)
- 옵션: 호버 시 한국어 설명 tooltip 노출 (Settings > "용어 툴팁 표시")
- 사용자 우클릭 메뉴: "이 용어를 보존 목록에 추가" → `user_custom.yaml`에 추가

#### 5.8.7 사용자 커스터마이즈
- `Settings > Glossary` 페이지에서 직접 용어 추가 / 삭제 / 별칭 관리
- 라이브러리 분석을 통해 자주 등장하는 미등록 용어 자동 추천 ("이 용어를 추가하시겠어요?")

---

## 6. 사용자 플로우

### 6.1 핵심 동선: 논문 1편 정독
```
업로드 → (BG: 파싱+임베딩+Summary+Auto-Highlight)
  → Summary 탭 자동 펼침 (TL;DR 먼저 노출)
  → 사용자가 본문 정독 시작
      ├ 수식 클릭 → Explanation 팝오버
      ├ 텍스트 선택 → Translate 또는 Ask
      ├ 인용 [12] 호버 → 참고문헌 카드
      └ 노트 작성
  → 추천 논문 (Related 탭)
```

### 6.2 새 동선: 출퇴근 청취 (Podcast)
```
[지하철 안, 스마트폰]
  앱 열기 → 라이브러리 → 어제 추가한 논문 5편
  → 각 논문 우측에 [🎧 Generate] (또는 이미 생성된 [▶ Play])
  → Standard 옵션으로 일괄 생성 (한국어, 10분)
  → 큐(Queue) 모드로 5편 연속 재생
  → 흥미로운 부분에서 [Save] → "오늘 밤 정독 리스트"에 자동 추가
```

### 6.3 새 동선: 빠른 스크리닝 (10편을 30분 안에)
```
arXiv 신착 5~10편 ID 일괄 입력
  → 모두 백그라운드 파싱 + Summary + 1분짜리 Short Podcast 자동 생성
  → 사용자: TL;DR + 1분 Podcast 듣고 정독할 1~2편 선별
  → 나머지는 Archive
```

### 6.4 새 동선: Critical 단락만 정독 (F-15 활용)
```
선별된 1편 정독 진입
  → 상단 툴바 `📝 단락 설명` ON + `Importance Highlight` 모드
  → 본문에서 노란 배경(Critical) 단락만 시각적으로 두드러짐
  → 사용자: Critical 단락만 정독 + 호버로 한 줄 요점 빠르게 확인
  → Skippable 단락은 시각적으로 회색 → 자연스러운 skip
  → 시간 절감: 100단락 중 ~20-30개만 정독 → 30분 정독이 10분으로
  → 막히는 부분은 단락 클릭 → 인라인 카드로 개념 해설
```

### 6.5 새 동선: Quick Skim (논문 5분 훑기)
```
새로 받은 논문 → `⚡ Quick Skim` 토글 ON
  → 본문이 모두 한 줄 요점으로 임시 대체됨
  → 사용자: 처음부터 끝까지 한 줄씩 빠르게 스크롤
  → 흥미로운 단락 클릭 → 원문 보기 토글 + 본문 확장
  → 5분 안에 논문 전체 흐름 파악 가능
```

---

## 7. 기술 아키텍처

### 7.1 High-Level
```
[Next.js Client]
     │  (SSE / WebSocket)
     ▼
[FastAPI Gateway]
   ├─ /api/papers/*
   ├─ /api/chat/*       (SSE 스트리밍)
   ├─ /api/podcast/*    (SSE + 오디오 스트리밍)
   ├─ /api/library/*
   └─ /api/auth/*
     │
     ▼
┌──────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Ingestion    │ Agent Orchestr.  │ Podcast Worker   │ Library Svc.     │
│ Worker       │ (LangGraph)      │ (Celery)         │ (CRUD)           │
└──────────────┴──────────────────┴──────────────────┴──────────────────┘
     │                  │                  │                  │
     └────────┬─────────┴──────────────────┴──────────────────┘
              ▼
┌──────────────────────────────────────────────────────────────┐
│ Storage: PostgreSQL / Qdrant / S3 / Redis                    │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ External: LLM Providers (via Provider Abstraction)           │
│   - OpenAI / Gemini / OpenRouter / TTS (OpenAI, ElevenLabs)  │
│   - Crossref / Semantic Scholar / arXiv                      │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Ingestion 파이프라인 (Python)
1. **파싱**: PyMuPDF (텍스트/BBox) + marker-pdf (레이아웃)
2. **메타데이터**: GROBID 또는 LLM 추출
3. **참고문헌 보강**: Crossref / Semantic Scholar
4. **청킹**: 섹션 단위 + 슬라이딩 윈도우 (512 토큰)
5. **임베딩**: `bge-m3` (셀프 호스팅) → Qdrant
6. **사전 생성 (캐시)**: Summary / Auto-Highlight / 키워드 사전

### 7.3 Agent 설계 (LangGraph)

#### 공용 에이전트
- Retriever, Reranker, Critique (환각 차단), Citation

#### 신규: Podcast Generation Graph
```
[Input: paper_id + options]
   ↓
[Outline Agent]              # 6~8개 챕터 outline
   ↓
[Script Writer Agent]        # 화자 A/B 대본
   ↓
[Critic Agent]               # 본문 근거 없는 발언 제거
   ↓
[Polish Agent]               # 자연스러운 추임새, 어조
   ↓
[TTS Dispatcher]             # 화자별 보이스 호출 (병렬)
   ↓
[Audio Stitcher (FFmpeg)]
   ↓
[Output: mp3, srt, chapters.json]
```

### 7.4 백엔드 디렉토리 구조
```
paperlight/
├── api/
│   ├── papers.py
│   ├── chat.py
│   ├── podcast.py            ← 신규
│   ├── library.py
│   └── auth.py
├── agents/
│   ├── common/
│   │   ├── retriever.py
│   │   ├── reranker.py
│   │   ├── critique.py
│   │   └── citation.py
│   ├── explanation_graph.py
│   ├── chat_graph.py
│   ├── summary_graph.py
│   ├── translation_graph.py
│   ├── highlight_graph.py
│   └── podcast_graph.py      ← 신규
├── providers/                ← 신규 (§7.5)
│   ├── base.py
│   ├── openai_provider.py
│   ├── gemini_provider.py
│   ├── openrouter_provider.py
│   ├── tts_openai.py
│   ├── tts_elevenlabs.py
│   └── router.py
├── ingestion/
│   ├── parser.py
│   ├── layout.py
│   ├── chunker.py
│   ├── embedder.py
│   └── pipeline.py
├── audio/                    ← 신규
│   ├── stitcher.py           # FFmpeg wrapper
│   └── srt_writer.py
├── services/
│   ├── library_service.py
│   ├── citation_service.py
│   └── recommendation.py
├── storage/
│   ├── db.py
│   ├── vector.py
│   └── object_store.py
├── schemas/
├── workers/
└── tests/

# 별도 루트의 운영 설정 (§7.5)
config/
├── models.yaml
├── hyperparameters.yaml
├── providers.yaml
├── glossary/
│   ├── _core.yaml
│   ├── cs_ai_ml.yaml
│   └── user_custom.yaml
├── prompts/
│   ├── summary.yaml
│   ├── chat.yaml
│   ├── explanation.yaml
│   ├── translation.yaml
│   └── podcast.yaml
└── loader.py
```

### 7.5 설정 시스템: `config/` YAML + `.env` 분리 ⭐

#### 7.5.1 설계 철학
| 항목 | `.env` | `config/*.yaml` |
| --- | --- | --- |
| **목적** | 비밀 정보 + 환경 의존 값 | 운영 정책 (모델 / 하이퍼파라미터 / 프롬프트 / 글로서리) |
| **변경 빈도** | 거의 없음 | 자주 (실험, 튜닝, A/B) |
| **Git 관리** | `.env.example`만 커밋 | 모두 커밋 (버전 관리 / 리뷰) |
| **운영자 권한** | DevOps | **Researcher / PM도 수정 가능** |
| **Hot Reload** | 불가 (서버 재시작) | **가능** (file watcher) |

이 분리의 이점:
- 코드 배포 없이 모델/하이퍼파라미터 교체 가능
- 환경(개발/스테이징/프로덕션)별 .env, 운영 정책은 공유
- 변경 이력이 Git에 남아 롤백 / 리뷰 / A/B 추적 용이

#### 7.5.2 디렉토리 구조
```
config/
├── models.yaml              # 작업별 어떤 모델을 쓸지
├── hyperparameters.yaml     # 작업별 temperature / max_tokens / top_p 등
├── providers.yaml           # 프로바이더 메타 (엔드포인트, 헤더, rate limit)
├── glossary/                # 전문 용어 보존 (§5.8)
│   ├── _core.yaml
│   ├── cs_ai_ml.yaml
│   └── user_custom.yaml
├── prompts/                 # 프롬프트 템플릿
│   ├── summary.yaml
│   ├── chat.yaml
│   ├── explanation.yaml
│   ├── translation.yaml
│   ├── figure_description.yaml
│   ├── table_description.yaml
│   ├── paragraph_description.yaml
│   ├── paragraph_importance.yaml
│   └── podcast.yaml
└── loader.py                # Pydantic 기반 로더 (§7.5.8)
```

#### 7.5.3 `.env` (비밀 + 환경값만)
```bash
# === API Keys (Secrets only) ===
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=xxx
OPENROUTER_API_KEY=sk-or-xxx
ELEVENLABS_API_KEY=xxx
COHERE_API_KEY=xxx

# === Infra ===
DATABASE_URL=postgresql://user:pass@localhost:5432/paperlight
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=paperlight-prod

# === App ===
APP_ENV=production           # development | staging | production
LOG_LEVEL=INFO
JWT_SECRET=...

# === Optional: 사용자 BYO 키 (개별 사용자가 자기 키를 쓸 때만) ===
# 기본은 위 키들을 공유. 사용자별 키는 DB에 암호화 저장.
```

#### 7.5.4 `config/models.yaml`
> 작업별로 어떤 프로바이더의 어떤 모델을 쓸지 매핑. 폴백 체인 포함.

```yaml
version: "2026.05.19"

# 기본 모델 (작업이 명시되지 않을 때)
default:
  provider: openrouter
  model: anthropic/claude-opus-4.7

# 작업별 매핑
tasks:
  summary:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }
      - { provider: gemini, model: gemini-2.5-pro }

  chat:
    provider: gemini
    model: gemini-2.5-pro
    fallback:
      - { provider: openrouter, model: anthropic/claude-sonnet-4.6 }

  podcast_outline:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }

  podcast_script:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }

  podcast_critique:
    provider: gemini
    model: gemini-2.5-pro

  translation:
    provider: gemini
    model: gemini-2.5-flash
    fallback:
      - { provider: openai, model: gpt-5-mini }

  explanation:
    provider: openai
    model: gpt-5
    fallback:
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }

  figure_description:                  # F-14: Vision LLM 필수
    provider: openai
    model: gpt-5
    fallback:
      - { provider: gemini, model: gemini-2.5-pro }
      - { provider: openrouter, model: anthropic/claude-opus-4.7 }

  table_description:                   # F-14: Table은 Gemini가 비용/성능 균형 우수
    provider: gemini
    model: gemini-2.5-pro
    fallback:
      - { provider: openai, model: gpt-5 }

  paragraph_description:               # F-15: 비용 우선, 경량 모델
    provider: openrouter
    model: anthropic/claude-haiku-4.5
    fallback:
      - { provider: gemini, model: gemini-2.5-flash }

  paragraph_importance:                # F-15: 중요도만 분류, 가장 가벼운 모델
    provider: openrouter
    model: anthropic/claude-haiku-4.5
    fallback:
      - { provider: gemini, model: gemini-2.5-flash-lite }

  critique:
    provider: openrouter
    model: anthropic/claude-haiku-4.5

  classifier:
    provider: openrouter
    model: anthropic/claude-haiku-4.5

  highlight:
    provider: openrouter
    model: anthropic/claude-haiku-4.5

  domain_classifier:        # 논문 도메인 분류 (글로서리 선택용)
    provider: openrouter
    model: anthropic/claude-haiku-4.5

# 임베딩
embedding:
  provider: openai
  model: text-embedding-3-large
  fallback:
    - { provider: local, model: bge-m3 }

# 리랭킹
reranker:
  provider: local
  model: bge-reranker-v2-m3
  fallback:
    - { provider: cohere, model: rerank-multilingual-v3.0 }

# TTS (Podcast용)
tts:
  default_provider: openai
  providers:
    openai:
      model: tts-1-hd
      voice_a: alloy
      voice_b: echo
    elevenlabs:
      voice_a_id_env: ELEVENLABS_VOICE_A_ID
      voice_b_id_env: ELEVENLABS_VOICE_B_ID
      model: eleven_multilingual_v2
```

#### 7.5.5 `config/hyperparameters.yaml`
> models.yaml의 task 키와 1:1 대응. temperature, max_tokens, top_p, retry 등.

```yaml
version: "2026.05.19"

# 모든 작업의 기본값 (작업별로 override)
defaults:
  temperature: 0.7
  top_p: 1.0
  max_tokens: 4096
  timeout_sec: 60
  retry_max: 3

# 작업별 override
tasks:
  summary:
    temperature: 0.3          # 사실 위주, 변동성 낮게
    max_tokens: 2000
    json_mode: true

  chat:
    temperature: 0.6
    max_tokens: 3000
    stream: true

  translation:
    temperature: 0.2          # 일관성 중요
    max_tokens: 4000

  explanation:
    temperature: 0.4
    max_tokens: 1500

  figure_description:           # F-14
    temperature: 0.3            # 그래프 해석은 사실 위주
    max_tokens: 2500
    json_mode: true             # 서브플롯별 구조화 출력
    detail_levels:              # 사용자 옵션 (런타임 override)
      brief:    { max_tokens: 600 }
      standard: { max_tokens: 2500 }
      deep:     { max_tokens: 4500 }

  table_description:            # F-14
    temperature: 0.2
    max_tokens: 2000
    json_mode: true

  paragraph_description:        # F-15: Batch 처리 (10단락/호출)
    temperature: 0.3
    max_tokens: 600             # 단락 1개당 짧은 응답
    json_mode: true
    batch_size: 10              # 한 batch에 10단락 묶어 호출 → 호출 수 1/10
    include_neighbor_context: 1 # 앞뒤 1단락 컨텍스트 포함

  paragraph_importance:         # F-15: 중요도만 분류
    temperature: 0.0
    max_tokens: 100
    json_mode: true
    batch_size: 20              # 더 가벼우므로 더 큰 batch

  podcast_outline:
    temperature: 0.6
    max_tokens: 1500
    json_mode: true

  podcast_script:
    temperature: 0.75         # 자연스러움, 변동성 약간 높게
    max_tokens: 6000

  podcast_critique:
    temperature: 0.2
    max_tokens: 2000
    json_mode: true

  critique:
    temperature: 0.1
    max_tokens: 1000

  classifier:
    temperature: 0.0
    max_tokens: 200
    json_mode: true

  domain_classifier:
    temperature: 0.0
    max_tokens: 100
    json_mode: true

  highlight:
    temperature: 0.2
    max_tokens: 3000
    json_mode: true

# 임베딩
embedding:
  batch_size: 64
  chunk_size: 512
  chunk_overlap: 64

# 리랭킹
reranker:
  top_k_before: 30
  top_k_after: 8

# Retrieval (RAG)
retrieval:
  hybrid:
    bm25_weight: 0.3
    dense_weight: 0.7
  top_k: 30

# TTS 음향 파라미터
tts:
  speed: 1.0
  pause_between_speakers_ms: 400
  pause_between_chapters_ms: 800
  fade_in_out_ms: 200

# 캐싱 TTL
cache:
  llm_response_ttl_hours: 720      # 30일
  summary_ttl_hours: 17520          # 영구급 (2년)
  podcast_ttl_hours: 17520
  translation_ttl_hours: 720
```

#### 7.5.6 `config/providers.yaml`
> 프로바이더의 엔드포인트, 헤더, rate limit 등 메타 설정.

```yaml
version: "2026.05.19"

providers:
  openai:
    type: openai
    base_url: https://api.openai.com/v1
    api_key_env: OPENAI_API_KEY
    headers: {}
    request_per_minute: 500
    supports_json_mode: true
    supports_streaming: true

  gemini:
    type: gemini
    base_url: https://generativelanguage.googleapis.com/v1beta
    api_key_env: GEMINI_API_KEY
    request_per_minute: 1000
    supports_json_mode: true
    supports_streaming: true

  openrouter:
    type: openai_compatible
    base_url: https://openrouter.ai/api/v1
    api_key_env: OPENROUTER_API_KEY
    headers:
      HTTP-Referer: https://paperlight.ai
      X-Title: PaperLight
    supports_json_mode: true
    supports_streaming: true

  local:                            # Ollama / vLLM 등 셀프 호스팅
    type: openai_compatible
    base_url: http://localhost:11434/v1
    api_key_env: ""
    supports_streaming: true

  cohere:
    type: cohere
    base_url: https://api.cohere.ai/v1
    api_key_env: COHERE_API_KEY

  elevenlabs:
    type: elevenlabs
    base_url: https://api.elevenlabs.io/v1
    api_key_env: ELEVENLABS_API_KEY
```

#### 7.5.7 `config/prompts/summary.yaml` (예시)
```yaml
version: "2026.05.19"
task: summary

system: |
  당신은 학술 논문 요약 전문가입니다.

  ## 언어 규칙
  - 응답 언어: {content_language}
  - 자연스럽고 정확한 학술 문체

  ## 전문 용어 보존 규칙 (중요)
  다음 용어들은 번역하지 말고 원어 그대로 사용:
  {preserved_terms_list}
  
  또한 다음 카테고리는 항상 원어 유지:
  - 모델/아키텍처 이름 (Transformer, BERT, GPT, ...)
  - 약어 (SOTA, OOD, GPU, RLHF, ...)
  - 데이터셋/벤치마크 (ImageNet, GLUE, ...)
  - 라이브러리/도구 (PyTorch, JAX, ...)
  - 학회/저널 (NeurIPS, ICML, ...)
  - 고유명사

  ## 출력 형식 (JSON)
  {{
    "tldr": "한 문장 요약 (50자 이내)",
    "three_points": ["Problem: ...", "Method: ...", "Result: ..."],
    "sections": [{{ "name": "Introduction", "summary": "..." }}, ...],
    "contributions": ["...", "..."],
    "keywords": ["...", "..."]
  }}

user_template: |
  논문 제목: {title}

  본문:
  {body}
```

#### 7.5.8 Python 설정 로더 (`config/loader.py`)
```python
from pathlib import Path
from typing import Any
import yaml
from pydantic import BaseModel, Field

CONFIG_DIR = Path(__file__).parent

# ── Pydantic Schemas ─────────────────────────────────────
class ModelTask(BaseModel):
    provider: str
    model: str
    fallback: list[dict[str, str]] = Field(default_factory=list)

class ModelsConfig(BaseModel):
    version: str
    default: ModelTask
    tasks: dict[str, ModelTask]
    embedding: ModelTask
    reranker: ModelTask
    tts: dict[str, Any]

class HyperparamsConfig(BaseModel):
    version: str
    defaults: dict[str, Any]
    tasks: dict[str, dict[str, Any]]
    embedding: dict[str, Any]
    reranker: dict[str, Any]
    retrieval: dict[str, Any]
    tts: dict[str, Any]
    cache: dict[str, Any]

class ProviderConfig(BaseModel):
    type: str
    base_url: str
    api_key_env: str
    headers: dict[str, str] = Field(default_factory=dict)
    request_per_minute: int = 60
    supports_json_mode: bool = False
    supports_streaming: bool = False

class ProvidersConfig(BaseModel):
    version: str
    providers: dict[str, ProviderConfig]

# ── Loader (싱글톤 + Hot Reload) ─────────────────────────
_models: ModelsConfig | None = None
_hparams: HyperparamsConfig | None = None
_providers: ProvidersConfig | None = None
_prompts: dict[str, dict] = {}

def _load_yaml(rel: str) -> dict:
    with open(CONFIG_DIR / rel) as f:
        return yaml.safe_load(f)

def get_models() -> ModelsConfig:
    global _models
    if _models is None:
        _models = ModelsConfig(**_load_yaml("models.yaml"))
    return _models

def get_hyperparams() -> HyperparamsConfig:
    global _hparams
    if _hparams is None:
        _hparams = HyperparamsConfig(**_load_yaml("hyperparameters.yaml"))
    return _hparams

def get_providers() -> ProvidersConfig:
    global _providers
    if _providers is None:
        _providers = ProvidersConfig(**_load_yaml("providers.yaml"))
    return _providers

def get_prompt(task: str) -> dict:
    if task not in _prompts:
        _prompts[task] = _load_yaml(f"prompts/{task}.yaml")
    return _prompts[task]

def reload_all() -> None:
    """yaml hot reload (운영 중 yaml 수정 시 호출)"""
    global _models, _hparams, _providers, _prompts
    _models = _hparams = _providers = None
    _prompts = {}
```

#### 7.5.9 LLMRouter (config 기반)
```python
# providers/router.py
from config.loader import get_models, get_hyperparams, get_providers, get_prompt
from .openai_provider import OpenAIProvider
from .gemini_provider import GeminiProvider
from .openrouter_provider import OpenAICompatibleProvider

class LLMRouter:
    def __init__(self):
        self.models = get_models()
        self.hparams = get_hyperparams()
        providers_cfg = get_providers()
        self._providers = {
            name: self._build(cfg) for name, cfg in providers_cfg.providers.items()
        }

    def _build(self, cfg):
        if cfg.type == "openai":
            return OpenAIProvider(cfg)
        if cfg.type == "gemini":
            return GeminiProvider(cfg)
        if cfg.type == "openai_compatible":
            return OpenAICompatibleProvider(cfg)
        raise ValueError(f"Unknown provider type: {cfg.type}")

    def resolve(self, task: str):
        """작업명 → (provider, model, hparams) 튜플 반환"""
        task_cfg = self.models.tasks.get(task, self.models.default)
        provider = self._providers[task_cfg.provider]
        hparams = {**self.hparams.defaults, **self.hparams.tasks.get(task, {})}
        return provider, task_cfg.model, hparams

    async def chat_with_fallback(self, task: str, messages, **overrides):
        primary, model, hparams = self.resolve(task)
        kwargs = {**hparams, **overrides}
        try:
            return await primary.chat(messages, model=model, **kwargs)
        except (RateLimitError, ProviderError) as e:
            logger.warning(f"{primary.cfg.type} failed: {e}, trying fallback")
            for fb in self.models.tasks[task].fallback:
                try:
                    p = self._providers[fb["provider"]]
                    return await p.chat(messages, model=fb["model"], **kwargs)
                except Exception:
                    continue
            raise
```

#### 7.5.10 Agent 안에서의 사용 예
```python
# agents/summary_graph.py
from config.loader import get_prompt
from providers.router import LLMRouter
from glossary.loader import get_preserved_terms_for_paper

router = LLMRouter()

async def summarize_node(state):
    prompt_cfg = get_prompt("summary")
    preserved_terms = get_preserved_terms_for_paper(state.paper_id)
    
    system_msg = prompt_cfg["system"].format(
        content_language=state.content_language,           # §5.7
        preserved_terms_list=", ".join(preserved_terms),    # §5.8
    )
    user_msg = prompt_cfg["user_template"].format(
        title=state.paper_title,
        body=state.paper_text,
    )

    response = await router.chat_with_fallback(
        task="summary",
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
    )
    state.summary = parse_summary(response.content)
    return state
```

#### 7.5.11 운영 시나리오
| 시나리오 | 어떻게 |
| --- | --- |
| Summary 품질 개선 위해 GPT-5 → Claude Opus 4.7로 교체 | `models.yaml`의 `tasks.summary.provider/model`만 변경, 재배포 불필요 |
| Chat의 temperature 0.6 → 0.4 조정 | `hyperparameters.yaml`의 `tasks.chat.temperature` 수정 |
| 새 프로바이더 (예: Together AI) 추가 | `providers.yaml`에 한 블록 추가, `OpenAICompatibleProvider` 재사용 |
| 사용자 BYO 키 적용 | 런타임에 사용자 키로 임시 프로바이더 인스턴스 생성 |
| A/B 테스트 | 두 변형의 models.yaml을 두고 사용자 그룹별 라우팅 |
| 프롬프트 개선 | `prompts/*.yaml` 수정, hot reload |

#### 7.5.12 Hot Reload
- 운영 중 `config/*.yaml` 변경 → `watchdog` file watcher가 감지 → `reload_all()` 호출
- 새 요청부터 새 설정 적용. 진행 중인 요청은 기존 설정 유지
- 변경 시 Slack 알림 (운영 안전성)

### 7.6 데이터 모델 (Podcast 추가)
```python
class Podcast:
    id: UUID
    paper_id: UUID
    user_id: UUID
    options: dict           # language, length, level, focus, voices
    status: Enum["pending", "scripting", "synthesizing", "done", "failed"]
    duration_sec: int
    script_md: str          # 대본 (Markdown)
    chapters: list[Chapter] # 챕터 마커
    audio_s3_key: str       # mp3
    srt_s3_key: str         # 자막
    cost_usd: float
    created_at: datetime

class Chapter(BaseModel):
    title: str
    start_sec: int
    end_sec: int
    refs_to_paper: list[CitationRef]  # 본문 위치 매핑
```

### 7.7 API 명세 (Podcast 추가)
| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/papers/{id}/podcast` | 생성 요청 (옵션 body) |
| GET | `/api/papers/{id}/podcast/{podcast_id}` | 상태 + 메타 |
| GET | `/api/podcast/{id}/stream` | mp3 스트리밍 |
| GET | `/api/podcast/{id}/srt` | 자막 |
| GET | `/api/podcast/{id}/events` | SSE: 생성 진행 단계 |
| DELETE | `/api/podcast/{id}` | 삭제 |

---

## 8. 비기능 요구사항

### 8.1 성능
- TTFT p95 < 1.5초
- 동시 사용자 1,000명
- Podcast 10분 분량 생성 < 90초 (병렬 TTS)
- PDF 50p < 20초

### 8.2 보안 / 프라이버시
- PDF AES-256 암호화 저장
- Presigned URL 5분 만료
- "데이터 학습 비활성" 가능한 프로바이더만 사용
- 사용자 API 키 BYO(Bring Your Own) 옵션 (Pro 이상)

### 8.3 안정성
- 외부 API 모두 retry + circuit breaker
- LLM 실패 시 자동 폴백 (§7.5.3)
- 99.5% uptime

### 8.4 비용 통제
- LLM 응답 캐시 (해시 기반)
- Summary / Auto-Highlight / Podcast(동일 옵션) 영구 캐시
- 사용자별 일일 토큰 한도
- 사용량 대시보드 (관리자)

---

## 9. 가격 정책 (Podcast 반영)

| 플랜 | 가격 | 일일 AI 호출 | 월 Podcast | 비고 |
| --- | --- | --- | --- | --- |
| Free | $0 | 30회 | **3개** | 신규 유입 |
| Pro | $12/월 | 무제한 | **30개** | 개인 |
| Team | $9/인/월 (5인+) | 무제한 | 무제한 | 공유 라이브러리 |
| Edu | $6/월 | 무제한 | 30개 | 학생 인증 |
| BYO | -$3/월 할인 | 본인 키 사용 | 본인 키 사용 | API 키 직접 제공 |

---

## 10. 마일스톤

### Phase 0: 프로토타입 (4주)
- PDF 뷰어 + 텍스트 선택 + 단일 LLM Explain/Translate
- **목표**: 데모 가능

### Phase 1: MVP (8주)
- Auth + Library + Ingestion 파이프라인
- Chat Graph + Citation
- 다층 Summary
- **LLM Provider Abstraction (§7.5)**
- arXiv import
- **목표**: 100명 베타

### Phase 2: 정식 런칭 (12주)
- Auto Highlight / Citation Preview / Cross-ref Preview
- **AI Podcast (F-13)**
- Scholar Deep Search
- Export
- 결제
- **목표**: 정식 GA

### Phase 3: 확장 (12주+)
- Team / 공유 라이브러리
- Mind Map / Compare 모드
- 브라우저 익스텐션
- 모바일 (읽기/청취 위주)

---

## 11. 범위 외 (v1)
- 논문 작성 어시스턴트
- 실시간 동시 편집
- 모바일 풀 기능 (보기/청취만 지원)
- TTS 외 영상 생성

---

## 12. 리스크 & 완화

| 리스크 | 영향 | 가능성 | 완화 |
| --- | --- | --- | --- |
| LLM 비용 폭증 (특히 Podcast) | 높음 | 중 | 캐시 / 모델 라우팅 / BYO 옵션 / 사용량 한도 |
| Podcast 환각 | 높음 | 중 | Critic Agent / 본문 인용 강제 / 사용자 피드백 루프 |
| TTS 부자연스러움 (한국어) | 중 | 중 | 보이스 후보 다수 제공 / ElevenLabs 한국어 보이스 활용 |
| PDF 파싱 실패 (수식/스캔본) | 중 | 높음 | MathPix 폴백 / 부분 기능 제공 |
| 저작권 | 높음 | 낮음 | 본인 업로드만 / 재배포 금지 / Podcast는 본인 청취용만 |
| 경쟁사 (Moonlight, SciSpace, NotebookLM) | 중 | 높음 | Podcast + 한국어 + 멀티 프로바이더로 차별화 |

---

## 13. 차별화 포인트 (vs 경쟁)

| 항목 | Moonlight | NotebookLM | SciSpace | **PaperLight** |
| --- | --- | --- | --- | --- |
| 논문 특화 PDF 뷰어 | ✅ | ❌ (범용) | ✅ | ✅ |
| 맥락 번역 | ✅ | ❌ | △ | ✅ |
| **2인 대담 Podcast** | ❌ | ✅ | ❌ | **✅** |
| **Podcast ↔ 본문 동기 하이라이트** | ❌ | ❌ | ❌ | **✅ (유일)** |
| Critique Agent (환각 차단) | 불명 | ❌ | ❌ | **✅** |
| **Figure/Table 구조화 설명** (sub-figure 단위 + 본문 cross-ref) | △ (단순) | ❌ | △ | **✅ (Type Classifier + 캐시 + 다국어)** |
| **단락별 한 줄 요점 + 중요도 분류** (F-15) | △ | ❌ | △ | **✅ (Critical/Standard/Skippable)** |
| **Quick Skim Mode** (본문을 한 줄 요점으로 임시 대체) | ❌ | ❌ | ❌ | **✅ (유일)** |
| **단락 ↔ 단락 ↔ Figure 연결 그래프** | ❌ | ❌ | ❌ | **✅ (유일)** |
| 멀티 LLM Provider | ❌ | ❌ (Gemini 전용) | ❌ | **✅ (`config/yaml`로 자유 선택)** |
| BYO API Key | ❌ | ❌ | ❌ | **✅** |
| Cross-ref Preview | ✅ | ❌ | △ | ✅ |
| 한국어 UI / 한국어 Podcast | ✅ / ❌ | △ / △ | ❌ | **✅ / ✅** |
| Notion / Obsidian Export | △ | △ | △ | **✅ (Native)** |

---

## 14. Open Questions
1. **TTS 한국어 자연성**: OpenAI TTS의 한국어 보이스 자연성이 부족할 경우 ElevenLabs를 default로 사용해야 할 가능성. 비용 영향 검토.
2. **Podcast 화자 일관성**: 동일 보이스로 화자 A/B를 구분하려면 톤/속도 차이만으로 충분한가? 두 보이스를 모두 다른 모델에서 가져올지.
3. **Self-hosted vs API (임베딩)**: 사용자 증가 시 자체 호스팅 임베딩 모델로 전환 시점은?
4. **저작권**: 사용자가 업로드한 논문을 Podcast로 만들어 *공유*하는 행위의 저작권 이슈. v1에서는 공유 금지 정책.
5. **수식 인식**: MathPix 도입 비용 vs 자체 OCR 정확도 트레이드오프.

---

## 부록 A. 용어집
- **Chunk**: 임베딩 단위 텍스트 조각 (보통 512 토큰)
- **BBox**: PDF 페이지 위 영역 좌표
- **Cross-reference**: 본문에서 같은 논문 내 다른 위치를 가리키는 참조
- **TTFT**: Time To First Token
- **BYO**: Bring Your Own (API Key)
- **TTS**: Text-To-Speech

## 부록 B. 참고
- Moonlight: https://www.themoonlight.io/ko
- NotebookLM: https://notebooklm.google/
- arXiv API: https://info.arxiv.org/help/api/
- Semantic Scholar: https://api.semanticscholar.org/
- LangGraph: https://langchain-ai.github.io/langgraph/
- OpenRouter: https://openrouter.ai/docs
- ElevenLabs: https://elevenlabs.io/docs