"use client";

import { Fragment, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { type CrossRefToken, findFigureIndex, splitCrossRefs } from "@/lib/crossref";
import type { FigureLayout } from "@/lib/pdf/messages";
import { useFigures } from "@/stores/figures";

/** F-07 — 문자열에서 cross-ref를 감지해 호버 시 도표 미니 프리뷰를 띄운다. */
export function CrossRefText({ paperId, text }: { paperId: string; text: string }) {
  const fetchFigures = useFigures((s) => s.fetchFigures);
  const figures = useFigures((s) => s.byPaper[paperId]);

  useEffect(() => {
    void fetchFigures(paperId);
  }, [paperId, fetchFigures]);

  const parts = splitCrossRefs(text);
  if (!parts.some((p) => "ref" in p)) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        "text" in part ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <CrossRef key={i} paperId={paperId} token={part.ref} figures={figures ?? []} />
        ),
      )}
    </>
  );
}

function CrossRef({
  paperId,
  token,
  figures,
}: {
  paperId: string;
  token: CrossRefToken;
  figures: FigureLayout[];
}) {
  const [open, setOpen] = useState(false);
  const idx = findFigureIndex(figures, token);
  const entry = idx === null ? null : figures[idx];

  return (
    <span
      className="relative cursor-help text-brand-primary underline decoration-dotted underline-offset-2"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-crossref={token.raw}
    >
      {token.raw}
      {open && entry !== null && idx !== null && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1 block w-64 rounded-md border border-border-default bg-bg-elevated p-2 shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apiUrl(`/api/papers/${paperId}/figures/${idx}/image`)}
            alt={entry.label}
            className="w-full rounded"
          />
          {entry.captionText && (
            <span className="mt-1 block text-xs text-text-muted">{entry.captionText}</span>
          )}
        </span>
      )}
    </span>
  );
}
