import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const [conversations, pending, human, bot, closed, chunks, agentsOnline] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { status: "PENDING" } }),
    prisma.conversation.count({ where: { status: "HUMAN" } }),
    prisma.conversation.count({ where: { status: "BOT" } }),
    prisma.conversation.count({ where: { status: "CLOSED" } }),
    prisma.knowledgeChunk.count(),
    prisma.user.count({ where: { isOnline: true, role: "AGENT" } }),
  ]);

  return NextResponse.json({
    conversations,
    pending,
    human,
    bot,
    closed,
    chunks,
    agentsOnline,
  });
}
