import { prisma } from "./db";
import { hub } from "./events";
import { DESK_EVENT, logDeskEvent } from "./desk-log";
import { sendWhatsAppText } from "./whatsapp";

export const SURVEY_PROMPT =
  "Cerramos tu consulta. Para seguir mejorando, ¿cómo calificarías la atención de Regional 5?\n1 Muy mala · 2 Mala · 3 Regular · 4 Buena · 5 Excelente\nRespondé solo con el número. Si no querés responder, escribí no.";

export function parseSurveyReply(
  text: string,
): { kind: "rating"; score: number; comment: string | null } | { kind: "skip" } | { kind: "other" } {
  const trimmed = text.trim();
  if (/^(no|nop|paso|después|despues|ahora no)\b/i.test(trimmed)) return { kind: "skip" };
  const match = trimmed.match(/^([1-5])(?:\s*[-–.:)]\s*|\s+)(.*)$/) ?? trimmed.match(/^([1-5])$/);
  if (match) {
    const comment = match[2]?.trim() || null;
    return { kind: "rating", score: Number(match[1]), comment };
  }
  return { kind: "other" };
}

async function notice(conversationId: string, content: string, metadata: unknown, phone: string) {
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderType: "BOT",
      content,
      metadata: JSON.stringify(metadata),
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
  hub.emitEvent({ type: "message.created", payload: message });
  hub.emitEvent({ type: "conversation.updated", payload: { conversationId } });
  await sendWhatsAppText(phone, content);
}

export async function sendCloseSurvey(params: {
  conversationId: string;
  phone: string;
  actorUserId?: string | null;
}) {
  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { surveyStatus: "pending", botEnabled: false },
  });
  await notice(params.conversationId, SURVEY_PROMPT, { kind: "survey" }, params.phone);
  await logDeskEvent({
    type: DESK_EVENT.survey_sent,
    conversationId: params.conversationId,
    actorUserId: params.actorUserId,
    source: "system",
  });
}

export async function applySurveyReply(conversationId: string, text: string) {
  const parsed = parseSurveyReply(text);
  if (parsed.kind === "other") return { handled: false as const };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { handled: true as const };

  if (parsed.kind === "skip") {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { surveyStatus: "skipped", surveyedAt: new Date(), botEnabled: true },
    });
    const thanks = "Sin problema. Cuando necesites algo de Regional 5, escribinos de nuevo.";
    await notice(conversationId, thanks, { kind: "survey_skip" }, conversation.whatsappPhone);
    await logDeskEvent({
      type: DESK_EVENT.survey_skipped,
      conversationId,
      source: "system",
    });
    return { handled: true as const };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      surveyStatus: "rated",
      surveyScore: parsed.score,
      surveyComment: parsed.comment,
      surveyedAt: new Date(),
      botEnabled: true,
    },
  });
  const thanks =
    parsed.score >= 4
      ? "Gracias por la nota. Cualquier otra consulta, escribinos."
      : "Gracias por contarnos. Vamos a usar tu comentario para mejorar la atención.";
  await notice(conversationId, thanks, { kind: "survey_rated", score: parsed.score }, conversation.whatsappPhone);
  await logDeskEvent({
    type: DESK_EVENT.survey_rated,
    conversationId,
    toAgentId: conversation.assignedAgentId,
    outcome: String(parsed.score),
    note: parsed.comment,
    source: "system",
    metadata: { score: parsed.score, comment: parsed.comment },
  });
  return { handled: true as const };
}
