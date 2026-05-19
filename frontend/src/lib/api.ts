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
