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
| 5 | `evermemos` | EverMemOS: A Self-Organizing Memory Operating System | Hu, Gao, Zhou et al. | 2025 | — | 2026-06-12 |
| 6 | `iclr-pedagogical-distill` | Pedagogically-Inspired Data Synthesis for LM Knowledge Distillation | He, Chen, Zhang et al. | 2026 | ICLR 2026 | 2026-06-12 |
| 7 | `2305.10601-tree-of-thoughts` | Tree of Thoughts: Deliberate Problem Solving with LLMs | Yao, Yu, Zhao et al. | 2023 | [2305.10601](https://arxiv.org/abs/2305.10601) · NeurIPS 2023 | 2026-06-14 |
| 8 | `2310.16834-icml-score-entropy` | Discrete Diffusion Modeling by Estimating the Ratios of the Data Distribution | Lou, Meng, Ermon | 2024 | [2310.16834](https://arxiv.org/abs/2310.16834) · ICML 2024 | 2026-06-14 |
| 9 | `2201.03545-convnext-cvpr` | A ConvNet for the 2020s | Liu, Mao, Wu et al. | 2022 | [2201.03545](https://arxiv.org/abs/2201.03545) · CVPR 2022 | 2026-06-14 |
| 10 | `2311.09210-chain-of-note-emnlp` | Chain-of-Note: Enhancing Robustness in Retrieval-Augmented LMs | Yu, Zhang, Pan et al. | 2024 | [2311.09210](https://arxiv.org/abs/2311.09210) · EMNLP 2024 | 2026-06-14 |
| 11 | `2501.02997-calm-aaai` | CALM: Curiosity-Driven Auditing for Large Language Models | Zheng, Wang, Liu et al. | 2025 | [2501.02997](https://arxiv.org/abs/2501.02997) · AAAI 2025 | 2026-06-14 |
| 12 | `2405.07011-fair-graph-www` | Fair Graph Representation Learning via Sensitive Attribute Disentanglement | Zhu, Li, Zheng et al. | 2024 | [2405.07011](https://arxiv.org/abs/2405.07011) · WWW 2024 (ACM) | 2026-06-14 |
| 13 | `natcomm-2022-precip-nowcasting` | Deep learning for twelve hour precipitation forecasts | Espeholt, Agrawal, Sønderby et al. | 2022 | [10.1038/s41467-022-32483-x](https://doi.org/10.1038/s41467-022-32483-x) · Nat. Commun. | 2026-06-14 |
| 14 | `2310.15641-coverage-tpami` | Guaranteed Coverage Prediction Intervals with Gaussian Process Regression | Papadopoulos | 2024 | [2310.15641](https://arxiv.org/abs/2310.15641) · IEEE TPAMI | 2026-06-14 |

> 상세 메타는 동일 이름의 `.meta.json` 참조. #1·#2는 GUI World Model 도메인(모바일/Android Agent)으로 묶여 F-09 Deep Search·F-13 Podcast 비교 실험에도 유용.
>
> **#3~#6은 본문 추출(번역 필터) 회귀 검증용 — 양식 다양성 확보**.
> - References/캡션 양식: #3 DeepSeekMath는 *이니셜-성*(`Z. Du`) author-year, #4 TextGrad는 *점 번호*(`74. Yang`) + *Supplementary Figure* 접두 캡션이라, 단일 양식(#1 성-이니셜 `Luo, D.` / #2 대괄호 `[16]`)으로는 못 잡던 References·캡션 케이스를 커버한다.
> - Figure/Table 제외 밴드(`figureExclusionBand`): #5 EverMemOS는 표 캡션이 *표 데이터 아래*에 오는 **역방향 표** 양식, #6 ICLR 논문은 *다줄 표 캡션*(캡션 연속줄 2~3줄)이라, 캡션 위/아래 관례·연속줄 건너뜀(MAX_CONT)을 검증한다 → 인접 본문 과잉제거(overdrop) 없이 표 행만 제외되는지 확인.
>
> **#7~#14는 학회 *템플릿* 다양성 회귀용 — 출판 양식별 러닝헤더/푸터·인용·메타 블록 제외 검증** (모두 arXiv 또는 CC-BY 라 커밋 허용). 앱에는 `sample-3`~`sample-10`(seed.py SAMPLES, route.ts SLUG_TO_FILE, Center.tsx PDF_URL_MAP) 으로 등록됨.
> - 러닝 푸터/헤더: #7 NeurIPS(`...NeurIPS 2023).` 푸터, single-column), #8 ICML(`Proceedings of the 41st ICML ... PMLR 235` 푸터), #11 AAAI(`Copyright © 2025, AAAI` 푸터), #14 IEEEtran(`IEEE TRANSACTIONS ON ...` 러닝헤더 + 말미 저자 *biography* 블록) — 양식별 비본문 헤더/푸터를 본문으로 오인 제외하지 않는지 검증.
> - 컬럼/인용: #9 CVPR(IEEE/CVF 2단, 숫자 `[N]` + `In CVPR, 2018.` 축약 refs, 본문 venue 헤더 부재), #10 EMNLP(ACL 2단, natbib author-year + aclanthology refs).
> - 메타 블록: #12 ACM acmart(`CCS CONCEPTS`·`ACM Reference Format:`·`Permission to make digital...`·DOI/ISBN 밀집 블록), #13 Nature 출판본(native 2단, Methods·cross-column figure — arXiv preprint 와 다른 출판사 레이아웃). #13만 CC-BY 4.0 으로 arXiv 외 유일 커밋 케이스.

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

- **arXiv non-exclusive** 또는 **CC-BY(4.0 등 재배포 허용 오픈액세스)** PDF만 본 디렉토리에 커밋. 그 외 출판사(Elsevier/Springer/IEEE/ACM 등) 페이월 PDF는 커밋 금지.
  - 예: #13 `natcomm-2022-precip-nowcasting` 은 Nature Communications **CC-BY 4.0** 출판본이라 커밋 허용(`license` 필드에 명시). 나머지 학회(IEEE TPAMI·ACM WWW 등) 양식은 **arXiv accepted/author 버전**으로 받아 커밋 — 페이월 출판본 PDF는 받지 않음.
- 의문스러우면 `notes` 필드에 출처 명시 후 저자 또는 PM(Seungwoo Baek) 확인.
- 큰 PDF(>10MB)는 향후 Git LFS 검토 — Phase 1에서 결정.

## 6. 디렉토리 정책

- 본 디렉토리의 `*.pdf` 와 `*.meta.json` 은 git에 **포함** (의도적 — 회귀 테스트 안정성).
- `.gitignore`로 무시되지 않도록 주의 (현재 root `.gitignore`에 PDF 패턴 없음 — 확인됨).
- 임시 산출물(`.cache.json`, `.chunks.jsonl` 등)은 추가하지 말 것 — 그건 `backend/tests/__cache__/`로.
