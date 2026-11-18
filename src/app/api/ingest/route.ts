import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { ingestRegional5 } from "@/lib/ingest";

export const maxDuration = 120;

export async function POST() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const result = await ingestRegional5({ source: "manual" });
  return NextResponse.json(result);
}
