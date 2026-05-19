export function Center({ paperId }: { paperId: string }) {
  return (
    <section
      aria-label="PDF 본문 영역"
      className="grid h-full place-items-center overflow-auto bg-bg-muted"
    >
      <div className="flex flex-col items-center gap-2 text-text-muted">
        <div className="grid h-32 w-24 place-items-center rounded-md border border-dashed border-border-default bg-bg-surface text-xs">
          PDF
        </div>
        <p className="text-sm">paperId: <span className="font-mono">{paperId}</span></p>
        <p className="text-xs">pdf.js Shadow DOM iframe — S2에서 통합</p>
      </div>
    </section>
  );
}
