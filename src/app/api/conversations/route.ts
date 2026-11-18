import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminUser, requireApiUser } from "@/lib/auth";
import { sendAgentReply, startDeskConversation } from "@/lib/bot";
import type { InboundMedia } from "@/lib/media";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  const status = request.nextUrl.searchParams.get("status");
  const mine = request.nextUrl.searchParams.get("mine") === "1";

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(mine && !isAdminUser(user) ? { assignedAgentId: user.id } : {}),
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

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json()) as {
    phone?: string;
    name?: string;
    message?: string;
    media?: InboundMedia;
  };
  if (!body.phone) {
    return NextResponse.json({ error: "Falta el teléfono" }, { status: 400 });
  }

  try {
    const started = await startDeskConversation({
      phone: body.phone,
      name: body.name,
      agentId: user.id,
    });
    if (body.message?.trim() || body.media) {
      await sendAgentReply({
        conversationId: started.id,
        agentId: user.id,
        text: body.message ?? "",
        media: body.media,
      });
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: started.id },
      include: {
        assignedAgent: { select: { id: true, fullName: true } },
        messages: { orderBy: { timestamp: "asc" } },
      },
    });
    return NextResponse.json({ conversation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar el chat";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
