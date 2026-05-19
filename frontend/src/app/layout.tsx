import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { inter, jbMono, pretendard } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "PaperLight",
  description: "AI paper reader — read, listen, summarize, discover.",
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
