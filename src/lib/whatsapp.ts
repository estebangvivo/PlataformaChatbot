const GRAPH = "https://graph.facebook.com/v21.0";

import { MENU_INTRO, MENU_OPTIONS } from "./menu";
import { mediaKind, type InboundMedia } from "./media";

export type InboundMessage = {
  from: string;
  name?: string;
  text: string;
  whatsappId?: string;
  media?: InboundMedia;
};

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function normalizeWhatsAppPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8) return null;
  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 11) {
    return `549${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length >= 11) return `54${digits}`;
  if (digits.length === 10 || digits.length === 11) return `549${digits.replace(/^0/, "")}`;
  if (digits.length >= 12) return digits;
  return `549${digits}`;
}

export function phonesMatch(a: string, b: string) {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  const tailA = da.slice(-10);
  const tailB = db.slice(-10);
  return tailA.length === 10 && tailA === tailB;
}

export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams: string[],
) {
  if (!isWhatsAppConfigured()) {
    console.info("[r5] plantilla WA (simulada):", to, name, bodyParams);
    return { ok: true, simulated: true as const };
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const components =
    bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text: text.slice(0, 60) })),
          },
        ]
      : [];

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "template",
      template: {
        name,
        language: { code: language },
        components,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp template: ${await res.text()}`);
  }
  return { ok: true, simulated: false as const, data: await res.json() };
}

export async function sendWhatsAppText(to: string, body: string) {
  if (!isWhatsAppConfigured()) {
    return { ok: true, simulated: true as const };
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp API: ${error}`);
  }

  return { ok: true, simulated: false as const, data: await res.json() };
}

export async function sendWhatsAppMedia(to: string, media: InboundMedia, caption?: string) {
  if (!isWhatsAppConfigured()) {
    return { ok: true, simulated: true as const };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const bytes = new Uint8Array(Buffer.from(media.dataBase64, "base64"));
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", media.mime);
  form.append("file", new Blob([bytes], { type: media.mime }), media.filename || "archivo");

  const upload = await fetch(`${GRAPH}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploaded = (await upload.json()) as { id?: string; error?: { message?: string } };
  if (!upload.ok || !uploaded.id) {
    throw new Error(`WhatsApp media: ${uploaded.error?.message ?? upload.status}`);
  }

  const kind = mediaKind(media.mime);
  const type = kind === "image" ? "image" : kind === "audio" ? "audio" : "document";
  const payload: Record<string, unknown> = {
    id: uploaded.id,
  };
  if (caption && type !== "audio") payload.caption = caption;
  if (type === "document" && media.filename) payload.filename = media.filename;

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type,
      [type]: payload,
    }),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp API: ${await res.text()}`);
  }
  return { ok: true, simulated: false as const };
}

export async function sendWhatsAppMenu(to: string) {
  if (!isWhatsAppConfigured()) {
    return { ok: true, simulated: true as const };
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: MENU_INTRO },
        action: {
          button: "Ver opciones",
          sections: [
            {
              title: "Consultas",
              rows: MENU_OPTIONS.map((option) => ({
                id: option.id,
                title: option.title,
                description: option.description,
              })),
            },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`WhatsApp API: ${error}`);
  }
  return { ok: true, simulated: false as const };
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<InboundMedia | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return null;
  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binRes.ok) return null;
  const buffer = Buffer.from(await binRes.arrayBuffer());
  return {
    mime: meta.mime_type || "application/octet-stream",
    dataBase64: buffer.toString("base64"),
  };
}

export async function parseWhatsAppPayload(body: unknown): Promise<InboundMessage[]> {
  const messages: InboundMessage[] = [];
  const root = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
          messages?: Array<{
            id: string;
            from: string;
            type: string;
            text?: { body?: string };
            image?: { id?: string; caption?: string; mime_type?: string };
            audio?: { id?: string; mime_type?: string };
            voice?: { id?: string; mime_type?: string };
            document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
            interactive?: {
              type?: string;
              button_reply?: { id?: string; title?: string };
              list_reply?: { id?: string; title?: string };
            };
          }>;
        };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contacts = new Map((value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const message of value?.messages ?? []) {
        const name = contacts.get(message.from);
        const interactiveTitle =
          message.interactive?.list_reply?.title ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.id ||
          message.interactive?.button_reply?.id;

        if (message.type === "text" && message.text?.body) {
          messages.push({ from: message.from, name, text: message.text.body, whatsappId: message.id });
          continue;
        }
        if (interactiveTitle) {
          messages.push({ from: message.from, name, text: interactiveTitle, whatsappId: message.id });
          continue;
        }

        const mediaRef =
          message.image?.id || message.audio?.id || message.voice?.id || message.document?.id;
        if (!mediaRef) continue;
        const media = await downloadWhatsAppMedia(mediaRef);
        if (!media) continue;
        media.filename = message.document?.filename;
        media.caption = message.image?.caption || message.document?.caption;
        if (message.image?.mime_type) media.mime = message.image.mime_type;
        if (message.audio?.mime_type) media.mime = message.audio.mime_type;
        if (message.voice?.mime_type) media.mime = message.voice.mime_type;
        if (message.document?.mime_type) media.mime = message.document.mime_type;
        messages.push({
          from: message.from,
          name,
          text: media.caption || "",
          whatsappId: message.id,
          media,
        });
      }
    }
  }

  return messages;
}
