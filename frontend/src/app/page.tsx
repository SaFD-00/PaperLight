"use client";

import {
  ArrowRight,
  Highlighter,
  Languages,
  Lightbulb,
  MessageSquareQuote,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const ShaderBackground = dynamic(() => import("@/components/landing/ShaderBackground"), {
  ssr: false,
});

const FEATURES = [
  {
    icon: Languages,
    title: "인라인 번역",
    desc: "원문 옆에 문장 단위로 정렬된 번역을 스트리밍. 저자·캡션·참고문헌은 제외하고 본문만.",
  },
  {
    icon: Sparkles,
    title: "AI 요약 · 인사이트",
    desc: "TL;DR부터 섹션 요약·핵심 기여까지, 논문을 열자마자 자동으로 정리됩니다.",
  },
  {
    icon: MessageSquareQuote,
    title: "근거 있는 논문 챗",
    desc: "질문하면 본문 페이지·스니펫을 인용해 답하고, 클릭 한 번으로 원문으로 점프합니다.",
  },
  {
    icon: Lightbulb,
    title: "수식 · 그림 설명",
    desc: "복잡한 수식, 그림, 표를 한 번의 클릭으로 쉬운 말로 풀어 설명합니다.",
  },
  {
    icon: Highlighter,
    title: "오토 하이라이트",
    desc: "기여·방법·결과·한계를 색으로 구분해 자동 강조. 한눈에 구조가 보입니다.",
  },
  {
    icon: NotebookPen,
    title: "노트 · 마크업",
    desc: "색상별 하이라이트와 메모를 한곳에 모으고 Markdown/Obsidian으로 내보냅니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full bg-bg-base">
      {/* ── Hero: 풀블리드 WebGL 그라데이션 ───────────────────────── */}
      <section className="relative isolate flex min-h-[88vh] flex-col overflow-hidden">
        <ShaderBackground />
        {/* 텍스트 가독성용 스크림 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40"
        />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2 font-semibold text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 backdrop-blur">
              <Sparkles size={16} />
            </span>
            PaperLight
          </span>
          <Link
            href="/library"
            className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
          >
            시작하기
          </Link>
        </header>

        <div className="relative z-10 mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="pl-rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            PDF만 올리면 — 번역 · 요약 · 챗 · 설명
          </div>
          <h1
            className="pl-rise mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            논문을, 빛의 속도로 읽다
          </h1>
          <p
            className="pl-rise mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            PaperLight는 AI 논문 리더입니다. PDF를 올리면 본문만 골라 번역하고, 자동으로 요약하고,
            근거를 들어 답합니다.
          </p>
          <div
            className="pl-rise mt-9 flex flex-col items-center gap-3 sm:flex-row"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href="/import"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1a1530] shadow-lg transition-transform hover:scale-[1.02]"
            >
              PDF 올리고 시작하기
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              내 논문 보기
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features: 차분한 테마 섹션 ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          읽기에 필요한 모든 것, 한 화면에
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border-subtle bg-bg-surface p-5 transition-all hover:border-border-default hover:shadow-md"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-primary-soft text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-text-primary">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-br from-brand-primary to-[#6a4ae8] px-8 py-14 text-center shadow-lg sm:px-16">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            지금 첫 논문을 열어보세요
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
            설치도 로그인도 없습니다. PDF 한 편이면 충분합니다.
          </p>
          <Link
            href="/import"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-primary shadow-md transition-transform hover:scale-[1.02]"
          >
            PDF 올리기
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-text-muted sm:flex-row">
          <span>© 2026 PaperLight</span>
          <span>AI 논문 리더 — 읽고, 번역하고, 요약하고, 대화하세요.</span>
        </div>
      </footer>
    </div>
  );
}
