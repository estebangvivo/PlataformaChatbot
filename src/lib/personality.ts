import { normalizeText, parseJson } from "./utils";
import { wantsHuman } from "./routing";

export type ContactProfile = {
  firstName?: string;
  lastName?: string;
  locality?: string;
  matricula?: string;
  role?: string;
  email?: string;
  observations?: string;
  interests: string[];
  notes: string[];
  lastGreetedOn?: string;
  unansweredStreak: number;
  lastTopic?: string;
  awaiting?: string | null;
  notifyOnAgent?: boolean;
  notifyDepartment?: string | null;
};

export const EMPTY_PROFILE: ContactProfile = {
  interests: [],
  notes: [],
  unansweredStreak: 0,
};

export const CONTACT_ROLES = ["matriculado", "arquitecto", "estudiante", "publico"] as const;

const LOCALITIES = [
  "villa maría",
  "villa maria",
  "villa nueva",
  "bell ville",
  "oncativo",
  "marcos juarez",
  "marcos juárez",
  "canals",
  "rio segundo",
  "río segundo",
  "pilar",
  "oliva",
  "leones",
  "corral de bustos",
  "monte maiz",
  "monte maíz",
  "james craik",
  "laguna larga",
];

const GREETING_RE =
  /\b(hola+|holis|buen(?:as|os)?\s*(?:d[ií]as?|tardes?|noches?)|buenas|buen dia|qu[eé] tal|hey|buenas)\b/i;

export function readProfile(raw?: string | null): ContactProfile {
  const parsed = parseJson<Partial<ContactProfile>>(raw, {});
  return {
    ...EMPTY_PROFILE,
    ...parsed,
    interests: parsed.interests ?? [],
    notes: parsed.notes ?? [],
    unansweredStreak: parsed.unansweredStreak ?? 0,
  };
}

export function cordobaNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
}

