import { setSetting } from "./settings";
import { prisma } from "./db";
import OpenAI from "openai";

export const AI_PROVIDERS = [
  { id: "none", label: "Sin IA (reglas)", hint: "Responde con fichas y la web indexada." },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Clave en Google AI Studio.",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (recomendado)" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    hint: "Clave en platform.openai.com.",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini (recomendado)" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    hint: "Clave en console.anthropic.com.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (rápido)" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    ],
  },
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiConfig = {
  provider: AiProviderId;
  model: string;
  apiKey: string | null;
};

const KEYS = {
  provider: "ai.provider",
  model: "ai.model",
  openai: "ai.openaiKey",
  gemini: "ai.geminiKey",
  anthropic: "ai.anthropicKey",
};

function envKey(provider: AiProviderId) {
  if (provider === "openai") return process.env.OPENAI_API_KEY?.trim() || null;
  if (provider === "gemini") return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || null;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY?.trim() || null;
  return null;
}

function defaultModel(provider: AiProviderId) {
  const spec = AI_PROVIDERS.find((p) => p.id === provider);
  return spec && "models" in spec && spec.models?.[0] ? spec.models[0].id : "";
}

const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-1.5-flash": "gemini-3.6-flash",
  "gemini-1.5-pro": "gemini-3.6-flash",
  "models/gemini-2.5-flash": "gemini-3.6-flash",
};

function resolveModel(provider: AiProviderId, stored?: string) {
  const raw = stored || defaultModel(provider) || process.env.OPENAI_MODEL || "";
  return DEPRECATED_MODELS[raw] ?? raw;
}

export function maskSecret(value: string | null) {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `••••${value.slice(-4)}`;
}

export async function getAiConfig(): Promise<AiConfig> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const stored = (map[KEYS.provider] as AiProviderId | undefined) || null;
  const provider: AiProviderId =
    stored && AI_PROVIDERS.some((p) => p.id === stored)
      ? stored
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : process.env.ANTHROPIC_API_KEY
            ? "anthropic"
            : "none";

  const storedKey =
    provider === "openai"
      ? map[KEYS.openai]
      : provider === "gemini"
        ? map[KEYS.gemini]
        : provider === "anthropic"
          ? map[KEYS.anthropic]
          : null;

  return {
    provider,
    model: resolveModel(provider, map[KEYS.model]),
    apiKey: storedKey || envKey(provider),
  };
}

export async function hasAi() {
  const cfg = await getAiConfig();
  return cfg.provider !== "none" && Boolean(cfg.apiKey);
}

export async function saveAiConfig(input: {
  provider: AiProviderId;
  model?: string;
  apiKey?: string;
}) {
  const provider = AI_PROVIDERS.some((p) => p.id === input.provider) ? input.provider : "none";
  await setSetting(KEYS.provider, provider);
  if (input.model) await setSetting(KEYS.model, input.model);
  else if (provider !== "none") await setSetting(KEYS.model, defaultModel(provider));

  const key = input.apiKey?.trim();
  if (key) {
    if (provider === "openai") await setSetting(KEYS.openai, key);
    if (provider === "gemini") await setSetting(KEYS.gemini, key);
    if (provider === "anthropic") await setSetting(KEYS.anthropic, key);
  }
  return getAiConfig();
}

export async function completeChat(
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
) {
  const cfg = await getAiConfig();
  if (cfg.provider === "none" || !cfg.apiKey) return null;
  if (cfg.provider === "openai") return completeOpenAI(cfg, messages, opts);
  if (cfg.provider === "gemini") return completeGemini(cfg, messages, opts);
  if (cfg.provider === "anthropic") return completeAnthropic(cfg, messages, opts);
  return null;
}

async function completeOpenAI(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
) {
  const client = new OpenAI({ apiKey: cfg.apiKey! });
  const completion = await client.chat.completions.create({
    model: cfg.model || "gpt-4o-mini",
    temperature: opts?.temperature ?? 0.35,
    ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
    messages,
  });
  return completion.choices[0]?.message?.content?.trim() || null;
}

const GEMINI_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.0-flash"];

function isBusyError(status: number, message: string) {
  const n = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    /high demand|resource exhausted|unavailable|try again later|quota|overloaded/.test(n)
  );
}

async function completeGemini(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const preferred = cfg.model || "gemini-3.6-flash";
  const models = [preferred, ...GEMINI_FALLBACKS.filter((m) => m !== preferred)];
  let lastError = "Gemini no respondió";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cfg.apiKey!,
          },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents,
            generationConfig: {
              temperature: opts?.temperature ?? 0.35,
              ...(opts?.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      const data = (await res.json()) as {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (text.trim()) return text.trim();
        lastError = `Gemini (${model}) devolvió vacío`;
        continue;
      }
      lastError = data.error?.message ?? `Gemini HTTP ${res.status}`;
      if (isBusyError(res.status, lastError)) continue;
      throw new Error(lastError);
    }
  }

  throw new Error(
    "Gemini está saturado ahora (demanda alta). Probá de nuevo en un minuto o cambiá a Gemini 3.5 Flash / 2.0 Flash.",
  );
}

async function completeAnthropic(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model || "claude-3-5-haiku-latest",
      max_tokens: 800,
      temperature: opts?.temperature ?? 0.35,
      system: opts?.json ? `${system}\nRespondé únicamente JSON válido.` : system,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };
  if (!res.ok) throw new Error(data.error?.message ?? `Anthropic HTTP ${res.status}`);
  return data.content?.map((p) => p.text ?? "").join("").trim() || null;
}

export async function embedTexts(texts: string[]) {
  const cfg = await getAiConfig();
  if (!cfg.apiKey || cfg.provider === "none") return texts.map(() => null as number[] | null);
  if (cfg.provider === "openai") {
    const client = new OpenAI({ apiKey: cfg.apiKey });
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
  if (cfg.provider === "gemini") {
    const out: Array<number[] | null> = [];
    for (const text of texts) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cfg.apiKey,
            },
            body: JSON.stringify({ content: { parts: [{ text }] } }),
          },
        );
        const data = (await res.json()) as { embedding?: { values?: number[] } };
        out.push(data.embedding?.values ?? null);
      } catch {
        out.push(null);
      }
    }
    return out;
  }
  return texts.map(() => null as number[] | null);
}

export async function testAiConnection() {
  const text = await completeChat(
    [
      { role: "system", content: "Respondé solo con la palabra OK." },
      { role: "user", content: "Ping" },
    ],
    { json: false, temperature: 0 },
  );
  if (!text) throw new Error("La IA no respondió");
  return { ok: true, sample: text.slice(0, 80) };
}

export function publicAiStatus(cfg: AiConfig) {
  const spec = AI_PROVIDERS.find((p) => p.id === cfg.provider);
  return {
    provider: cfg.provider,
    label: spec?.label ?? cfg.provider,
    model: cfg.model,
    hasKey: Boolean(cfg.apiKey),
    maskedKey: maskSecret(cfg.apiKey),
    providers: AI_PROVIDERS,
  };
}
