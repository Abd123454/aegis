import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/aegis/interpreter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code: string = typeof body?.code === "string" ? body.code : "";
    if (!code.trim()) {
      return NextResponse.json({ ok: false, output: [], diagnostics: [{ kind: "error", phase: "parse", line: 0, col: 0, msg: "Empty program." }] });
    }
    const result = run(code);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      output: [],
      diagnostics: [{ kind: "error", phase: "runtime", line: 0, col: 0, msg: String(e?.message || e) }],
    });
  }
}

export async function GET() {
  return NextResponse.json({ name: "Aegis interpreter", endpoint: "POST /api/aegis/run", body: { code: "string" } });
}
