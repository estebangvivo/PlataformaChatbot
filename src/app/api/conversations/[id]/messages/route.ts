import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { sendAgentReply } from "@/lib/bot";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;
  const body = (await request.json()) as { content?: string };
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const message = await sendAgentReply({
    conversationId: id,
    agentId: user.id,
    text: body.content.trim(),
  });
  return NextResponse.json({ message });
}
