import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { notifyWaitingConversations } from "@/lib/waitlist";

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { isOnline?: boolean };
  const previous = await prisma.user.findUnique({ where: { id: user.id }, select: { isOnline: true } });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenAt: new Date(),
      ...(typeof body.isOnline === "boolean" ? { isOnline: body.isOnline } : {}),
    },
  });
  if (!previous?.isOnline && updated.isOnline) {
    await notifyWaitingConversations(updated.id);
  }
  return NextResponse.json({ isOnline: updated.isOnline });
}
