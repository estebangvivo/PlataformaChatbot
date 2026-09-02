import { prisma } from "./db";
import { emitDeskNotify, hub } from "./events";
import { answerWithRag } from "./rag";
import { hasAi } from "./ai-providers";
import { matchRouting, requestHandoff, wantsHuman, listDeskAgents, matchAgentChoice, formatHandoffMessage, assignToAgent } from "./routing";
import { converseWithAi } from "./dialogue";
import { sendWhatsAppText } from "./whatsapp";
import { isQueryRelevant, SCOPE_REJECTION } from "./scope";
import { DESK_EVENT, logDeskEvent } from "./desk-log";
import { applySurveyReply } from "./survey";
import {
  composeHumanReply,
  extractFacts,
  firstNameFromWhatsApp,
  profileLabel,
  readProfile,
  resolveTurn,
  isOnlyGreeting,
  type ContactProfile,
} from "./personality";

async function upsertConversation(phone: string, name?: string, channel: "whatsapp" | "simulator" = "whatsapp") {
  const existing = await prisma.conversation.findUnique({
    where: { whatsappPhone: phone },
  });
  const waFirst = firstNameFromWhatsApp(name);
  if (existing) {
    const profile = extractFacts("", readProfile(existing.contactProfile));
    if (waFirst && !profile.firstName) profile.firstName = waFirst;
    const awaitingSurvey = existing.status === "CLOSED" && existing.surveyStatus === "pending";
    const reopened = existing.status === "CLOSED" && !awaitingSurvey;
    const updated = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        userName: name && !/vecino/i.test(name) ? name : existing.userName,
        lastMessageAt: new Date(),
        status: reopened ? "BOT" : existing.status,
        botEnabled: reopened ? true : existing.botEnabled,
        contactProfile: JSON.stringify(profile),
        ...(reopened
          ? { closeOutcome: null, closedAt: null, reopenCount: { increment: 1 }, surveyStatus: existing.surveyStatus === "pending" ? "skipped" : existing.surveyStatus }
          : {}),
      },
    });
    if (reopened) {
      await logDeskEvent({
        type: DESK_EVENT.reopened,
        conversationId: existing.id,
        fromAgentId: existing.assignedAgentId,
        intent: existing.lastIntent,
        source: "system",
      });
    }
    return updated;
  }
  const profile: ContactProfile = {
    interests: [],
    notes: [],
    unansweredStreak: 0,
    firstName: waFirst,
  };
  return prisma.conversation.create({
    data: {
      whatsappPhone: phone,
      userName: name || waFirst || null,
      status: "BOT",
      lastMessageAt: new Date(),
      contactProfile: JSON.stringify(profile),
      channel,
    },
  });
}

export async function saveMessage(params: {
  conversationId: string;
  senderType: "BOT" | "USER" | "AGENT";
  content: string;
  agentId?: string;
  whatsappId?: string;
  metadata?: unknown;
}) {
  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      senderType: params.senderType,
      content: params.content,
      agentId: params.agentId,
      whatsappId: params.whatsappId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
  if (params.senderType === "BOT") {
    await prisma.conversation.updateMany({
      where: { id: params.conversationId, firstBotReplyAt: null },
      data: { firstBotReplyAt: new Date() },
    });
  }
  if (params.senderType === "AGENT") {
    await prisma.conversation.updateMany({
      where: { id: params.conversationId, firstHumanReplyAt: null },
      data: { firstHumanReplyAt: new Date() },
    });
  }
  const conversation = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date() },
  });
  hub.emitEvent({ type: "message.created", payload: message });
  hub.emitEvent({
    type: "conversation.updated",
    payload: { conversationId: params.conversationId },
  });
  if (params.senderType === "USER" && conversation.assignedAgentId && conversation.status === "HUMAN") {
    const snippet = params.content.replace(/\s+/g, " ").slice(0, 90);
    emitDeskNotify({
      agentUserId: conversation.assignedAgentId,
      conversationId: params.conversationId,
      title: "Nuevo mensaje",
      body: `${conversation.userName ?? "WhatsApp"}: ${snippet}`,
      kind: "message",
    });
  }
  return message;
}

async function persistProfile(conversationId: string, profile: ContactProfile, extra?: { userName?: string; lastIntent?: string }) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      contactProfile: JSON.stringify(profile),
      ...(extra?.userName ? { userName: extra.userName } : {}),
      ...(extra?.lastIntent ? { lastIntent: extra.lastIntent } : {}),
    },
  });
}

