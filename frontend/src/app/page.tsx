"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Languages,
  MessageSquareQuote,
  Sparkles,
  Headphones,
  Highlighter,
} from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/stores/auth";

const FEATURES = [
  {
    icon: Languages,
    title: "인라인 번역",
    desc: "원문 옆에 문장 단위로 정렬된 번역을 실시간 스트리밍. 맥락을 잃지 않고 읽습니다.",
  },
  {
    icon: Sparkles,
    title: "AI 요약 · 인사이트",
    desc: "TL;DR부터 섹션별 요약·핵심 기여까지, 논문을 열자마자 자동으로 정리됩니다.",
  },
  {
    icon: MessageSquareQuote,
    title: "근거 있는 논문 채팅",
    desc: "질문하면 본문 페이지·스니펫을 인용해 답합니다. 클릭 한 번으로 원문으로 점프.",
  },
  {
    icon: Highlighter,
    title: "오토 하이라이트",
    desc: "기여·방법·결과·한계를 색으로 구분해 자동 강조. 한눈에 구조가 보입니다.",
  },
  {
    icon: Headphones,
    title: "팟캐스트 변환",
    desc: "논문을 대화형 오디오로. 출퇴근길에 귀로 듣는 논문 리뷰.",
  },
  {
    icon: Bookmark,
    title: "라이브러리 · 노트",
    desc: "컬렉션·태그·즐겨찾기로 정리하고, 하이라이트와 메모를 Obsidian으로 내보냅니다.",
  },
];

export default function LandingPage() {
  const refreshMe = useAuth((s) => s.refreshMe);
  const user = useAuth((s) => s.user);
  const isLoggedIn = user !== null && !user.anonymous;

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const primaryHref = "/library";
  const primaryLabel = isLoggedIn ? "내 라이브러리로" : "무료로 시작하기";

  return (
    <div className="relative min-h-full overflow-hidden bg-bg-base">
      {/* 배경 그라데이션 오브 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="pl-orb absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c5cfc55, transparent 70%)" }}
        />
        <div
          className="pl-orb absolute -right-24 top-24 h-[24rem] w-[24rem] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, #2d6fe044, transparent 70%)", animationDelay: "-5s" }}
        />
        <div
          className="pl-orb absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #2ea66b33, transparent 70%)", animationDelay: "-9s" }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold text-text-primary">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-primary text-white shadow-sm">
            <Sparkles size={16} />
          </span>
          PaperLight
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
          >
            로그인
          </Link>
          <Link
            href={primaryHref}
            className="rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
          >
            시작하기
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <div className="pl-rise inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-text-secondary backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          읽기 · 번역 · 요약 · 대화를 한 화면에서
        </div>
        <h1
          className="pl-rise mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          논문을,{" "}
          <span className="bg-gradient-to-r from-brand-primary to-info bg-clip-text text-transparent">
            빛의 속도로
          </span>{" "}
          읽다
        </h1>
        <p
          className="pl-rise mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-text-secondary sm:text-lg"
          style={{ animationDelay: "120ms" }}
        >
          PaperLight는 AI 논문 리더입니다. 인라인 번역, 자동 요약, 근거 있는 채팅, 오토
          하이라이트로 길고 복잡한 논문을 한 번에 효율적으로 파악하세요.
        </p>
        <div
          className="pl-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "180ms" }}
        >
          <Link
            href={primaryHref}
            className="group inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-primary-hover hover:shadow-lg"
          >
            {primaryLabel}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-surface px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-muted"
          >
            arXiv 논문 가져오기
          </Link>
        </div>
        <p
          className="pl-rise mt-4 text-xs text-text-muted"
          style={{ animationDelay: "220ms" }}
        >
          가입 없이 바로 체험 · 샘플 논문 2편 내장
        </p>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="pl-rise group rounded-2xl border border-border-subtle bg-bg-surface/80 p-5 backdrop-blur transition-all hover:border-border-default hover:shadow-md"
                style={{ animationDelay: `${260 + i * 60}ms` }}
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

      {/* CTA band */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-br from-brand-primary to-[#6a4ae8] px-8 py-12 text-center shadow-lg sm:px-16 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            지금 첫 논문을 열어보세요
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80">
            설치도, 설정도 필요 없습니다. 브라우저에서 바로 읽기 시작하세요.
          </p>
          <Link
            href={primaryHref}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-primary shadow-md transition-transform hover:scale-[1.02]"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-text-muted sm:flex-row">
          <span>© 2026 PaperLight</span>
          <span>AI paper reader — read, listen, summarize, discover.</span>
        </div>
      </footer>
    </div>
  );
}
