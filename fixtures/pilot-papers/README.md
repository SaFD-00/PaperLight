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

| # | Slug | Title | Lead Authors | Year | arXiv | 추가 일자 |
|---|------|-------|--------------|------|-------|-----------|
| 1 | `2602.09856-code2world` | Code2World: A GUI World Model via Renderable Code Generation | Zheng, Zhong, Wang et al. | 2026 | [2602.09856](https://arxiv.org/abs/2602.09856) | 2026-05-20 |
| 2 | `2605.10347-mobile-world-model-gui-agents` | How Mobile World Model Guides GUI Agents? | Xu, Huang, Feng et al. | 2026 | [2605.10347](https://arxiv.org/abs/2605.10347) | 2026-05-20 |
| 3 | `deepseekmath` | DeepSeekMath: Pushing the Limits of Mathematical Reasoning | Shao, Wang, Zhu et al. | 2024 | [2402.03300](https://arxiv.org/abs/2402.03300) | 2026-06-12 |
| 4 | `textgrad` | TextGrad: Automatic "Differentiation" via Text | Yuksekgonul, Bianchi et al. | 2024 | [2406.07496](https://arxiv.org/abs/2406.07496) | 2026-06-12 |

> 상세 메타는 동일 이름의 `.meta.json` 참조. #1·#2는 GUI World Model 도메인(모바일/Android Agent)으로 묶여 F-09 Deep Search·F-13 Podcast 비교 실험에도 유용.
>
> **#3·#4는 본문 추출(번역 필터) 회귀 검증용 — 양식 다양성 확보**. #3 DeepSeekMath는 References가 *이니셜-성*(`Z. Du`) author-year 양식, #4 TextGrad는 *점 번호*(`74. Yang`) 양식 + *Supplementary Figure* 접두 캡션이라, 단일 양식(#1 성-이니셜 `Luo, D.` / #2 대괄호 `[16]`)으로는 못 잡던 References·캡션 케이스를 커버한다.

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
