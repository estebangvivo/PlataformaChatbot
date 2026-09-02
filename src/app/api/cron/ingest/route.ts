import { NextResponse } from "next/server";
import { ingestRegional5 } from "@/lib/ingest";

export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret");
  return bearer === secret || query === secret;
}

async function run() {
  const result = await ingestRegional5({ source: "cron" });
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return run();
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return run();
}