export async function handleInboundWhatsApp(params: {
  phone: string;
  name?: string;
  text: string;
  whatsappId?: string;
  channel?: "whatsapp" | "simulator";
}) {
  const conversation = await upsertConversation(params.phone, params.name, params.channel);
  await saveMessage({
    conversationId: conversation.id,
    senderType: "USER",
    content: params.text,
    whatsappId: params.whatsappId,
  });

  if (conversation.status === "CLOSED" && conversation.surveyStatus === "pending") {
    const survey = await applySurveyReply(conversation.id, params.text);
    if (survey.handled) {
      return { conversationId: conversation.id, autoReplied: true, survey: true };
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "BOT",
        botEnabled: true,
        closeOutcome: null,
        closedAt: null,
        surveyStatus: "skipped",
        reopenCount: { increment: 1 },
      },
    });
    await logDeskEvent({
      type: DESK_EVENT.survey_skipped,
      conversationId: conversation.id,
      source: "system",
    });
    await logDeskEvent({
      type: DESK_EVENT.reopened,
      conversationId: conversation.id,
      source: "system",
    });
  }

  const humanMode = conversation.status === "HUMAN";
  if (humanMode) {
    return { conversationId: conversation.id, autoReplied: false };
  }

  const profile = extractFacts(params.text, readProfile(conversation.contactProfile));
  const displayName = profile.firstName
    ? profile.locality
      ? `${profile.firstName} (${profile.locality})`
      : profile.firstName
    : conversation.userName ?? undefined;

  async function sendHandoff(reason: string, chosenUserId?: string) {
    const agents = await listDeskAgents();
    const picked = chosenUserId
      ? agents.find((a) => a.userId === chosenUserId) ?? null
      : matchAgentChoice(params.text, agents);
    if (picked) {
      await requestHandoff(conversation.id, reason, { agentUserId: picked.userId });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "PENDING", botEnabled: true, lastIntent: reason },
      });
      await logDeskEvent({
        type: DESK_EVENT.pending,
        conversationId: conversation.id,
        intent: reason,
        source: "bot",
      });
      hub.emitEvent({
        type: "conversation.updated",
        payload: { conversationId: conversation.id },
      });
    }
    const reply = formatHandoffMessage(agents, picked);
    await persistProfile(
      conversation.id,
      { ...profile, unansweredStreak: 0, awaiting: picked ? null : "elegir_asesor" },
      { userName: displayName, lastIntent: reason },
    );
    await saveMessage({
      conversationId: conversation.id,
      senderType: "BOT",
      content: reply,
      metadata: { kind: "handoff" },
    });
    await sendWhatsAppText(params.phone, reply);
  }

  if (profile.awaiting === "elegir_asesor") {
    const agents = await listDeskAgents();
    const picked = matchAgentChoice(params.text, agents);
    if (picked) {
      await assignToAgent(conversation.id, picked.userId, "solicitud_humana");
      const reply = formatHandoffMessage(agents, picked);
      await persistProfile(conversation.id, { ...profile, awaiting: null, unansweredStreak: 0 }, { userName: displayName });
      await saveMessage({
        conversationId: conversation.id,
        senderType: "BOT",
        content: reply,
        metadata: { kind: "handoff" },
      });
      await sendWhatsAppText(params.phone, reply);
      return { conversationId: conversation.id, autoReplied: true, handoff: true };
    }
  }

  if (profile.awaiting === "confirmar_humano") {
    const n = params.text.trim().toLowerCase();
    if (/^(sí|si|dale|ok|okey|claro|derivame|derivá|deriva)\b/.test(n) || wantsHuman(params.text)) {
      await sendHandoff("solicitud_humana");
      return { conversationId: conversation.id, autoReplied: true, handoff: true };
    }
  }

  if (wantsHuman(params.text)) {
    await sendHandoff("solicitud_humana");
    return { conversationId: conversation.id, autoReplied: true, handoff: true };
  }

  const recent = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: "desc" },
    take: 10,
  });
  const chronological = recent.reverse();
  const history = chronological
    .filter((m) => m.senderType !== "AGENT")
    .slice(0, -1)
    .map((m) => ({
      role: (m.senderType === "USER" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  if (!isQueryRelevant(params.text)) {
    await persistProfile(conversation.id, { ...profile, unansweredStreak: 0 }, { userName: displayName });
    await saveMessage({
      conversationId: conversation.id,
      senderType: "BOT",
      content: SCOPE_REJECTION,
      metadata: { kind: "out_of_scope", outOfScope: true },
    });
    await sendWhatsAppText(params.phone, SCOPE_REJECTION);
    await logDeskEvent({
      type: DESK_EVENT.out_of_scope,
      conversationId: conversation.id,
      intent: "out_of_scope",
      source: "bot",
      note: params.text.slice(0, 200),
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "BOT", botEnabled: true, lastIntent: "out_of_scope" },
    });
    return { conversationId: conversation.id, autoReplied: true, outOfScope: true };
  }

  const turn = resolveTurn(params.text, profile, history);
  const aiReady = await hasAi();
  const searchText = aiReady ? params.text : turn.effectiveText;
  const rag = await answerWithRag(searchText, {
    history,
    profileSummary: profileLabel(profile) || undefined,
  });

  if (aiReady) {
    try {
      const ai = await converseWithAi({
        userText: params.text,
        history,
        profile,
        chunks: rag.sources,
      });
      if (ai?.text) {
        if (ai.handoff) {
          await sendHandoff(ai.topic ?? "solicitud_humana");
          return { conversationId: conversation.id, autoReplied: true, handoff: true };
        }

        const nextProfile = {
          ...profile,
          unansweredStreak: 0,
          lastTopic: ai.topic ?? profile.lastTopic,
          awaiting: ai.needsHuman ? "confirmar_humano" : null,
        };
        await persistProfile(conversation.id, nextProfile, {
          userName: displayName,
          lastIntent: ai.outOfScope ? "out_of_scope" : ai.needsHuman ? "offer_human" : ai.topic ?? profile.lastTopic,
        });
        await saveMessage({
          conversationId: conversation.id,
          senderType: "BOT",
          content: ai.text,
          metadata: {
            usedModel: true,
            found: rag.found,
            outOfScope: ai.outOfScope,
            offerHuman: ai.needsHuman,
            sources: rag.sources.slice(0, 3).map((s) => ({ url: s.pageUrl, score: s.score })),
          },
        });
        await sendWhatsAppText(params.phone, ai.text);
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: "BOT",
            botEnabled: true,
            lastIntent: ai.needsHuman ? "offer_human" : ai.outOfScope ? "out_of_scope" : ai.topic ?? undefined,
          },
        });
        return {
          conversationId: conversation.id,
          autoReplied: true,
          confidence: rag.confidence,
          offerHuman: ai.needsHuman,
        };
      }
    } catch (error) {
      console.error("dialogue", error);
    }
  }

  const rule = await matchRouting(searchText);
  const composed = composeHumanReply({
    userText: params.text,
    profile,
    ragAnswer: rag.answer,
    confidence: rag.confidence,
    found: rag.found,
    history,
  });

  const offerHumanFallback = !rag.found && !isOnlyGreeting(params.text);

  await persistProfile(conversation.id, composed.profile, {
    userName: displayName,
    lastIntent: offerHumanFallback ? "offer_human" : rule?.intent ?? composed.profile.interests.at(-1),
  });

  await saveMessage({
    conversationId: conversation.id,
    senderType: "BOT",
    content: composed.text,
    metadata: {
      confidence: rag.confidence,
      usedModel: rag.usedModel,
      found: rag.found,
      offerHuman: offerHumanFallback,
      sources: rag.sources.slice(0, 3).map((s) => ({ url: s.pageUrl, score: s.score })),
    },
  });
  await sendWhatsAppText(params.phone, composed.text);
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "BOT", botEnabled: true, lastIntent: offerHumanFallback ? "offer_human" : rule?.intent ?? undefined },
  });

  return {
    conversationId: conversation.id,
    autoReplied: true,
    confidence: rag.confidence,
  };
}

export async function sendAgentReply(params: {
  conversationId: string;
  agentId: string;
  text: string;
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
  });
  if (!conversation) throw new Error("Conversación no encontrada");

  const message = await saveMessage({
    conversationId: conversation.id,
    senderType: "AGENT",
    content: params.text,
    agentId: params.agentId,
  });
  await sendWhatsAppText(conversation.whatsappPhone, params.text);
  return message;
}
