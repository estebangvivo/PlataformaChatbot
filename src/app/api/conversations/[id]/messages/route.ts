import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { sendAgentReply } from "@/lib/bot";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as {
    content?: string;
    media?: { mime: string; dataBase64: string; filename?: string };
  };
  if (!body.content?.trim() && !body.media) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const message = await sendAgentReply({
    conversationId: id,
    agentId: user.id,
    text: body.content?.trim() ?? "",
    media: body.media,
  });
  return NextResponse.json({ message });
}
