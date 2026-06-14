// KaTeX dist(css·js·fonts)를 정적 PDF 뷰어(iframe)로 vendoring 한다.
// pdf.js 뷰어는 public/pdfjs/ 에서 정적 서빙되어 node_modules 를 import 할 수 없으므로
// (pdf.min.mjs 와 동일하게) KaTeX 도 public 으로 복사해 <script>/<link> 로 로드한다.
// 산출물은 커밋한다. `pnpm vendor:katex` 로 재생성(katex devDependency 버전 기준).
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../node_modules/katex/dist");
const dest = resolve(here, "../public/pdfjs/vendor/katex");

mkdirSync(resolve(dest, "fonts"), { recursive: true });
copyFileSync(resolve(src, "katex.min.css"), resolve(dest, "katex.min.css"));
copyFileSync(resolve(src, "katex.min.js"), resolve(dest, "katex.min.js"));
for (const f of readdirSync(resolve(src, "fonts"))) {
  copyFileSync(resolve(src, "fonts", f), resolve(dest, "fonts", f));
}
console.log(`vendored KaTeX → ${dest}`);
