export const ROLES = {
  SUPERADMIN: "SUPERADMIN",
  AGENT: "AGENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CONVERSATION_STATUS = {
  BOT: "BOT",
  PENDING: "PENDING",
  HUMAN: "HUMAN",
  CLOSED: "CLOSED",
} as const;

export type ConversationStatus =
  (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

export const SENDER = {
  BOT: "BOT",
  USER: "USER",
  AGENT: "AGENT",
} as const;

export type SenderType = (typeof SENDER)[keyof typeof SENDER];

export const DEPARTMENTS = [
  "Consultas Generales y Ejercicio Profesional",
  "Matriculación",
  "Tesorería",
  "Legales",
  "Asesoría Legal",
  "Asesoría Técnica",
  "Asesoría en Gas",
  "Caja y Jubilación",
  "Tramitación",
  "Visador",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DEFAULT_DEPARTMENT: Department = "Consultas Generales y Ejercicio Profesional";

export function departmentSelectOptions(current?: string | null) {
  if (current && !(DEPARTMENTS as readonly string[]).includes(current)) {
    return [current, ...DEPARTMENTS];
  }
  return [...DEPARTMENTS];
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  BOT: "Atendido por bot",
  PENDING: "Pendiente de derivación",
  HUMAN: "En atención humana",
  CLOSED: "Cerrado",
};
