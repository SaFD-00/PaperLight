"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="grid h-full place-items-center bg-bg-base p-6">
      <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-text-primary">PaperLight 로그인</h1>
        <p className="mb-4 text-xs text-text-secondary">
          Phase 1 S7b — Mock 로그인 (dev 전용). Google OAuth는 자격 정보 발급 후 활성화됩니다.
        </p>
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
              className="mt-1 block w-full rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-brand-primary"
            />
          </label>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-50"
          >
            {pending ? "로그인 중…" : "Mock 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
