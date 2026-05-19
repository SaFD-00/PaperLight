import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const FIXTURES = path.resolve(process.cwd(), "..", "fixtures", "pilot-papers");

const SLUG_TO_FILE: Record<string, string> = {
  "sample-1": "2602.09856-code2world.pdf",
  "sample-2": "2605.10347-mobile-world-model-gui-agents.pdf",
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
