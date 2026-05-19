import { apiUrl, isBrowser } from "@/lib/api";

export interface SseHandler {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

/**
 * Phase 0 SSE 소비 — `data: {...}\n\n` 라인을 파싱하여 token/error/[DONE]을 분기.
 */
export async function streamSse(
  path: string,
  body: unknown,
  handler: SseHandler,
  signal?: AbortSignal,
): Promise<void> {
  if (!isBrowser()) return;
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    handler.onError(err instanceof Error ? err.message : "network error");
    return;
  }
  if (!res.ok || !res.body) {
    handler.onError(`HTTP ${res.status}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          handler.onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data) as { token?: string; error?: string };
          if (parsed.error) {
            handler.onError(parsed.error);
            return;
          }
          if (parsed.token) handler.onToken(parsed.token);
        } catch {
          // ignore malformed line
        }
      }
    }
    handler.onDone();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    handler.onError(err instanceof Error ? err.message : "stream error");
  }
}
