import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { markRead, requireMembership, serializeThread } from "@/lib/team-chat";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const member = await requireMembership(id, user.id);
  if (!member) return NextResponse.json({ error: "No forma parte de este chat" }, { status: 403 });

  const [thread, messages] = await Promise.all([
    serializeThread(id, user.id),
    prisma.teamChatMessage.findMany({
      where: { threadId: id },
      include: { sender: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!thread) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await markRead(id, user.id);

  return NextResponse.json({
    thread: { ...thread, unread: 0 },
    messages: messages.map((message) => ({
      id: message.id,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderName: message.sender?.fullName ?? "Agente",
    })),
  });
}
