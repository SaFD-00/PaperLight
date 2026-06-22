import { Markdown } from "paperlight-frontend";

/** 요약 본문 — 헤딩·굵게·리스트가 섞인 전형적인 논문 요약. */
export function Summary() {
  return (
    <div style={{ width: 420, padding: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <Markdown>{`## 핵심 요약

이 논문은 **긴 문서 검색**을 위한 새로운 retrieval-augmented 구조를 제안합니다.

- 추론 비용을 표준 Transformer 대비 약 *48%* 절감
- 길이 일반화를 위한 상대 위치 인코딩 도입
- 공개 벤치마크 4종에서 SOTA 달성

### 한계
저자들은 멀티링구얼 설정에서의 검증이 아직 부족하다고 밝힙니다.`}</Markdown>
    </div>
  );
}

/** 인라인 요소 — 링크·인라인 코드·인용문. */
export function InlineElements() {
  return (
    <div style={{ width: 420, padding: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <Markdown>{`구현은 \`scaled_dot_product_attention\` 을 그대로 사용하되, 마스킹을 교체합니다.

> "We replace absolute positional embeddings with a learned relative bias." (3.2절)

자세한 설정은 [공식 저장소](https://example.org)를 참고하세요.`}</Markdown>
    </div>
  );
}

/** 표 렌더링 — remark-gfm 표(헤더/셀 보더 토큰 스타일). */
export function Table() {
  return (
    <div style={{ width: 460, padding: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <Markdown>{`주요 벤치마크 비교:

| 모델 | NQ | TriviaQA | 지연(ms) |
| --- | --- | --- | --- |
| BM25 | 41.2 | 58.7 | 12 |
| DPR | 48.5 | 64.1 | 35 |
| **제안 방법** | **53.9** | **69.4** | 21 |`}</Markdown>
    </div>
  );
}

/** 코드 블록 — 펜스드 코드(블록 코드 토큰 스타일). */
export function CodeBlock() {
  return (
    <div style={{ width: 460, padding: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <Markdown>{`재현을 위한 최소 추론 코드:

\`\`\`python
out = model.generate(
    input_ids,
    max_new_tokens=256,
    use_cache=True,
)
\`\`\`

캐시를 끄면 메모리는 줄지만 지연이 크게 늘어납니다.`}</Markdown>
    </div>
  );
}
