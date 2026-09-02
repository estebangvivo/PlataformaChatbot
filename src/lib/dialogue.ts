import type { RetrievedChunk } from "./rag";
import type { ContactProfile } from "./personality";
import { profileLabel } from "./personality";
import { completeChat, hasAi } from "./ai-providers";
import { GEMINI_SYSTEM_INSTRUCTION, SCOPE_REJECTION } from "./scope";

export type DialogueResult = {
  text: string;
  handoff: boolean;
  outOfScope: boolean;
  needsHuman: boolean;
  topic: string | null;
  usedModel: boolean;
};

export { hasAi };

export async function converseWithAi(opts: {
  userText: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  profile: ContactProfile;
  chunks: RetrievedChunk[];
}): Promise<DialogueResult | null> {
  if (!(await hasAi())) return null;

  const context = opts.chunks
    .slice(0, 5)
    .map((c, i) => `[#${i + 1} | ${c.title ?? c.pageUrl}]\n${c.content}`)
    .join("\n\n");

  const raw = await completeChat(
    [
      {
        role: "system",
        content: `${GEMINI_SYSTEM_INSTRUCTION}
${opts.profile ? `Persona: ${profileLabel(opts.profile) || "sin ficha"}` : ""}`,
      },
      ...opts.history.slice(-10).map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: `Mensaje del matriculado: ${opts.userText}

Contexto oficial de la web / base de conocimientos (única fuente permitida para datos):
${context || "(no hay fichas relevantes para este mensaje)"}`,
      },
    ],
    { json: true, temperature: 0.15 },
  );

  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      reply?: string;
      handoff?: boolean;
      out_of_scope?: boolean;
      needs_human?: boolean;
      topic?: string | null;
    };
    const outOfScope = Boolean(parsed.out_of_scope);
    const text = outOfScope ? SCOPE_REJECTION : parsed.reply?.trim();
    if (!text) return null;
    return {
      text,
      handoff: Boolean(parsed.handoff) && !outOfScope,
      outOfScope,
      needsHuman: Boolean(parsed.needs_human) && !outOfScope,
      topic: parsed.topic && parsed.topic !== "null" ? parsed.topic : null,
      usedModel: true,
    };
  } catch {
    return { text: raw, handoff: false, outOfScope: false, needsHuman: false, topic: null, usedModel: true };
  }
}
