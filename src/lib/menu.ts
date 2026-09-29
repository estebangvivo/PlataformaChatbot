import { normalizeText } from "./utils";

export const MENU_OPTIONS = [
  {
    id: "menu_horarios",
    title: "Horarios",
    description: "Sede y atención",
    query: "¿Cuál es el horario de atención y dónde queda la sede?",
    handoff: false,
  },
  {
    id: "menu_turnos",
    title: "Turnos",
    description: "Asesorías",
    query: "¿Cómo saco turno para una asesoría?",
    handoff: false,
  },
  {
    id: "menu_firma",
    title: "Firma digital",
    description: "CiDi remota",
    query: "¿Cómo tramito la firma digital?",
    handoff: false,
  },
  {
    id: "menu_humano",
    title: "Hablar con mesa",
    description: "Agente humano",
    query: "Quiero hablar con un asesor",
    handoff: true,
  },
] as const;

export const MENU_INTRO =
  "Hola, soy el asistente virtual de Regional 5. Elegí una opción o escribí tu consulta.";

export function resolveMenuChoice(text: string) {
  const n = normalizeText(text).replace(/[¿?]/g, "").trim();
  const hit = MENU_OPTIONS.find((option) => {
    const title = normalizeText(option.title);
    const id = normalizeText(option.id);
    return n === title || n === id || n === normalizeText(option.query) || n.includes(title) && n.length < 28;
  });
  return hit ?? null;
}

export function isHumanMenuChoice(text: string) {
  return Boolean(resolveMenuChoice(text)?.handoff);
}
