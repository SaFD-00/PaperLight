/**
 * FE Zustand ↔ BE Tab API 동기 (last-write-wins).
 * Phase 0: 단일 사용자, 실패는 silent (BE 미기동이어도 FE는 동작).
 */
import { apiUrl, isBrowser } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import type { Tab } from "@/stores/tabs";

type TabWire = Tab & { updatedAt: number };

/** 로그인 사용자만 서버 동기. 게스트는 공유 anonymous 유저 오염 방지를 위해 sync 생략. */
function syncEnabled(): boolean {
  if (!isBrowser()) return false;
  const u = useAuth.getState().user;
  return !!u && !u.anonymous;
}

function toWire(tab: Tab): TabWire {
  return { ...tab, updatedAt: Date.now() };
}

function silentFail(_err: unknown): void {
  /* Phase 0: BE 미기동 허용. Phase 1에서 retry queue. */
}

export async function pushTabUpsert(tab: Tab): Promise<void> {
  if (!syncEnabled()) return;
  try {
    await fetch(apiUrl("/api/tabs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toWire(tab)),
      credentials: "include",
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function pushTabPatch(
  id: string,
  patch: Partial<Pick<Tab, "title" | "position" | "pinned" | "lastActiveAt" | "paperId">>,
): Promise<void> {
  if (!syncEnabled()) return;
  try {
    await fetch(apiUrl(`/api/tabs/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...patch, updatedAt: Date.now() }),
      credentials: "include",
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function pushTabDelete(id: string): Promise<void> {
  if (!syncEnabled()) return;
  try {
    await fetch(apiUrl(`/api/tabs/${encodeURIComponent(id)}`), {
      method: "DELETE",
      credentials: "include",
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function fetchTabs(): Promise<Tab[] | null> {
  if (!isBrowser()) return null;
  try {
    const res = await fetch(apiUrl("/api/tabs"), { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as TabWire[];
    return data.map(({ updatedAt: _u, ...t }) => t);
  } catch {
    return null;
  }
}
