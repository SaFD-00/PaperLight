import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "node_modules/pdfjs-dist/build");
const dst = resolve(root, "public/pdfjs");

mkdirSync(dst, { recursive: true });
copyFileSync(`${src}/pdf.min.mjs`, `${dst}/pdf.min.mjs`);
copyFileSync(`${src}/pdf.worker.min.mjs`, `${dst}/pdf.worker.min.mjs`);
console.log("✓ pdf.js → public/pdfjs/");
