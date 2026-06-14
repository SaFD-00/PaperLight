// @vitest-environment node
//
// 실제 파일럿 PDF 회귀 테스트. viewer.js와 동일하게 pdfjs-dist로 페이지별 text item을
// BodyItem으로 구성한 뒤 extractBody(+문서 수준 scan)를 돌려, 저자·이메일·참고문헌 같은
// 비본문이 추출 본문에 새지 않는지 검증한다. 합성 케이스가 못 잡는 실제 분포를 지킨다.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import {
  extractBody,
  scanReferenceActivation,
  scanRunningFurniture,
} from "../../../public/pdfjs/bodyFilter.js";

const FIX = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures/pilot-papers");

const FIXTURES = [
  "deepseekmath",
  "evermemos",
  "textgrad",
  "iclr-pedagogical-distill",
  "2602.09856-code2world",
  "2605.10347-mobile-world-model-gui-agents",
];

// viewer.js(런타임)의 BodyItem 구성과 동일.
async function extractWholePaper(slug: string): Promise<string> {
  const data = new Uint8Array(readFileSync(resolve(FIX, `${slug}.pdf`)));
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false })
    .promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const pageH = page.getViewport({ scale: 1 }).height;
    const tc = await page.getTextContent();
    const styles = tc.styles || {};
    pages.push(
      tc.items
        .filter((it): it is import("pdfjs-dist/types/src/display/api").TextItem => "str" in it)
        .map((it) => ({
          str: it.str,
          hasEOL: !!it.hasEOL,
          fontHeight: it.height || Math.hypot(it.transform[2], it.transform[3]),
          normTop: pageH > 0 ? (pageH - it.transform[5]) / pageH : 0,
          fontFamily: (styles[it.fontName] && styles[it.fontName].fontFamily) || "",
          inFigure: false,
        })),
    );
  }
  await doc.destroy();
  const refActive = scanReferenceActivation(pages);
  const furniture = scanRunningFurniture(pages);
  return pages
    .map(
      (items, i) =>
        extractBody(items, { firstPage: i === 0, refActiveAtStart: refActive[i], furniture })
          .bodyText,
    )
    .join("\n");
}

describe("bodyFilter — 실제 파일럿 PDF 회귀(저자·이메일·참고문헌 미누출)", () => {
  for (const slug of FIXTURES) {
    it(
      `${slug}: 비본문이 본문에 새지 않는다`,
      async () => {
        const meta = JSON.parse(readFileSync(resolve(FIX, `${slug}.meta.json`), "utf8"));
        const body = await extractWholePaper(slug);

        // 본문이 충분히 추출됐다(추출 실패가 아니다).
        expect(body.length).toBeGreaterThan(10_000);
        // 저자 이메일 라인 없음.
        expect(body).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
        // 참고문헌 전용 시그니처 없음(본문엔 등장하지 않는 표현).
        expect(body).not.toMatch(/arXiv preprint arXiv:\s*\d{4}\.\d{4,5}/i);
        expect(body).not.toMatch(/In Proceedings of/i);
        // meta 저자명("Surname, Given" 양식)은 front-matter/참고문헌에만 존재 → 본문에 없어야 함.
        for (const author of meta.authors ?? []) {
          expect(body).not.toContain(author);
        }
      },
      30_000,
    );
  }
});
