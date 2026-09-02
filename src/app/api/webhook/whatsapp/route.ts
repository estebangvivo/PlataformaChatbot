import { NextRequest, NextResponse } from "next/server";
import { parseWhatsAppPayload } from "@/lib/whatsapp";
import { handleInboundWhatsApp } from "@/lib/bot";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Token inválido" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const inbound = parseWhatsAppPayload(body);
  for (const message of inbound) {
    await handleInboundWhatsApp({
      phone: message.from,
      name: message.name,
      text: message.text,
      whatsappId: message.whatsappId,
      channel: "whatsapp",
    });
  }

  return NextResponse.json({ ok: true, processed: inbound.length });
}
