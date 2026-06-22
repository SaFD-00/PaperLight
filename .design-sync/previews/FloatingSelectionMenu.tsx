import { FloatingSelectionMenu, useReader } from "paperlight-frontend";

/** 본문에서 텍스트를 드래그 선택하면 뜨는 액션 툴바(설명·번역·Ask·하이라이트·복사). */
export function Open() {
  useReader.setState({
    selection: {
      text: "self-supervised pretraining",
      page: 3,
      hostRect: {
        left: 200,
        top: 120,
        right: 360,
        bottom: 138,
        width: 160,
        height: 18,
      },
      rects: [{ x: 0.2, y: 0.3, w: 0.18, h: 0.02 }],
    },
  });
  return (
    <div
      style={{
        position: "relative",
        width: 480,
        height: 160,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <FloatingSelectionMenu paperId="2310.06825" />
    </div>
  );
}
