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
      status: "HUMAN",
      assignedAgentId: user.id,
      botEnabled: false,
      ...(previous.assignedAt ? {} : { assignedAt: new Date() }),
    },
  });

  await logDeskEvent({
    type: DESK_EVENT.takeover,
    conversationId: id,
    actorUserId: user.id,
    fromAgentId: previous.assignedAgentId,
    toAgentId: user.id,
    intent: previous.lastIntent,
    source: "agent",
  });

  const notice = `${user.fullName} tomó el control de este chat. El bot queda en pausa.`;
  await saveMessage({
    conversationId: id,
    senderType: "BOT",
    content: notice,
    metadata: { kind: "takeover" },
  });
  await sendWhatsAppText(conversation.whatsappPhone, `Te está atendiendo ${user.fullName} de Regional 5.`);
  hub.emitEvent({ type: "conversation.assigned", payload: conversation });
  return NextResponse.json({ conversation });
}
