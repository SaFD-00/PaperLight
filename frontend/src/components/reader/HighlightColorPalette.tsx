"use client";

const COLORS: { name: string; swatch: string; label: string }[] = [
  { name: "yellow", swatch: "#ffe066", label: "노랑" },
  { name: "blue", swatch: "#7db0ff", label: "파랑" },
  { name: "green", swatch: "#8cdea0", label: "초록" },
  { name: "red", swatch: "#ff9191", label: "빨강" },
  { name: "purple", swatch: "#c39bff", label: "보라" },
];

export function HighlightColorPalette({ onPick }: { onPick: (color: string) => void }) {
  return (
    <div
      role="group"
      aria-label="하이라이트 색상"
      className="flex items-center gap-1 border-l border-border-subtle pl-1"
    >
      {COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          aria-label={`${c.label} 하이라이트`}
          title={c.label}
          onClick={() => onPick(c.name)}
          className="size-4 rounded-full border border-border-default"
          style={{ backgroundColor: c.swatch }}
        />
      ))}
    </div>
  );
}
