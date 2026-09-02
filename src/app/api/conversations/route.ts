import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const status = request.nextUrl.searchParams.get("status");
  const mine = request.nextUrl.searchParams.get("mine") === "1";

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(mine && user.role !== "SUPERADMIN" ? { assignedAgentId: user.id } : {}),
    },
    include: {
      assignedAgent: { select: { id: true, fullName: true } },
      messages: { orderBy: { timestamp: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({ conversations });
}
