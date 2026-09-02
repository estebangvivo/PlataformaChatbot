import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleInboundWhatsApp } from "@/lib/bot";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  if (conversation.status === "HUMAN") {
    return NextResponse.json({ conversation, alreadyHuman: true });
  }

  const result = await handleInboundWhatsApp({
    phone: conversation.whatsappPhone,
    name: conversation.userName ?? undefined,
    text: "Quiero hablar con un asesor",
  });
  return NextResponse.json({ ...result, offerHuman: false });
}
