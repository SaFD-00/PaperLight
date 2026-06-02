"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

/** Google 공식 "G" 로고(멀티컬러). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onGoogle() {
    setMsg(null);
    setPending(true);
    try {
      const res = await apiFetch("/api/auth/login/google");
      if (res.ok) {
        const body = (await res.json()) as { authUrl?: string };
        if (body.authUrl) {
          window.location.href = body.authUrl;
          return;
        }
      }
      setMsg("Google 로그인은 현재 준비 중입니다.");
    } catch {
      setMsg("Google 로그인에 연결할 수 없습니다.");
    }
    setPending(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border-default bg-bg-surface px-3 py-2.5 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-muted disabled:opacity-50"
      >
        <GoogleLogo />
        {pending ? "Google로 이동 중…" : "Google 계정으로 계속하기"}
      </button>
      {msg ? <p className="mt-2 text-center text-[11px] text-text-muted">{msg}</p> : null}
    </div>
  );
}
