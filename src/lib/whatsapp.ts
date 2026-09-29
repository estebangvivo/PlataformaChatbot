const GRAPH = "https://graph.facebook.com/v21.0";

import { MENU_INTRO, MENU_OPTIONS } from "./menu";
import type { InboundMedia } from "./media";

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
