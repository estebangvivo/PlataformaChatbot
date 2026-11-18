import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { findOrCreateDirect, listThreads } from "@/lib/team-chat";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const threads = await listThreads(user.id);
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unread, 0);
  return NextResponse.json({ threads, unreadTotal });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await request.json()) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: "Falta la persona" }, { status: 400 });
  try {
    const thread = await findOrCreateDirect(user.id, body.userId);
    const threads = await listThreads(user.id);
    return NextResponse.json({
      threadId: thread.id,
      thread: threads.find((row) => row.id === thread.id) ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo abrir el chat";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
