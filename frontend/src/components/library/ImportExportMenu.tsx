"use client";

import { ChevronDown, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useLibrary } from "@/stores/library";

const FORMATS: { id: string; label: string; ext: string }[] = [
  { id: "bibtex", label: "BibTeX", ext: "bib" },
  { id: "ris", label: "RIS", ext: "ris" },
  { id: "endnote", label: "EndNote", ext: "enw" },
];

export function ImportExportMenu({ exportIds }: { exportIds: string[] }) {
  const importRefs = useLibrary((s) => s.importRefs);
  const exportRefs = useLibrary((s) => s.exportRefs);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFormat = useRef("bibtex");

  function pickFile(format: string) {
    pendingFormat.current = format;
    fileRef.current?.click();
    setOpen(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    await importRefs(pendingFormat.current, content);
    e.target.value = "";
  }

  async function doExport(format: string, ext: string) {
    setOpen(false);
    const text = await exportRefs(exportIds, format);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1.5 text-sm text-text-secondary hover:bg-bg-muted"
      >
        가져오기/내보내기
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border-subtle bg-bg-surface py-1 text-sm shadow-md">
          <p className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase text-text-muted">
            <Upload className="size-3" /> 가져오기
          </p>
          {FORMATS.map((f) => (
            <button
              key={`in-${f.id}`}
              type="button"
              onClick={() => pickFile(f.id)}
              className="block w-full px-4 py-1 text-left hover:bg-bg-muted"
            >
              {f.label}
            </button>
          ))}
          <div className="my-1 border-t border-border-subtle" />
          <p className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase text-text-muted">
            <Download className="size-3" /> 내보내기
          </p>
          {FORMATS.map((f) => (
            <button
              key={`out-${f.id}`}
              type="button"
              onClick={() => void doExport(f.id, f.ext)}
              className="block w-full px-4 py-1 text-left hover:bg-bg-muted"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".bib,.ris,.enw,.txt"
        onChange={onFile}
        className="hidden"
        aria-label="참고문헌 파일"
      />
    </div>
  );
}
