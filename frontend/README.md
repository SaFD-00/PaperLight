# PaperLight Frontend

Next.js 15 (App Router) + React 19 + TypeScript 5.

## Setup

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## 검증

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (bodyFilter 합성 + 실제 PDF 픽스처 회귀)
pnpm build
```

## 구조 · 패턴

라우트: `/`(랜딩) · `/import`(PDF 업로드) · `/library`(내 논문) · `/r/[paperId]`(리더).
아키텍처·pdf.js Shadow DOM·본문 추출(bodyFilter)은 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) 참고.
