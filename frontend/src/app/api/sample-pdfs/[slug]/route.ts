import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const FIXTURES = path.resolve(process.cwd(), "..", "fixtures", "pilot-papers");

// paperId(sample-N) → fixtures 파일명. 백엔드 seed.py SAMPLES 와 동일 매핑 유지.
const SLUG_TO_FILE: Record<string, string> = {
  "sample-1": "2602.09856-code2world.pdf",
  "sample-2": "2605.10347-mobile-world-model-gui-agents.pdf",
  "sample-3": "2305.10601-tree-of-thoughts.pdf",
  "sample-4": "2310.16834-icml-score-entropy.pdf",
  "sample-5": "2201.03545-convnext-cvpr.pdf",
  "sample-6": "2311.09210-chain-of-note-emnlp.pdf",
  "sample-7": "2501.02997-calm-aaai.pdf",
  "sample-8": "2405.07011-fair-graph-www.pdf",
  "sample-9": "natcomm-2022-precip-nowcasting.pdf",
  "sample-10": "2310.15641-coverage-tpami.pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const file = SLUG_TO_FILE[slug];
  if (!file) return new NextResponse("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(FIXTURES, file));
    const body = new Uint8Array(data);
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(body.byteLength),
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Pilot PDF not found", { status: 404 });
  }
}
