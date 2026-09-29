import { completeChat, getAiConfig, hasAi } from "./ai-providers";

export type InboundMedia = {
  mime: string;
  dataBase64: string;
  filename?: string;
  caption?: string;
};

export function mediaKind(mime: string): "audio" | "image" | "pdf" | "file" {
  if (mime.startsWith("audio/") || mime === "audio/ogg" || mime === "audio/mpeg") return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "file";
}

export function mediaLabel(kind: ReturnType<typeof mediaKind>) {
  if (kind === "audio") return "Audio";
  if (kind === "image") return "Foto";
  if (kind === "pdf") return "PDF";
  return "Archivo";
}

function promptFor(kind: ReturnType<typeof mediaKind>, caption?: string) {
  const extra = caption ? `\nEl matriculado escribió: ${caption}` : "";
  if (kind === "audio") {
    return `Transcribí este audio de un matriculado del Colegio de Arquitectos (Regional 5). Devolvé solo el texto en español, sin comillas.${extra}`;
  }
  if (kind === "image") {
    return `Leé esta imagen enviada por un matriculado de Regional 5. Extraé texto visible (boletas, comprobantes, capturas) y describí en 2-4 oraciones de qué se trata, en español rioplatense.${extra}`;
  }
  if (kind === "pdf") {
    return `Leé este PDF enviado por un matriculado de Regional 5. Extraé el texto útil y resumí de qué se trata, en español.${extra}`;
  }
  return `Describí este archivo enviado por un matriculado.${extra}`;
}

export async function interpretUserMedia(media: InboundMedia) {
  const kind = mediaKind(media.mime);
  const caption = media.caption?.trim() || "";
  if (!(await hasAi())) {
    return {
      kind,
      text: caption || `Recibí tu ${mediaLabel(kind).toLowerCase()}. No pude leerlo automáticamente: contame de qué se trata o pedí hablar con mesa.`,
      usedModel: false,
    };
  }

  const cfg = await getAiConfig();
  const prompt = promptFor(kind, caption);

  try {
    if (cfg.provider === "gemini" && cfg.apiKey) {
      const preferred = cfg.model || "gemini-3.6-flash";
      const models = [...new Set([preferred, "gemini-3.8-flash", "gemini-3.6-flash"])];
      for (const model of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cfg.apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { inlineData: { mimeType: media.mime, data: media.dataBase64 } },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1 },
            }),
          },
        );
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { message?: string };
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (res.ok && text) return { kind, text, usedModel: true };
      }
    }

    const fallback = await completeChat(
      [
        {
          role: "user",
          content: `${prompt}\n\nNo pude adjuntar el archivo al modelo. Si hay un texto o pie: ${caption || "(sin texto)"}`,
        },
      ],
      { temperature: 0.1 },
    );
    if (fallback) return { kind, text: fallback, usedModel: true };
  } catch (error) {
    console.error("interpretUserMedia", error);
  }

  return {
    kind,
    text: caption || `Recibí tu ${mediaLabel(kind).toLowerCase()} pero no pude leerlo. Contame de qué se trata o pedí hablar con mesa.`,
    usedModel: false,
  };
}
