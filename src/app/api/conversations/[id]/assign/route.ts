import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { assignToAgent } from "@/lib/routing";
import { saveMessage } from "@/lib/bot";
import { sendWhatsAppText } from "@/lib/whatsapp";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;
  const body = (await request.json()) as { agentUserId?: string };
  if (!body.agentUserId) {
    return NextResponse.json({ error: "Elegí un asesor" }, { status: 400 });
  }

  const assigned = await assignToAgent(id, body.agentUserId, "derivacion_manual", user.id);
  if (!assigned) return NextResponse.json({ error: "Asesor no encontrado" }, { status: 404 });

  const dept = assigned.agent?.department ?? "Regional 5";
  const notice = `Te dejo con ${assigned.user.fullName} de ${dept}.`;
  await saveMessage({
    conversationId: id,
    senderType: "BOT",
    content: notice,
    metadata: { kind: "assign" },
  });
  await sendWhatsAppText(assigned.conversation.whatsappPhone, notice);
  return NextResponse.json({ conversation: assigned.conversation });
}
