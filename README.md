# PaperLight

> PDF를 올리면 AI가 본문만 골라 번역·요약·설명하고, 근거를 들어 답하는 논문 리더.

PaperLight는 [themoonlight.io](https://www.themoonlight.io) 스타일의 **단일 사용자 로컬 AI 논문
리더 웹앱**입니다. PDF를 업로드하면 본문만 추출해(저자·캡션·참고문헌 제외) 문장 단위 번역,
다층 요약, 근거 있는 AI 챗, 수식·그림 설명, 자동 하이라이트, 노트/마크업을 한 화면에서 제공합니다.

엔지니어링 상세는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), 디자인 토큰·와이어프레임은
[docs/DESIGN.md](docs/DESIGN.md)를 참고하세요.

## 기능

- **인라인 번역** — 원문 옆에 문장 단위로 정렬, 본문만(저자/캡션/참고문헌 제외)
- **AI 요약 · 인사이트** — TL;DR·섹션 요약·핵심 기여 자동 생성
- **근거 있는 챗** — 본문 페이지·스니펫을 인용해 답변(SQLite 임베딩 코사인 검색)
- **수식 · 그림 설명** — 수식/그림/표를 클릭 한 번으로 풀이
- **오토 하이라이트** — 기여·방법·결과·한계 색상 강조
- **노트 · 마크업** — 하이라이트+메모, Markdown/Obsidian 내보내기

## 입력

- **PDF 업로드**(정식 입력) — `/import`에서 드래그&드롭 또는 파일 선택
- **arXiv 임포트**(보조) — arXiv ID/URL

## 스택

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Zustand |
| PDF | Mozilla pdf.js + KaTeX (Shadow DOM iframe 격리) |
| Landing | 자체 WebGL 셰이더(외부 의존성 0, reduced-motion 대응) |
| Backend | FastAPI (Python 3.12) |
| Database | SQLite (aiosqlite, WAL) |
| 임베딩 검색 | SQLite에 packed float32 저장 → numpy 코사인 top-k |
| Object storage | 로컬 파일시스템 (`PAPERLIGHT_DATA_DIR`) |
| PDF 파싱 | PyMuPDF(기본) / marker(opt-in) |
| LLM | OpenRouter(Qwen3.6 기본) / OpenAI / Gemini / Stub — `config/agents.yaml` 라우팅 |

> 인증·팟캐스트·풀 라이브러리·클라우드 인프라(Postgres·Qdrant·Redis·R2·관측도구)는 제거된 단일 사용자 로컬 앱입니다.

## 저장소 구조

```
PaperLight/
├── frontend/   # Next.js 앱
├── backend/    # FastAPI
├── config/     # agents.yaml(LLM 라우팅) + prompts + glossary
├── fixtures/   # 샘플 논문 PDF + 메타(시드·파싱 회귀 테스트)
└── docs/       # ARCHITECTURE.md + DESIGN.md
```

## 빠른 시작

```bash
# Backend
cd backend
uv sync
uv run uvicorn paperlight.main:app --reload --port 8000

# Frontend (다른 터미널)
cd frontend
pnpm install
pnpm dev
```

- Backend: <http://localhost:8000/health>
- Frontend: <http://localhost:3000>
- LLM 키(`OPENROUTER_API_KEY` 등)가 없으면 stub로 동작합니다 — 업로드·파싱·PDF 서빙·임베딩
  검색은 오프라인으로 되고, 요약/챗/번역/설명 같은 생성 기능만 키가 필요합니다.

## 검증

```bash
cd backend  && uv run pytest && uv run ruff check paperlight
cd frontend && pnpm typecheck && pnpm test && pnpm build
```

## 키보드 단축키 (일부)

| Key | Action |
| --- | --- |
| `[` `]` `\` | 좌/우 패널 · 포커스 모드 토글 |
| `⌘W` / `⌘⇧T` | 탭 닫기 / 최근 탭 다시 열기 |
| `⌘1`~`⌘9` | 탭 전환 |
| `⌘K` | 명령 팔레트 |

## 라이선스

[MIT](LICENSE)
