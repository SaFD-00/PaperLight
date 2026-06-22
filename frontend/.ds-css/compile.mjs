// Tailwind v4 → 정적 CSS 컴파일 (design-sync cssEntry 생성).
// cwd=frontend 에서 실행해야 @tailwindcss/postcss 와 콘텐츠 스캔이 동작한다.
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const inPath = fileURLToPath(new URL("./input.css", import.meta.url));
const outPath = fileURLToPath(new URL("./ds-compiled.css", import.meta.url));
const css = readFileSync(inPath, "utf8");

const result = await postcss([tailwind()]).process(css, { from: inPath, to: outPath });
writeFileSync(outPath, result.css);
console.error(`[tailwind] wrote ${outPath} (${result.css.length} bytes)`);
