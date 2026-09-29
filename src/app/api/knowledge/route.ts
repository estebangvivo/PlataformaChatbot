import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { readLastSync } from "@/lib/ingest";
import { msUntilNightlyHour } from "@/lib/nightly-sync";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  const chunks = await prisma.knowledgeChunk.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      pageUrl: true,
      title: true,
      category: true,
      contentChunk: true,
      createdAt: true,
    },
  });
  chunks.sort((a, b) => {
    const aFicha = a.title?.startsWith("[ficha]") ? 0 : 1;
    const bFicha = b.title?.startsWith("[ficha]") ? 0 : 1;
    return aFicha - bFicha;
  });
  const lastSync = await readLastSync();
  return NextResponse.json({
    chunks,
    total: chunks.length,
    lastSync,
    nextInMs: msUntilNightlyHour(),
  });
}
