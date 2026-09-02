import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hub } from "@/lib/events";
import { DESK_EVENT, logDeskEvent } from "@/lib/desk-log";
import { sendCloseSurvey } from "@/lib/survey";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { outcome?: string; note?: string };
  const outcome = body.outcome === "unresolved" ? "unresolved" : "resolved";

  const previous = await prisma.conversation.findUnique({ where: { id } });
  if (!previous) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const [userCount, agentCount] = await Promise.all([
    prisma.message.count({ where: { conversationId: id, senderType: "USER" } }),
    prisma.message.count({ where: { conversationId: id, senderType: "AGENT" } }),
  ]);

  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: "CLOSED",
      botEnabled: false,
      closedAt: new Date(),
      closeOutcome: outcome,
    },
  });

  const eventType = outcome === "resolved" ? DESK_EVENT.closed_resolved : DESK_EVENT.closed_unresolved;
  await logDeskEvent({
    type: eventType,
    conversationId: id,
    actorUserId: user.id,
    fromAgentId: previous.assignedAgentId,
    toAgentId: previous.assignedAgentId,
    intent: previous.lastIntent,
    outcome,
    note: body.note,
    source: "agent",
    metadata: {
      userMessages: userCount,
      agentMessages: agentCount,
      waitMs: previous.assignedAt ? previous.assignedAt.getTime() - previous.createdAt.getTime() : null,
      handleMs: previous.assignedAt ? Date.now() - previous.assignedAt.getTime() : Date.now() - previous.createdAt.getTime(),
    },
  });

  await sendCloseSurvey({
    conversationId: id,
    phone: conversation.whatsappPhone,
    actorUserId: user.id,
  });
  hub.emitEvent({ type: "conversation.updated", payload: conversation });
  return NextResponse.json({ conversation });
}
