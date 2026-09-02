import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      messages: { orderBy: { timestamp: "asc" } },
    },
  });
  if (!conversation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ conversation });
}
