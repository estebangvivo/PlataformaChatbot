import { prisma } from "./db";
import { parseJson, normalizeText } from "./utils";
import { parseHours, isWithinHours } from "./hours";
import { emitDeskNotify, hub } from "./events";
import { DESK_EVENT, logDeskEvent } from "./desk-log";

type Rule = {
  id: string;
  intent: string;
  department: string;
  keywords: string[];
  priority: number;
};

export async function matchRouting(text: string) {
  const rules = await prisma.routingRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const normalized = normalizeText(text);
  let best: { rule: Rule; hits: number } | null = null;

  for (const row of rules) {
    const keywords = parseJson<string[]>(row.keywords, []);
    const hits = keywords.filter((kw) => normalized.includes(normalizeText(kw))).length;
    if (hits === 0) continue;
    const candidate: Rule = {
      id: row.id,
      intent: row.intent,
      department: row.department,
      keywords,
      priority: row.priority,
    };
    if (!best || hits > best.hits || (hits === best.hits && row.priority > best.rule.priority)) {
      best = { rule: candidate, hits };
    }
  }

  return best?.rule ?? null;
}

export async function listDeskAgents() {
  const agents = await prisma.agentProfile.findMany({
    include: { user: true },
    orderBy: { department: "asc" },
  });
  const staleMs = 3 * 60 * 1000;
  return agents.map((agent) => {
    const hours = parseHours(agent.workHours);
    const seen = agent.user.lastSeenAt?.getTime() ?? 0;
    const recentlySeen = Date.now() - seen < staleMs;
    const online = Boolean(agent.user.isOnline && recentlySeen);
    return {
      profileId: agent.id,
      userId: agent.userId,
      fullName: agent.user.fullName,
      department: agent.department,
      online,
      inHours: isWithinHours(hours),
      available: online && isWithinHours(hours),
    };
  });
}

export type DeskAgent = Awaited<ReturnType<typeof listDeskAgents>>[number];

export function matchAgentChoice(text: string, agents: DeskAgent[]) {
  const n = normalizeText(text);
  const byDept = agents.find((a) => n.includes(normalizeText(a.department)));
  if (byDept) {
    const online = agents.filter((a) => a.department === byDept.department && a.online);
    return online[0] ?? byDept;
  }
  const tokens = n.split(" ").filter((t) => t.length >= 4);
  const byName = agents.filter((a) => {
    const parts = normalizeText(a.fullName).split(" ");
    return parts.some((p) => p.length >= 4 && tokens.includes(p));
  });
  if (byName.length === 1) return byName[0];
  return null;
}

export function formatHandoffMessage(agents: DeskAgent[], assigned?: DeskAgent | null) {
  const online = agents.filter((a) => a.online);
  const lines = (list: DeskAgent[]) =>
    list.map((a) => `• ${a.fullName} — ${a.department}`).join("\n");

  if (assigned) {
    return `Te dejo con ${assigned.fullName} de ${assigned.department}. En un rato te escriben por acá.`;
  }

  if (online.length) {
    return `Ahora hay gente en línea:\n${lines(online)}\n\nSi me decís el área o el nombre, te dejo con esa persona. Si no, alguien de mesa te toma en cuanto pueda.`;
  }

  if (agents.length) {
    return `Ahora no hay nadie conectado. Estas son las mesas (lun a vie 8 a 13 hs te responden):\n${lines(agents)}\n\nDecime el área y dejo el aviso para esa persona.`;
  }

  return "Dale, dejé tu consulta para que te tome alguien de Regional 5. En el horario de mesa (lun a vie 8 a 13 hs) te responden por este mismo chat.";
}

