# PaperLight — building with this design system

PaperLight is a single-user local AI paper-reader (themoonlight.io-style): 3-column reader (sidebar / PDF+translation / AI panel), sentence-level translation, layered summaries, grounded chat, figure/formula explainers, auto-highlights, notes. The components here are the **real shipped components** from the app's `frontend/`.

## Setup & wrapping
- **No provider is needed for styling.** Design tokens live as CSS custom properties on `:root` (shipped via `styles.css`), so every component is styled as soon as the stylesheet loads. Render a component directly: `import { SummaryPanel } from "<pkg>"; <SummaryPanel paperId="…" />`.
- `ThemeProvider` is **not** a styling context — it only mirrors `theme`/`density` onto `data-theme`/`data-density` on the document. Default (`:root` / `data-theme="light"`) is fully styled. Wrap in `<ThemeProvider>` only to demo dark mode (`data-theme="dark"`) or density.
- Several components read **zustand stores** that are also exported from the bundle: `useReader`, `useMarkup`, `useFigures`, `useTabs`, `useSettings`. Reader-overlay components (`SearchBar`, `FloatingSelectionMenu`, `SelectionExplainPopover`, `SelectionTranslatePopover`, `FigureExplainPopover`) render `null` until their store slice is set — seed it first, e.g. `useReader.setState({ searchOpen: true })`, then render `<SearchBar />`.

## The styling idiom — design tokens via `var(--*)`
PaperLight is a **Tailwind v4** app whose utilities are generated from the token set below. **Important for new markup you write:** only the utility classes the shipped components already use are compiled into the stylesheet — arbitrary Tailwind class names you invent will NOT resolve. So:
1. **Compose with the library components** for anything they cover — they carry their own styling.
2. For your own layout/glue, **style with the CSS token variables** (always available), not invented utility classes:

| Family | Tokens (`var(--…)`) |
|---|---|
| Brand | `--brand-primary`, `--brand-primary-hover`, `--brand-primary-soft`, `--brand-primary-text` |
| Surface | `--bg-base`, `--bg-surface`, `--bg-muted`, `--bg-overlay` |
| Border | `--border-subtle`, `--border-default`, `--border-strong` |
| Text | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse` |
| Feedback | `--success`, `--warning`, `--danger`, `--info` |
| Highlight (F-10) | `--hl-contribution`, `--hl-method`, `--hl-result`, `--hl-limitation` |
| Spacing (×4) | `--space-1` … `--space-12` |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl` |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-focus` |
| Font | `--font-sans`, `--font-mono` |

The matching utility families that DO ship (because the components use them) include `bg-bg-surface` / `bg-bg-muted` / `bg-brand-primary`, `text-text-primary` / `text-text-secondary` / `text-text-muted`, `border-border-subtle` / `border-border-default`, `text-danger` / `text-warning`, `rounded-{sm,md,lg,xl,2xl}`, `shadow-{sm,md,lg}` — safe to reuse, but prefer the token vars for anything new.

## Where the truth lives
- Tokens & global styles: the bound `styles.css` and its `@import` closure (tokens + component CSS). Read these before styling.
- Per-component API: each component's `<Name>.d.ts` (props) and `<Name>.prompt.md` (usage). Note: props are synth-extracted and often typed loosely — read the prompt doc and the component's preview for real prop shapes.

## One idiomatic snippet
```tsx
import { SummaryPanel, IconButton } from "<pkg>";
import { BookOpen } from "lucide-react";

<div style={{ width: 340, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" }}>
  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-3)", borderBottom: "1px solid var(--border-subtle)" }}>
    <BookOpen size={15} style={{ color: "var(--text-secondary)" }} />
    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>Summary</span>
    <IconButton label="설정"><BookOpen size={16} /></IconButton>
  </div>
  <SummaryPanel paperId="demo" />
</div>
```
