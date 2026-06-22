import { CrossRefText } from "paperlight-frontend";

/** 본문 한 문단 안에서 "Figure 3" / "Table 2" cross-ref가 점선 밑줄로 강조된다(호버 시 미니 프리뷰). */
export function InParagraph() {
  return (
    <div
      style={{
        width: 480,
        padding: 16,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-primary)",
        background: "var(--bg-surface)",
      }}
    >
      <CrossRefText
        paperId="2310.06825"
        text="As shown in Figure 3, the proposed attention variant reduces inference latency by 41% while matching baseline accuracy reported in Table 2."
      />
    </div>
  );
}

/** 한글 본문의 그림·표 참조(그림 1 / 표 4). */
export function KoreanRefs() {
  return (
    <div
      style={{
        width: 480,
        padding: 16,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-primary)",
        background: "var(--bg-surface)",
      }}
    >
      <CrossRefText
        paperId="2310.06825"
        text="그림 1에서 보듯이 학습 곡선은 빠르게 수렴하며, 정량 지표는 표 4에 정리하였다."
      />
    </div>
  );
}

/** cross-ref가 없는 일반 문장은 그대로 평문으로 렌더된다. */
export function PlainText() {
  return (
    <div
      style={{
        width: 480,
        padding: 16,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-primary)",
        background: "var(--bg-surface)",
      }}
    >
      <CrossRefText
        paperId="2310.06825"
        text="We train all models for 100k steps with a cosine learning-rate schedule and a warmup of 2k steps."
      />
    </div>
  );
}
