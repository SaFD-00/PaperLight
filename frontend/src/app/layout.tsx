import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { inter, jbMono, pretendard } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "PaperLight",
  description: "AI 논문 리더 — 읽고, 번역하고, 요약하고, 대화하세요.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${inter.variable} ${jbMono.variable}`}
    >
      <body className="flex h-screen flex-col bg-bg-base text-text-primary">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
