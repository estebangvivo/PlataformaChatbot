import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { isOnline?: boolean };
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenAt: new Date(),
      ...(typeof body.isOnline === "boolean" ? { isOnline: body.isOnline } : {}),
    },
  });
  return NextResponse.json({ isOnline: updated.isOnline });
}
