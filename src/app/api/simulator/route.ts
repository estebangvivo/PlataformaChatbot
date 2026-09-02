import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleInboundWhatsApp } from "@/lib/bot";
import { prisma } from "@/lib/db";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function conversationByPhone(phone: string) {
  return prisma.conversation.findUnique({
    where: { whatsappPhone: phone },
    include: {
      assignedAgent: { select: { id: true, fullName: true } },
      messages: { orderBy: { timestamp: "asc" } },
    },
  });
}

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const phone = digits(request.nextUrl.searchParams.get("phone") ?? "");
  if (!phone) {
    return NextResponse.json({ error: "Falta el teléfono" }, { status: 400 });
  }

  const conversation = await conversationByPhone(phone);
  return NextResponse.json({ conversation });
}

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  try {
    const body = (await request.json()) as { phone?: string; name?: string; text?: string };
    if (!body.phone || !body.text) {
      return NextResponse.json({ error: "Faltan teléfono y mensaje" }, { status: 400 });
    }

    const phone = digits(body.phone);
    const result = await handleInboundWhatsApp({
      phone,
      name: body.name,
      text: body.text,
      channel: "simulator",
    });

    const conversation = await conversationByPhone(phone);
    return NextResponse.json({ ...result, conversation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del bot";
    console.error("simulator", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
