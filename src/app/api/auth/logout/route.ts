import { NextResponse } from "next/server";
import { destroySession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await requireUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: false, lastSeenAt: new Date() },
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
