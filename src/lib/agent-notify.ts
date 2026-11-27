import { prisma } from "./db";
import { appOrigin } from "./password";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppPhone,
  phonesMatch,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "./whatsapp";

const DEBOUNCE_MS = 90_000;

const lastNotifyAt = (() => {
  const g = globalThis as typeof globalThis & { __r5AgentWaNotify?: Map<string, number> };
  if (!g.__r5AgentWaNotify) g.__r5AgentWaNotify = new Map();
  return g.__r5AgentWaNotify;
})();

export async function findInternalAgentPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const profiles = await prisma.agentProfile.findMany({
    where: { notifyPhone: { not: null } },
    select: { notifyPhone: true, userId: true },
  });
  return profiles.find((row) => row.notifyPhone && phonesMatch(row.notifyPhone, digits)) ?? null;
}

export async function notifyAgentByWhatsApp(opts: {
  agentUserId: string;
  conversationId: string;
  contactName?: string | null;
  actorUserId?: string;
  channel?: string | null;
  agentOnline?: boolean;
}) {
  if (opts.actorUserId && opts.actorUserId === opts.agentUserId) return;
  if (opts.channel === "simulator") return;
  if (opts.agentOnline) return;

  const agent = await prisma.user.findUnique({
    where: { id: opts.agentUserId },
    include: { agentProfile: true },
  });
  const phone = agent?.agentProfile?.notifyPhone;
  if (!agent || !phone) return;

  const now = Date.now();
  const previous = lastNotifyAt.get(opts.agentUserId) ?? 0;
  if (now - previous < DEBOUNCE_MS) return;
  lastNotifyAt.set(opts.agentUserId, now);

  const contact = (opts.contactName || "un matriculado").trim() || "un matriculado";
  const panelUrl = `${appOrigin()}/inbox`;
  const text = `Tenés un chat esperándote en mesa: ${contact}. Entrá al panel para atender.\n${panelUrl}`;
  const template = process.env.WHATSAPP_AGENT_NOTIFY_TEMPLATE?.trim();
  const language = process.env.WHATSAPP_AGENT_NOTIFY_LANG?.trim() || "es_AR";

  try {
    if (template) {
      try {
        await sendWhatsAppTemplate(phone, template, language, [contact]);
        return;
      } catch (error) {
        console.error("[r5] plantilla de aviso a agente falló, pruebo texto", error);
      }
    }
    if (!template && !isWhatsAppConfigured()) {
      console.info("[r5] aviso WA a agente (sin Cloud API):", opts.conversationId, phone, text);
      return;
    }
    await sendWhatsAppText(phone, text);
  } catch (error) {
    console.error("[r5] no se pudo avisar al agente por WhatsApp", error);
  }
}

export function parseNotifyPhone(raw?: string | null) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const phone = normalizeWhatsAppPhone(trimmed);
  if (!phone) {
    throw new Error("El WhatsApp de aviso no es un número válido");
  }
  return phone;
}