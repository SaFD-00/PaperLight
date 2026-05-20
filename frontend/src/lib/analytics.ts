import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

export function analyticsEnabled(): boolean {
  return typeof window !== "undefined" && Boolean(KEY);
}

export async function initAnalytics(): Promise<void> {
  if (client || !analyticsEnabled()) return;
  const posthog = (await import("posthog-js")).default;
  posthog.init(KEY as string, { api_host: HOST });
  client = posthog;
}

export function capture(event: string, props?: Record<string, unknown>): void {
  client?.capture(event, props);
}

export function identify(distinctId: string): void {
  client?.identify(distinctId);
}
