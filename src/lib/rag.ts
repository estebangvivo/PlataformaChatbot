import { prisma } from "./db";
import { normalizeText, parseJson } from "./utils";
import { embedTexts, hasAi } from "./ai-providers";

export type RetrievedChunk = {
  id: string;
  pageUrl: string;
  title: string | null;
  content: string;
  score: number;
};

export { embedTexts, hasAi };
export const hasOpenAI = hasAi;

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const QUESTION_STOP = new Set([
  "donde",
  "cual",
  "cuales",
  "como",
  "que",
  "quien",
  "cuando",
  "cuanto",
  "cuanta",
  "este",
  "esta",
  "esto",
  "para",
  "por",
  "una",
  "unos",
  "unas",
  "las",
  "los",
  "del",
  "con",
  "hay",
  "tiene",
  "tienen",
  "puede",
  "pueden",
  "necesito",
  "queria",
  "quisiera",
  "hola",
  "buenas",
  "tardes",
  "noches",
  "quiero",
  "saber",
  "disponible",
  "disponibles",
]);

function expandQuery(query: string) {
  const n = normalizeText(query);
  const extras: string[] = [];
  if (/curso|taller|charla|formaci|capacitaci/.test(n)) {
    extras.push("capacitacion capacitaciones cursos talleres atrim oncativo");
  }
  if (/turno/.test(n)) extras.push("turnos asesorias patrimonio legal gas obra caja");
  if (/tramite|expediente|visado|firma digital|cidi/.test(n)) {
    extras.push("tramitacion expediente visado firma digital cidi tutoriales");
  }
  if (/pago|boleta|deuda/.test(n)) extras.push("medios de pago habilitacion");
  if (/horario|sede|direccion|telefono|oficina|atencion|dirigirme/.test(n)) {
    extras.push("horario atencion sede villa maria san juan 8 a 13");
  }
  return extras.length ? `${query} ${extras.join(" ")}` : query;
}

function lexicalScore(query: string, chunk: string) {
  const q = normalizeText(expandQuery(query));
  const c = normalizeText(chunk);
  if (!q || !c) return 0;
  const terms = [...new Set(q.split(" ").filter((t) => t.length > 3 && !QUESTION_STOP.has(t)))];
  if (terms.length === 0) return q.length > 0 && c.includes(q) ? 0.4 : 0;
  const hits = terms.filter((t) => c.includes(t)).length;
  const phraseBoost = c.includes(normalizeText(query)) ? 0.25 : 0;
  const synonymBoost =
    (/curso|taller|charla/.test(q) && /capacitaci|curso|taller/.test(c) ? 0.28 : 0) +
    (/turno/.test(q) && /turno|asesoria/.test(c) ? 0.28 : 0) +
    (/tramite|expediente/.test(q) && /tramit|expediente/.test(c) ? 0.22 : 0) +
    (/firma digital|cidi/.test(q) && /firma digital|cidi/.test(c) ? 0.45 : 0);
  const junkPenalty =
    /todos los derechos reservados|iniciar sesion|dejar un comentario/.test(c) || /^[a-z]/.test(chunk.trim())
      ? 0.45
      : 0;
  const fichaBoost = /\[ficha\]/.test(chunk) ? 0.2 : 0;
  return Math.min(
    1,
    Math.max(0, hits / Math.max(terms.length, 1) + phraseBoost + synonymBoost + fichaBoost - junkPenalty),
  );
}

export async function retrieveChunks(query: string, k = 5): Promise<RetrievedChunk[]> {
  const rows = await prisma.knowledgeChunk.findMany();
  if (rows.length === 0) return [];

  let queryEmbedding: number[] | null = null;
  if (await hasAi()) {
    try {
      const [embedding] = await embedTexts([expandQuery(query)]);
      queryEmbedding = embedding;
    } catch {
      queryEmbedding = null;
    }
  }

  const ranked = rows.map((row) => {
    const lexical = lexicalScore(query, `${row.title ?? ""} ${row.contentChunk}`);
    const stored = parseJson<number[] | null>(row.embedding, null);
    const semantic =
      queryEmbedding && stored && stored.length === queryEmbedding.length
        ? cosine(queryEmbedding, stored)
        : 0;
    const score = queryEmbedding ? semantic * 0.72 + lexical * 0.28 : lexical;
    return {
      id: row.id,
      pageUrl: row.pageUrl,
      title: row.title,
      content: row.contentChunk,
      score,
    };
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, k);
}

export async function answerWithRag(
  question: string,
  opts?: {
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    profileSummary?: string;
  },
) {
  const chunks = await retrieveChunks(question, 5);
  const top = chunks[0];
  const fallback = buildExtractiveAnswer(chunks, question);
  const found = (top?.score ?? 0) >= 0.28 && Boolean(top);

  return {
    answer: fallback.answer,
    confidence: fallback.confidence,
    sources: chunks,
    usedModel: false,
    found,
  };
}

function extractRelevantSnippet(content: string, query: string) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const terms = [...new Set(normalizeText(query).split(" ").filter((t) => t.length > 3 && !QUESTION_STOP.has(t)))];
  const ranked = sentences
    .map((s) => ({
      s,
      hits: terms.filter((t) => normalizeText(s).includes(t)).length,
    }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  if (ranked.length) {
    return ranked
      .slice(0, 3)
      .map((x) => x.s)
      .join(" ");
  }
  return content.length > 420 ? `${content.slice(0, 420)}…` : content;
}

function buildExtractiveAnswer(chunks: RetrievedChunk[], query: string) {
  const top = chunks[0];
  if (!top || top.score < 0.28) {
    return { confidence: top?.score ?? 0, answer: "" };
  }
  return { confidence: top.score, answer: extractRelevantSnippet(top.content, query) };
}