export async function assignToAgent(
  conversationId: string,
  agentUserId: string,
  reason = "derivacion",
  actorUserId?: string,
) {
  const profile = await prisma.agentProfile.findFirst({
    where: { userId: agentUserId },
    include: { user: true },
  });
  const user = await prisma.user.findUnique({ where: { id: agentUserId } });
  if (!user) return null;

  const previous = await prisma.conversation.findUnique({ where: { id: conversationId } });
  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "HUMAN",
      assignedAgentId: agentUserId,
      botEnabled: false,
      lastIntent: reason,
      ...(previous?.assignedAt ? {} : { assignedAt: new Date() }),
    },
  });

  await prisma.agentProfile.updateMany({
    where: { userId: agentUserId },
    data: { lastAssignedAt: new Date() },
  });

  await logDeskEvent({
    type: DESK_EVENT.assigned,
    conversationId,
    actorUserId,
    fromAgentId: previous?.assignedAgentId,
    toAgentId: agentUserId,
    department: profile?.department,
    intent: reason,
    source: actorUserId ? "agent" : "bot",
  });

  hub.emitEvent({
    type: "conversation.assigned",
    payload: { conversationId, assignedAgentId: agentUserId },
  });

  const contact = conversation.userName ?? "un matriculado";
  let body = `${conversation.userName ?? "Un matriculado"} espera tu atención.`;
  if (actorUserId) {
    const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (actor) body = `${actor.fullName} te derivó el chat de ${contact}.`;
  }
  emitDeskNotify(
    {
      agentUserId,
      conversationId,
      title: "Te derivaron un chat",
      body,
      kind: "assign",
    },
    actorUserId,
  );

  return {
    conversation,
    agent: profile,
    user,
  };
}

export async function pickAgent(department: string) {
  const agents = await prisma.agentProfile.findMany({
    where: { department },
    include: { user: true },
  });

  const available = agents.filter((agent) => {
    const hours = parseHours(agent.workHours);
    return agent.user.isOnline && isWithinHours(hours);
  });

  const pool = available.length > 0 ? available : agents;
  if (pool.length === 0) return null;

  const sorted = [...pool].sort((a, b) => {
    const aTime = a.lastAssignedAt?.getTime() ?? 0;
    const bTime = b.lastAssignedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  const chosen = sorted[0];
  await prisma.agentProfile.update({
    where: { id: chosen.id },
    data: { lastAssignedAt: new Date() },
  });
  return chosen;
}

export async function requestHandoff(
  conversationId: string,
  reason: string,
  opts?: { department?: string; agentUserId?: string },
) {
  if (opts?.agentUserId) {
    const assigned = await assignToAgent(conversationId, opts.agentUserId, reason);
    return assigned ? { conversation: assigned.conversation, agent: assigned.agent } : null;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) return null;

  const agent = opts?.department ? await pickAgent(opts.department) : null;
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: agent ? "HUMAN" : "PENDING",
      assignedAgentId: agent?.userId ?? conversation.assignedAgentId,
      lastIntent: reason,
      botEnabled: false,
    },
  });

  hub.emitEvent({
    type: "conversation.assigned",
    payload: { conversationId, department: opts?.department, assignedAgentId: updated.assignedAgentId },
  });
  await logDeskEvent({
    type: agent ? DESK_EVENT.assigned : DESK_EVENT.pending,
    conversationId,
    fromAgentId: conversation.assignedAgentId,
    toAgentId: updated.assignedAgentId,
    department: agent?.department ?? opts?.department,
    intent: reason,
    source: "bot",
  });
  if (updated.assignedAgentId) {
    emitDeskNotify({
      agentUserId: updated.assignedAgentId,
      conversationId,
      title: "Te derivaron un chat",
      body: `${updated.userName ?? "Un matriculado"} espera tu atención.`,
      kind: "assign",
    });
  }

  return { conversation: updated, agent };
}

export const HANDOFF_PHRASES = [
  "hablar con una persona",
  "hablar con alguien",
  "hablar con un asesor",
  "hablar con una asesora",
  "hablar con un humano",
  "hablar con un agente",
  "quiero un asesor",
  "quiero una asesora",
  "quiero un humano",
  "pasame con un asesor",
  "pasame con un agente",
  "operador",
  "agente humano",
  "atencion humana",
  "atención humana",
  "derivar",
  "no me sirve",
  "no entendiste",
  "representante",
];

export function wantsHuman(text: string) {
  const normalized = normalizeText(text);
  if (HANDOFF_PHRASES.some((phrase) => normalized.includes(normalizeText(phrase)))) return true;
  if (/hablar con (un |una )?(asesor|asesora|humano|agente|persona|alguien)/.test(normalized)) return true;
  if (/pasame (con |a )?(un |una )?(asesor|asesora|humano|agente|persona)/.test(normalized)) return true;
  if (/\b(un humano|una persona real)\b/.test(normalized)) return true;
  return false;
}
