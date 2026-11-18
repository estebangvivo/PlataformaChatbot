import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { postTeamMessage, requireMembership } from "@/lib/team-chat";
import type { InboundMedia } from "@/lib/media";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const member = await requireMembership(id, user.id);
  if (!member) return NextResponse.json({ error: "No forma parte de este chat" }, { status: 403 });

  const body = (await request.json()) as { content?: string; media?: InboundMedia };
  if (!body.content?.trim() && !body.media) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  try {
    const message = await postTeamMessage({
      threadId: id,
      senderId: user.id,
      senderName: user.fullName,
      text: body.content ?? "",
      media: body.media,
    });
    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        metadata: message.metadata,
        createdAt: message.createdAt,
        senderId: message.senderId,
        senderName: user.fullName,
      },
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : "No se pudo enviar";
    return NextResponse.json({ error: text }, { status: 400 });
  }
}
