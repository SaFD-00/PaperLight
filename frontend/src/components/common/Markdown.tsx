import { Children, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CrossRefText } from "@/components/reader/CrossRefText";

// Tailwind typography 플러그인 없이 토큰 색상에 맞춘 최소 마크다운 스타일.
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 text-base font-semibold text-text-primary">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-sm font-semibold text-text-primary">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold text-text-secondary">{children}</h3>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-brand-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border-default pl-3 text-text-secondary">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded bg-bg-muted p-2 font-mono text-xs text-text-primary">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[0.85em] text-text-primary">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2">{children}</pre>,
  hr: () => <hr className="my-3 border-border-subtle" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border-subtle px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border-subtle px-2 py-1">{children}</td>,
};

/** 문자열 children을 cross-ref 프리뷰로 감싼다(비문자열은 그대로). F-07. */
function linkifyChildren(children: ReactNode, paperId: string): ReactNode {
  return Children.map(children, (child) =>
    typeof child === "string" ? <CrossRefText paperId={paperId} text={child} /> : child,
  );
}

/** 패널 출력용 마크다운 렌더러. crossRefPaperId 지정 시 본문 cross-ref 호버 프리뷰(F-07). */
export function Markdown({
  children,
  crossRefPaperId,
}: {
  children: string;
  crossRefPaperId?: string;
}) {
  const components: Components = crossRefPaperId
    ? {
        ...COMPONENTS,
        p: ({ children }) => (
          <p className="my-1.5 leading-relaxed">{linkifyChildren(children, crossRefPaperId)}</p>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{linkifyChildren(children, crossRefPaperId)}</li>
        ),
      }
    : COMPONENTS;
  return (
    <div className="text-sm text-text-primary [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
