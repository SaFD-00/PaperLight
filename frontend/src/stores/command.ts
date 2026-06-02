import { create } from "zustand";

interface CommandState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** ⌘K 커맨드 팔레트 열림 상태. 툴바 버튼·단축키·팔레트가 공유. */
export const useCommand = create<CommandState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
