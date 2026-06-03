"use client";

import { useState } from "react";

interface ResizeHandleProps {
  /** "right" = 패널 오른쪽 모서리(오른쪽으로 끌면 넓어짐, 좌측 사이드바용),
   *  "left"  = 패널 왼쪽 모서리(왼쪽으로 끌면 넓어짐, 우측 패널용). */
  side: "right" | "left";
  width: number;
  onChange: (width: number) => void;
}

export function ResizeHandle({ side, width, onChange }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      onChange(side === "right" ? startWidth + delta : startWidth - delta);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleMouseDown}
        className={`absolute inset-y-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-brand-primary/40 ${
          side === "right" ? "right-0" : "left-0"
        } ${dragging ? "bg-brand-primary/40" : ""}`}
      />
      {/* 드래그 중 iframe이 mousemove/mouseup을 가로채지 않도록 전체 화면 오버레이. */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  );
}
