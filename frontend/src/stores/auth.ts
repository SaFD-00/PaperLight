import { create } from "zustand";

import { apiFetch, isBrowser } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  anonymous: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  mockLogin: (email: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  refreshMe: async () => {
    if (!isBrowser()) return;
    set({ loading: true });
    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) {
        set({ user: null, loading: false });
        return;
      }
      const body = (await res.json()) as AuthUser;
      set({ user: body, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  mockLogin: async (email: string) => {
    if (!isBrowser()) return null;
    set({ loading: true });
    try {
      const res = await apiFetch("/api/auth/dev/mock-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        set({ loading: false });
        return null;
      }
      const body = (await res.json()) as Omit<AuthUser, "anonymous">;
      const user: AuthUser = { ...body, anonymous: false };
      set({ user, loading: false });
      return user;
    } catch {
      set({ loading: false });
      return null;
    }
  },
  logout: async () => {
    if (!isBrowser()) return;
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ user: null });
    }
  },
}));
