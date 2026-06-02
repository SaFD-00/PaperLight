"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";

import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuth } from "@/stores/auth";

export default function LoginPage() {
  const router = useRouter();
  const mockLogin = useAuth((s) => s.mockLogin);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const user = await mockLogin(email.trim());
    setPending(false);
    if (user) {
      router.push("/library");
    } else {
      setError("로그인 실패. dev 환경인지 확인하세요.");
    }
  }

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-bg-base p-6">
      {/* 배경 오브 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="pl-orb absolute -left-24 -top-24 h-[24rem] w-[24rem] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c5cfc55, transparent 70%)" }}
        />
        <div
          className="pl-orb absolute -bottom-24 -right-24 h-[22rem] w-[22rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #2d6fe044, transparent 70%)", animationDelay: "-6s" }}
        />
      </div>

      <div className="pl-rise relative z-10 w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={13} />
          홈으로
        </Link>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface/90 p-7 shadow-lg backdrop-blur">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-primary text-white shadow-sm">
              <Sparkles size={20} />
            </span>
            <h1 className="mt-3 text-lg font-semibold text-text-primary">PaperLight 로그인</h1>
            <p className="mt-1 text-xs text-text-secondary">
              계정으로 라이브러리와 노트를 모든 기기에서 동기화하세요.
            </p>
          </div>

          <GoogleButton />

          <div className="my-4 flex items-center gap-3 text-[11px] text-text-muted">
            <span className="h-px flex-1 bg-border-subtle" />
            또는 이메일로
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-text-secondary">
              이메일
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-brand-primary"
              />
            </label>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {pending ? "로그인 중…" : "이메일로 계속하기"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-text-muted">
            계속 진행하면 서비스 약관에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
