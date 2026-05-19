# 파일럿 논문 (Pilot Test Papers)

> **목적**: Phase 0 데모와 자동 테스트(E2E + ingestion 회귀)에서 고정으로 사용할 논문 PDF 보관소.
> **참조**: [docs/ROADMAP.md §2.4](../../docs/ROADMAP.md) — Phase 0 종료 조건 검증에 사용.

## 1. 사용 위치

| 사용처 | 경로 참조 방법 |
|--------|----------------|
| **Backend 테스트** | `Path(__file__).resolve().parents[2] / "fixtures" / "pilot-papers" / "<file>.pdf"` |
| **Frontend dev/E2E** | 빌드 스크립트로 `frontend/public/pilot/`에 복사 또는 dev 서버 정적 라우트로 노출 (Phase 0 T4에서 결정) |
| **Ingestion 회귀** | `backend/tests/test_ingestion.py`가 본 디렉토리의 PDF를 입력으로 사용 |

## 2. 파일 명명 규칙

```
<arxiv-id-or-slug>.pdf          # 원본 PDF
<arxiv-id-or-slug>.meta.json    # 메타데이터 (title, authors, year, arxiv_id, doi, source_url, sha256)
```

예시:
```
2509.10000-mobile-world-model.pdf
2509.10000-mobile-world-model.meta.json
```

## 3. 등록된 파일럿 논문

> 사용자가 선정한 두 논문을 아래 표에 기록. PDF 추가 시 `.meta.json`도 함께 작성.

| # | Slug | Title | Authors | Year | arXiv / DOI | Source URL | 추가 일자 |
|---|------|-------|---------|------|-------------|-----------|-----------|
| 1 | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 2 | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

> **다음 단계**: 두 논문이 확정되면
> 1. PDF 파일 (`<slug>.pdf`) 본 디렉토리에 저장
> 2. 같은 이름의 `.meta.json` 작성 (아래 §4 스키마)
> 3. 위 표에 한 줄씩 추가
> 4. `git add fixtures/pilot-papers/...` 로 별도 커밋 — 메시지: `chore(fixtures): add pilot test papers (N=2)`

## 4. `.meta.json` 스키마

```json
{
  "slug": "2509.10000-mobile-world-model",
  "title": "How Mobile World Models Predict User Intent",
  "authors": ["Doe, J.", "Roe, R."],
  "year": 2026,
  "arxiv_id": "2509.10000",
  "doi": null,
  "source_url": "https://arxiv.org/pdf/2509.10000.pdf",
  "sha256": "<64-hex>",
  "added_at": "2026-05-20",
  "license": "arXiv non-exclusive (저자 보유)",
  "notes": "Phase 0 데모 시연용 — 본문 한국어 번역 + Floating Menu Explain 시연 대상"
}
```

## 5. 저작권·라이선스 주의

- **arXiv non-exclusive** 라이선스 PDF만 본 디렉토리에 커밋. 출판사(Elsevier/Springer 등) PDF는 커밋 금지.
- 의문스러우면 `notes` 필드에 출처 명시 후 저자 또는 PM(Seungwoo Baek) 확인.
- 큰 PDF(>10MB)는 향후 Git LFS 검토 — Phase 1에서 결정.

## 6. 디렉토리 정책

- 본 디렉토리의 `*.pdf` 와 `*.meta.json` 은 git에 **포함** (의도적 — 회귀 테스트 안정성).
- `.gitignore`로 무시되지 않도록 주의 (현재 root `.gitignore`에 PDF 패턴 없음 — 확인됨).
- 임시 산출물(`.cache.json`, `.chunks.jsonl` 등)은 추가하지 말 것 — 그건 `backend/tests/__cache__/`로.
