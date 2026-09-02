import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hub } from "@/lib/events";
import { saveMessage } from "@/lib/bot";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { DESK_EVENT, logDeskEvent } from "@/lib/desk-log";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const previous = await prisma.conversation.findUnique({ where: { id } });
  if (!previous) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: "BOT",
      botEnabled: true,
    },
  });

  await logDeskEvent({
    type: DESK_EVENT.released,
    conversationId: id,
    actorUserId: user.id,
    fromAgentId: previous.assignedAgentId,
    intent: previous.lastIntent,
    source: "agent",
  });

  const notice = "La conversación volvió al asistente automático de Regional 5.";
  await saveMessage({
    conversationId: id,
    senderType: "BOT",
    content: notice,
    metadata: { kind: "release" },
  });
  await sendWhatsAppText(conversation.whatsappPhone, notice);
  hub.emitEvent({ type: "conversation.updated", payload: conversation });
  return NextResponse.json({ conversation });
}
