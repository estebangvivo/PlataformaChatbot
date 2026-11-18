import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiAdmin();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const profile = await prisma.agentProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (profile.userId === user.id) {
    return NextResponse.json({ error: "No podés eliminarte" }, { status: 400 });
  }

  await prisma.conversation.updateMany({
    where: { assignedAgentId: profile.userId },
    data: { assignedAgentId: null },
  });
  await prisma.user.delete({ where: { id: profile.userId } });
  return NextResponse.json({ ok: true });
}
