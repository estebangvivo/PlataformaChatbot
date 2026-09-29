import { prisma } from "./db";
import { emitDeskNotify, hub } from "./events";
import { answerWithRag } from "./rag";
import { hasAi } from "./ai-providers";
import { matchRouting, requestHandoff, wantsHuman, listDeskAgents, matchAgentChoice, formatHandoffMessage } from "./routing";
import { converseWithAi } from "./dialogue";
import { sendWhatsAppText, sendWhatsAppMenu } from "./whatsapp";
import { isQueryRelevant, SCOPE_REJECTION } from "./scope";
import { DESK_EVENT, logDeskEvent } from "./desk-log";
import { applySurveyReply } from "./survey";
import { MENU_INTRO, MENU_OPTIONS, resolveMenuChoice } from "./menu";
import { subscribeAgentWait } from "./waitlist";
import { interpretUserMedia, mediaLabel, type InboundMedia } from "./media";
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
  media?: InboundMedia;
}) {
  let conversation = await upsertConversation(params.phone, params.name, params.channel);

  let userText = params.text.trim();
  let userDisplay = params.text.trim();
  if (params.media) {
    const interpreted = await interpretUserMedia(params.media);
    const icon = interpreted.kind === "audio" ? "🎙️" : interpreted.kind === "image" ? "📷" : "📄";
    userDisplay = `${icon} ${mediaLabel(interpreted.kind)}\n${interpreted.text}`;
    userText = [params.text.trim(), interpreted.text].filter(Boolean).join("\n");
  }

  await saveMessage({
    conversationId: conversation.id,
    senderType: "USER",
    content: userDisplay || userText || "(archivo)",
    whatsappId: params.whatsappId,
    metadata: params.media ? { kind: "media", mime: params.media.mime } : undefined,
  });

  if (conversation.status === "CLOSED" && conversation.surveyStatus === "pending") {
    const survey = await applySurveyReply(conversation.id, userText);
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
    const desk = await listDeskAgents();
    if (desk.some((agent) => agent.online)) {
      return { conversationId: conversation.id, autoReplied: false };
    }
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "BOT", botEnabled: true },
    });
  }

  const profile = extractFacts(userText, readProfile(conversation.contactProfile));
  const displayName = profile.firstName
    ? profile.locality
      ? `${profile.firstName} (${profile.locality})`
      : profile.firstName
    : conversation.userName ?? undefined;

  async function sendHandoff(reason: string, chosenUserId?: string) {
    const agents = await listDeskAgents();
    const picked = chosenUserId
      ? agents.find((a) => a.userId === chosenUserId) ?? null
      : matchAgentChoice(userText, agents);
    const transferable = picked?.online ? picked : null;
    const anyoneOnline = agents.some((a) => a.online);

    if (transferable) {
      await requestHandoff(conversation.id, reason, { agentUserId: transferable.userId });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "BOT", botEnabled: true, lastIntent: reason },
      });
    }

    const reply = formatHandoffMessage(agents, transferable, {
      unavailable: picked && !picked.online ? picked : null,
    });
    await persistProfile(
      conversation.id,
      {
        ...profile,
        unansweredStreak: 0,
        awaiting: transferable ? null : anyoneOnline ? "elegir_asesor" : null,
      },
      { userName: displayName, lastIntent: reason },
    );
    await saveMessage({
      conversationId: conversation.id,
      senderType: "BOT",
      content: reply,
      metadata: { kind: "handoff", offered: Boolean(transferable), anyoneOnline },
    });
    await sendWhatsAppText(params.phone, reply);
    if (!transferable) {
      await subscribeAgentWait(conversation.id, picked?.department ?? null);
    }
    return Boolean(transferable);
  }

  async function sendMenu() {
    const intro =
      params.channel === "simulator"
        ? `${MENU_INTRO}\n\n${MENU_OPTIONS.map((option) => `• ${option.title}`).join("\n")}`
        : MENU_INTRO;
    await persistProfile(conversation.id, { ...profile, unansweredStreak: 0, awaiting: null }, { userName: displayName, lastIntent: "menu" });
    await saveMessage({
      conversationId: conversation.id,
      senderType: "BOT",
      content: intro,
      metadata: { kind: "menu" },
    });
    if (params.channel !== "simulator") {
      await sendWhatsAppMenu(params.phone);
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "BOT", botEnabled: true, lastIntent: "menu" },
    });
  }

  const menuChoice = resolveMenuChoice(userText);
  if (menuChoice?.handoff) {
    const handed = await sendHandoff("solicitud_humana");
    return { conversationId: conversation.id, autoReplied: true, handoff: handed };
  }
  if (menuChoice) {
    userText = menuChoice.query;
  }

  const userCount = await prisma.message.count({
    where: { conversationId: conversation.id, senderType: "USER" },
  });
  const asksMenu = /^(menu|menú|opciones|inicio)$/i.test(userText.trim());
  if (!params.media && (asksMenu || (userCount <= 1 && isOnlyGreeting(userText) && !menuChoice))) {
    await sendMenu();
    return { conversationId: conversation.id, autoReplied: true, menu: true };
  }

  if (profile.awaiting === "elegir_asesor") {
    const agents = await listDeskAgents();
    const picked = matchAgentChoice(userText, agents);
    if (picked) {
      const handed = await sendHandoff("solicitud_humana", picked.userId);
      return { conversationId: conversation.id, autoReplied: true, handoff: handed };
    }
  }

  if (profile.awaiting === "confirmar_humano") {
    const n = userText.trim().toLowerCase();
    if (/^(sí|si|dale|ok|okey|claro|derivame|derivá|deriva)\b/.test(n) || wantsHuman(userText)) {
      const handed = await sendHandoff("solicitud_humana");
      return { conversationId: conversation.id, autoReplied: true, handoff: handed };
    }
  }

  if (wantsHuman(userText) || /\bcon\b.+\b(hablar|quisiera|pasame)\b|\b(hablar|pasame|quisiera)\b.+\bcon\b/i.test(userText)) {
    const named = matchAgentChoice(userText, await listDeskAgents());
    const handed = await sendHandoff("solicitud_humana", named?.userId);
    return { conversationId: conversation.id, autoReplied: true, handoff: handed };
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

  if (!isQueryRelevant(userText)) {
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
      note: userText.slice(0, 200),
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "BOT", botEnabled: true, lastIntent: "out_of_scope" },
    });
    return { conversationId: conversation.id, autoReplied: true, outOfScope: true };
  }

  const turn = resolveTurn(userText, profile, history);
  const aiReady = await hasAi();
  const searchText = aiReady ? userText : turn.effectiveText;
  const rag = await answerWithRag(searchText, {
    history,
    profileSummary: profileLabel(profile) || undefined,
  });

  if (aiReady) {
    try {
      const ai = await converseWithAi({
        userText,
        history,
        profile,
        chunks: rag.sources,
      });
      if (ai?.text) {
        if (ai.handoff) {
          const handed = await sendHandoff(ai.topic ?? "solicitud_humana");
          return { conversationId: conversation.id, autoReplied: true, handoff: handed };
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
    userText,
    profile,
    ragAnswer: rag.answer,
    confidence: rag.confidence,
    found: rag.found,
    history,
  });

  const offerHumanFallback = !rag.found && !isOnlyGreeting(userText);

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
