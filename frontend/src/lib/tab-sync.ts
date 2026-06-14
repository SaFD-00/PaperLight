/**
 * FE Zustand ↔ BE Tab API 동기 (last-write-wins).
 * 단일 사용자 로컬 앱: 항상 동기, 실패는 silent (BE 미기동이어도 FE는 동작).
 */
import { apiUrl, isBrowser } from "@/lib/api";
import type { Tab } from "@/stores/tabs";

type TabWire = Tab & { updatedAt: number };

function toWire(tab: Tab): TabWire {
  return { ...tab, updatedAt: Date.now() };
}

function silentFail(_err: unknown): void {
  /* Phase 0: BE 미기동 허용. Phase 1에서 retry queue. */
}

export async function pushTabUpsert(tab: Tab): Promise<void> {
  if (!isBrowser()) return;
  try {
    await fetch(apiUrl("/api/tabs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toWire(tab)),
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function pushTabPatch(
  id: string,
  patch: Partial<Pick<Tab, "title" | "position" | "pinned" | "lastActiveAt" | "paperId">>,
): Promise<void> {
  if (!isBrowser()) return;
  try {
    await fetch(apiUrl(`/api/tabs/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...patch, updatedAt: Date.now() }),
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function pushTabDelete(id: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    await fetch(apiUrl(`/api/tabs/${encodeURIComponent(id)}`), {
      method: "DELETE",
    });
  } catch (err) {
    silentFail(err);
  }
}

export async function fetchTabs(): Promise<Tab[] | null> {
  if (!isBrowser()) return null;
  try {
    const res = await fetch(apiUrl("/api/tabs"));
    if (!res.ok) return null;
    const data = (await res.json()) as TabWire[];
    return data.map(({ updatedAt: _u, ...t }) => t);
  } catch {
    return null;
  }
}
