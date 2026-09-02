const GRAPH = "https://graph.facebook.com/v21.0";

type InboundMessage = {
  from: string;
  name?: string;
  text: string;
  whatsappId?: string;
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

export function parseWhatsAppPayload(body: unknown): InboundMessage[] {
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
          }>;
        };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contacts = new Map(
        (value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
      );
      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body) continue;
        messages.push({
          from: message.from,
          name: contacts.get(message.from),
          text: message.text.body,
          whatsappId: message.id,
        });
      }
    }
  }

  return messages;
}
