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
 * BE 호출 wrapper. 단일 사용자 로컬 앱이라 인증/쿠키가 없다 — 평범한 fetch.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), init);
}
