import { prisma } from "./db";

export const DESK_EVENT = {
  assigned: "assigned",
  pending: "pending",
  takeover: "takeover",
  released: "released",
  closed_resolved: "closed_resolved",
  closed_unresolved: "closed_unresolved",
  reopened: "reopened",
  out_of_scope: "out_of_scope",
  survey_sent: "survey_sent",
  survey_rated: "survey_rated",
  survey_skipped: "survey_skipped",
} as const;

export type DeskEventType = (typeof DESK_EVENT)[keyof typeof DESK_EVENT];

export type LogDeskEventInput = {
  type: DeskEventType;
  conversationId: string;
  actorUserId?: string | null;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  department?: string | null;
  intent?: string | null;
  outcome?: string | null;
  note?: string | null;
  source?: "bot" | "agent" | "system";
  metadata?: unknown;
};

export async function logDeskEvent(input: LogDeskEventInput) {
  let department = input.department ?? null;
  if (!department && input.toAgentId) {
    const profile = await prisma.agentProfile.findFirst({
      where: { userId: input.toAgentId },
      select: { department: true },
    });
    department = profile?.department ?? null;
  }

  return prisma.deskEvent.create({
    data: {
      type: input.type,
      conversationId: input.conversationId,
      actorUserId: input.actorUserId ?? null,
      fromAgentId: input.fromAgentId ?? null,
      toAgentId: input.toAgentId ?? null,
      department,
      intent: input.intent ?? null,
      outcome: input.outcome ?? null,
      note: input.note?.trim() || null,
      source: input.source ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export function weekRange(offsetWeeks = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const utcNoon = Date.UTC(y, m - 1, d, 12);
  const date = new Date(utcNoon);
  const mondayIndex = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayIndex + offsetWeeks * 7);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const start = new Date(`${yyyy}-${mm}-${dd}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export const EVENT_LABELS: Record<string, string> = {
  assigned: "Derivación",
  pending: "Pendiente de asesor",
  takeover: "Toma de control",
  released: "Devuelto al bot",
  closed_resolved: "Cerrado resuelto",
  closed_unresolved: "Cerrado sin solución",
  reopened: "Reabierto",
  out_of_scope: "Fuera de tema",
  survey_sent: "Encuesta enviada",
  survey_rated: "Encuesta respondida",
  survey_skipped: "Encuesta omitida",
};
