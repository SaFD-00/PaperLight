const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * Server-side guard: BE 호출은 브라우저에서만. SSR/Node test 환경은 noop.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * BE 호출 wrapper — credentials include (httpOnly cookie 자동 첨부) + 401 시 refresh 1회 재시도.
 * Phase 1 S7b.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(apiUrl(path), { ...init, credentials: "include" });
  if (res.status !== 401 || path.startsWith("/api/auth/")) return res;
  const refreshed = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });
  if (!refreshed.ok) return res;
  return fetch(apiUrl(path), { ...init, credentials: "include" });
}