export function todayKey() {
  const d = cordobaNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function timeGreeting(): "Buen día" | "Buenas tardes" | "Buenas noches" {
  const hour = cordobaNow().getHours();
  if (hour < 12) return "Buen día";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function detectUserGreeting(text: string) {
  const n = normalizeText(text);
  if (n.includes("buen dia") || n.includes("buenos dias")) return "Buen día";
  if (n.includes("buenas tardes") || n.includes("buena tarde")) return "Buenas tardes";
  if (n.includes("buenas noches") || n.includes("buena noche")) return "Buenas noches";
  if (GREETING_RE.test(text)) return timeGreeting();
  return null;
}

export function isOnlyGreeting(text: string) {
  const leftover = normalizeText(text)
    .replace(/\b(hola+|holis|buenas|buen(?:as|os)?\s*(?:dias?|tardes?|noches?)|que tal|hey|buen dia)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return leftover.length < 8;
}

const ASK_INTENT =
  /curso|tramite|tramit|pago|horario|asesor|expediente|turno|consultar|consulta|sacar|necesito|queria|quiero|capacitaci|boleta|firma|visado|concurso|habilitaci|catastro|oficina|sede|atencion|dirigirme|visitar|tutorial|cidi|pasos|link|video/;

function leftoverAfterIdentity(text: string) {
  return normalizeText(text)
    .replace(
      /\b(hola+|holis|buenas|buen(?:as|os)?\s*(?:dias?|tardes?|noches?)|que tal|hey|buen dia)\b/g,
      " ",
    )
    .replace(/\b(me llamo|mi nombre es)\s+[a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?/g, " ")
    .replace(/\bsoy\s+(?:el|la)?\s*(?:arq|arquitect[oa])?\s*[a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?/g, " ")
    .replace(/\b(?:soy de|vivo en|desde)\s+[a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?/g, " ")
    .replace(/\b(matriculad[oa]|arquitect[oa]|estudiante)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMostlyIdentity(text: string) {
  const n = normalizeText(text);
  if (ASK_INTENT.test(n)) return false;
  if (wantsTutorial(text) || wantsProcedure(text)) return false;
  const leftover = leftoverAfterIdentity(text);
  if (leftover === n) return false;
  return leftover.length < 12;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractFacts(text: string, current: ContactProfile): ContactProfile {
  const next: ContactProfile = {
    ...current,
    interests: [...current.interests],
    notes: [...current.notes],
  };
  const n = normalizeText(text);

  const fullName = text.match(
    /\b(?:me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i,
  );
  if (fullName) {
    next.firstName = titleCase(fullName[1]);
    next.lastName = titleCase(fullName[2]);
  } else {
    const nameMatch =
      text.match(/\bme llamo\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i) ||
      text.match(/\bmi nombre es\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i) ||
      text.match(/\bsoy\s+(?:el\s+|la\s+)?(?:arq\.?\s+|arquitect[oa]\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})(?!\s+de\b)/);
    if (nameMatch?.[1] && !["de", "un", "una", "el", "la"].includes(nameMatch[1].toLowerCase())) {
      next.firstName = titleCase(nameMatch[1]);
    }
  }

  for (const loc of LOCALITIES) {
    if (n.includes(normalizeText(loc))) {
      next.locality = titleCase(loc);
      break;
    }
  }
  const fromMatch = n.match(/\b(?:soy de|vivo en|desde)\s+([a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?)/);
  if (fromMatch?.[1] && fromMatch[1].length > 3) {
    next.locality = titleCase(fromMatch[1]);
  }

  const mat = text.match(/matr[ií]cula(?:\s*(?:n[°ºo]|nro|numero)?)?\s*[:#-]?\s*(\d{3,})/i);
  if (mat?.[1]) next.matricula = mat[1];

  if (/\bestudiante\b/i.test(text)) next.role = "estudiante";
  else if (/\bmatriculad[oa]\b/i.test(text)) next.role = "matriculado";
  else if (/\barquitect[oa]\b/i.test(text) || /\barq\.\b/i.test(text)) next.role = "arquitecto";

  const mentioned = detectTopic(text);
  if (mentioned && !next.interests.includes(mentioned)) next.interests.push(mentioned);

  const topicHints: Array<[RegExp, string]> = [
    [/curso|capacitaci|taller|charla|formaci|tutorial/i, "capacitacion"],
    [/oficina|sede|horario|atenci[oó]n|dirigirme/i, "horarios"],
    [/matr[ií]cul|habilitaci/i, "matricula"],
    [/pago|boleta|arancel|deuda/i, "pagos"],
    [/expediente|visado/i, "tramites"],
    [/asesor/i, "asesorias"],
    [/\bturno/i, "turnos"],
    [/concurso/i, "concursos"],
  ];
  for (const [re, topic] of topicHints) {
    if (re.test(text) && !next.interests.includes(topic)) next.interests.push(topic);
  }

  return next;
}

const TOPICS: Array<{ id: string; re: RegExp; label: string }> = [
  { id: "firma_digital", re: /firma\s*digital|cidi/i, label: "firma digital" },
  { id: "catastro", re: /\b(sit|catastro)\b/i, label: "catastro" },
  { id: "gas", re: /\b(gas|ecogas|atrim|perfiler|materiales)\b/i, label: "gas" },
  { id: "epec", re: /\bepec\b/i, label: "epec" },
  { id: "reintegro", re: /reintegro|beneficio por registro/i, label: "reintegro" },
];

export function detectTopic(text: string) {
  const n = normalizeText(text);
  for (const topic of TOPICS) {
    if (topic.re.test(n) || topic.re.test(text)) return topic.id;
  }
  return null;
}

function topicLabel(id: string) {
  return TOPICS.find((t) => t.id === id)?.label ?? id.replaceAll("_", " ");
}

function isFollowUp(text: string) {
  const n = normalizeText(text);
  if (/hablar|asesor|humano|agente|operador|deriv/.test(n)) return false;
  if (/^(si|dale|ok|okey|claro|eso|eso mismo|me interesa|el de|la de|ese|esa|tutorial|el tutorial|tramite|el tramite|los pasos|el link|pasame|mandame)\b/.test(n)) {
    return true;
  }
  return wantsTutorial(text) || wantsProcedure(text);
}

export function resolveTurn(
  userText: string,
  profile: ContactProfile,
  history?: Array<{ role: string; content: string }>,
) {
  const lastAssistant =
    [...(history ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const topic = detectTopic(userText);
  const lastWasCapacitacion =
    profile.awaiting === "capacitacion_tema" ||
    profile.lastTopic === "capacitacion" ||
    (/capacitaci|\bcursos?\b/.test(normalizeText(lastAssistant)) &&
      !/firma digital|cidi/.test(normalizeText(lastAssistant)));

  let effectiveText = userText;
  if (topic && lastWasCapacitacion) {
    effectiveText = `capacitación ${topicLabel(topic)}: ${userText}`;
  } else if (topic) {
    effectiveText = `${topicLabel(topic)} ${userText}`;
  } else if (isFollowUp(userText) && (profile.awaiting || profile.lastTopic)) {
    effectiveText = `${profile.lastTopic ? topicLabel(profile.lastTopic) : ""} ${userText}`.trim();
  }

  return { effectiveText, topic, lastAssistant, lastWasCapacitacion };
}

export function firstNameFromWhatsApp(name?: string | null) {
  if (!name) return undefined;
  if (/vecino|regional|whatsapp|user/i.test(name)) return undefined;
  const first = name.replace(/^arq\.?\s*/i, "").trim().split(/\s+/)[0];
  if (!first || first.length < 2) return undefined;
  return titleCase(first);
}

export function profileLabel(profile: ContactProfile) {
  const bits = [
    profile.firstName,
    profile.lastName,
    profile.role,
    profile.locality,
    profile.matricula ? `Mat. ${profile.matricula}` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function vocative(profile: ContactProfile) {
  return profile.firstName ? `, ${profile.firstName}` : "";
}

export function greetingLine(userText: string, profile: ContactProfile) {
  if (profile.lastGreetedOn === todayKey()) return null;
  const mirrored = detectUserGreeting(userText) ?? timeGreeting();
  return `¡${mirrored}${vocative(profile)}!`;
}

function isOfficeHours(text: string) {
  const n = normalizeText(text);
  return (
    /horario|atencion|oficina|sede/.test(n) ||
    /cuando (puedo|puedo ir|puedo pasar)|dirigirme|visitar|acercarme|ir a (la )?oficina|ir al colegio/.test(n)
  );
}

function wantsTutorial(text: string) {
  const n = normalizeText(text);
  return /tutorial|el link|pasame|mandame|enviame|pasame el|el video|la pagina/.test(n);
}

function wantsProcedure(text: string) {
  const n = normalizeText(text);
  return /tramite|pasos|orient|cidi|como se hace|como hago|el tramite/.test(n);
}

const LINKS = {
  tutoriales: "https://regional5.com.ar/colegio-arquitectos/tutoriales/",
  firmaDigital: "https://bit.ly/firmadigitalremota",
  sit: "https://youtu.be/LARxp29St7w",
};

function cannedAnswer(
  text: string,
  profile: ContactProfile,
  turn: { effectiveText: string; topic: string | null; lastWasCapacitacion: boolean },
): { text: string; lastTopic: string; awaiting: string | null } | null {
  const n = normalizeText(turn.effectiveText);
  const raw = normalizeText(text);
  const onFirma =
    profile.lastTopic === "firma_digital" ||
    profile.awaiting === "firma_digital_choice" ||
    turn.topic === "firma_digital";

  if (onFirma && (wantsTutorial(raw) || profile.awaiting === "firma_digital_choice" && /tutorial|link|video/.test(raw))) {
    return {
      text: `Dale, el tutorial de cómo firmar un documento con firma digital remota está acá: ${LINKS.firmaDigital}\n\nEn la sección Tutoriales también está junto a Catastro, EPEC y expediente online: ${LINKS.tutoriales}`,
      lastTopic: "firma_digital",
      awaiting: null,
    };
  }

  if (onFirma && wantsProcedure(raw) && !wantsTutorial(raw)) {
    return {
      text: `El trámite de firma digital es remoto por CiDi, sin costo (Gobierno de Córdoba). No hace falta ir a la sede.\n\nEl instructivo de Regional 5 está acá: ${LINKS.firmaDigital}\nSi te trabás en algún paso, escribime y lo vemos.`,
      lastTopic: "firma_digital",
      awaiting: null,
    };
  }

  if (onFirma && profile.awaiting === "firma_digital_choice" && /^(si|dale|ok|okey|claro)\b/.test(raw)) {
    return {
      text: "¿El tutorial o el trámite por CiDi?",
      lastTopic: "firma_digital",
      awaiting: "firma_digital_choice",
    };
  }

  if ((turn.topic === "firma_digital" || /firma digital/.test(raw)) && !wantsTutorial(raw) && !wantsProcedure(raw)) {
    return {
      text: `Sobre firma digital hay un tutorial (cómo firmar un documento de forma remota) y el trámite se hace por CiDi, sin costo, del Gobierno de Córdoba: no hace falta ir a la sede. ¿Querés el tutorial o te oriento con el trámite?`,
      lastTopic: "firma_digital",
      awaiting: "firma_digital_choice",
    };
  }

  if ((turn.topic === "catastro" || profile.lastTopic === "catastro") && wantsTutorial(raw)) {
    return {
      text: `El tutorial de SIT/Catastro está acá: ${LINKS.sit}\nHay más material en ${LINKS.tutoriales}. Se gestiona por CiDi nivel 2.`,
      lastTopic: "catastro",
      awaiting: null,
    };
  }

  if (turn.topic === "catastro") {
    return {
      text: "SIT/Catastro se gestiona por CiDi (nivel 2). Hay tutorial en la web de Regional 5. ¿Querés el video o es para un expediente?",
      lastTopic: "catastro",
      awaiting: "catastro_choice",
    };
  }

  if (turn.topic === "gas" && (turn.lastWasCapacitacion || /capacitaci|curso|atrim/.test(n))) {
    return {
      text: "En capacitaciones de gas/perfilería suele haber jornadas tipo ATRIM (el último que figuraba era en Oncativo). Se publican en la web y por WhatsApp a matriculados, con cupo. ¿De qué localidad estás?",
      lastTopic: "gas",
      awaiting: null,
    };
  }

  if (isOfficeHours(text) && !turn.topic) {
    return {
      text: "Podés acercarte a la sede de lunes a viernes, de 8 a 13 hs, en San Juan 1553, Villa María. Para trámites no hace falta turno; si es una asesoría (legal, gas, obra, patrimonio o caja) se saca turno en regional5.com.ar/colegio-arquitectos/turnos/.",
      lastTopic: "horarios",
      awaiting: null,
    };
  }

  if (/curso|capacitaci|taller|charla|formaci/.test(raw) && !turn.topic) {
    return {
      text: "Las capacitaciones las vamos publicando en la web y también las mandamos por mail y WhatsApp a los matriculados. Si me decís el tema (gas, catastro, firma digital, materiales) te oriento.",
      lastTopic: "capacitacion",
      awaiting: "capacitacion_tema",
    };
  }

  if (/\bturno/.test(raw) && !turn.topic) {
    const where = profile.locality ? ` Como estás en ${profile.locality},` : "";
    return {
      text: `Los turnos de asesorías se sacan en regional5.com.ar/colegio-arquitectos/turnos/.${where} para trámites en sede podés venir lun a vie de 8 a 13, sin turno. ¿Es para alguna asesoría en particular?`,
      lastTopic: "turnos",
      awaiting: "asesoria_tipo",
    };
  }

  if (/tramite|expediente|visado/.test(raw) && !turn.topic) {
    return {
      text: "Para trámites de expediente te atendemos lun a vie de 8 a 13, sin turno, en San Juan 1553 o por este WhatsApp. ¿Es visado, firma digital, habilitación o Autogestión?",
      lastTopic: "tramites",
      awaiting: "tramite_tipo",
    };
  }

  if (/pago|boleta|deuda|arancel/.test(raw)) {
    return {
      text: "Los pagos se hacen por Autogestión (Pago TIC): tarjeta, cupón Rapipago/Pago Fácil o DEBIN. La habilitación anual vence el 10 de marzo. ¿Es habilitación, aportes al Colegio o a la Caja?",
      lastTopic: "pagos",
      awaiting: "pago_tipo",
    };
  }

  if (/concurso/.test(raw)) {
    return {
      text: "Los llamados están en la sección Concursos de la web de Regional 5. Si me decís si es nacional, provincial o de la Regional, te ayudo a ubicar el que buscás.",
      lastTopic: "concursos",
      awaiting: "concurso_tipo",
    };
  }

  return null;
}

function looksLikeWebDump(answer: string) {
  const n = normalizeText(answer);
  if (/todos los derechos reservados|regional5\.com\.ar todos/.test(n)) return true;
  if (/^[^a-záéíóúñ]/i.test(answer.trim()) && answer.length > 20 && /^[a-z]/.test(answer.trim())) return true;
  if (/ver mas|iniciar sesion|dejar un comentario/.test(n)) return true;
  if ((answer.match(/@/g) ?? []).length >= 2) return true;
  return false;
}

export function composeHumanReply(opts: {
  userText: string;
  profile: ContactProfile;
  ragAnswer?: string;
  confidence: number;
  found: boolean;
  history?: Array<{ role: string; content: string }>;
}): { text: string; escalate: boolean; profile: ContactProfile } {
  const profile = { ...opts.profile, interests: [...opts.profile.interests] };
  const turn = resolveTurn(opts.userText, profile, opts.history);
  if (!profile.awaiting && /queres el tutorial|tutorial o te oriento|tutorial o el tramite/.test(normalizeText(turn.lastAssistant))) {
    profile.awaiting = "firma_digital_choice";
    profile.lastTopic = profile.lastTopic ?? "firma_digital";
  }
  const inThread = Boolean(profile.awaiting || profile.lastTopic);
  const greet = inThread ? null : greetingLine(opts.userText, profile);
  if (greet) profile.lastGreetedOn = todayKey();

  const canned = cannedAnswer(opts.userText, profile, turn);
  if (canned) {
    profile.unansweredStreak = 0;
    profile.lastTopic = canned.lastTopic;
    profile.awaiting = canned.awaiting;
    return {
      text: [greet, canned.text].filter(Boolean).join("\n\n"),
      escalate: false,
      profile,
    };
  }

  if (isOnlyGreeting(opts.userText) && !inThread) {
    profile.unansweredStreak = 0;
    return {
      text: [
        greet ?? `¡${timeGreeting()}${vocative(profile)}!`,
        "Decime en qué te puedo ayudar: trámites, matrícula, pagos, asesorías o capacitaciones.",
      ].join(" "),
      escalate: false,
      profile,
    };
  }

  if (isMostlyIdentity(opts.userText) && !turn.topic && !inThread) {
    profile.unansweredStreak = 0;
    return {
      text: [greet ?? `¡${timeGreeting()}${vocative(profile)}!`, "Decime en qué te puedo ayudar."]
        .filter(Boolean)
        .join(" "),
      escalate: false,
      profile,
    };
  }

  const cleanRag =
    opts.found &&
    opts.ragAnswer &&
    !looksLikeWebDump(opts.ragAnswer) &&
    !wantsHuman(opts.userText) &&
    (turn.topic || isFollowUp(opts.userText) || !inThread)
      ? softenFoundAnswer(opts.ragAnswer, turn.effectiveText)
      : "";

  if (cleanRag) {
    profile.unansweredStreak = 0;
    if (turn.topic) {
      profile.lastTopic = turn.topic;
      profile.awaiting = null;
    }
    return {
      text: [greet, cleanRag].filter(Boolean).join("\n\n"),
      escalate: false,
      profile,
    };
  }

  profile.unansweredStreak += 1;
  const helpful = turn.lastWasCapacitacion
    ? "Decime el tema (gas, catastro, firma digital, materiales) y te oriento con lo que hay publicado."
    : "Contame un poco más qué trámite o consulta necesitás y te oriento. La sede atiende lunes a viernes de 8 a 13 hs en San Juan 1553.";
  return {
    text: [greet, helpful].filter(Boolean).join("\n\n"),
    escalate: false,
    profile,
  };
}

function softenFoundAnswer(answer: string, query?: string) {
  const stripped = answer
    .replace(/©.*$/gim, "")
    .replace(/todos los derechos reservados.*$/gim, "")
    .replace(/enlaces relacionados:.*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !looksLikeWebDump(s));
  const terms = query
    ? [...new Set(normalizeText(query).split(" ").filter((t) => t.length > 3))]
    : [];
  const relevant = terms.length
    ? sentences.filter((s) => terms.some((t) => normalizeText(s).includes(t)))
    : [];
  const pick = (relevant.length ? relevant.slice(0, 3) : sentences.slice(0, 2)).join(" ") || stripped;
  const clipped = pick.slice(0, 420);
  if (clipped.length < 40) return "";
  if (clipped.endsWith(".")) return clipped;
  return clipped.replace(/\s+\S*$/, "").trim() + ".";
}

export function handoffCopy(agentName?: string, department?: string) {
  if (agentName) {
    return `Perfecto, te dejo con ${agentName} de ${department ?? "la Regional"}. En un rato te escriben por acá. Mientras tanto, si querés ir adelantando tu nombre, matrícula o localidad, ayudás a que te atiendan más rápido.`;
  }
  return "Ahora no hay agentes conectados. Seguí hablando conmigo y te ayudo. Cuando alguien de mesa se conecte, si hace falta te derivo.";
}
