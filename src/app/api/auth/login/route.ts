import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { notifyWaitingConversations } from "@/lib/waitlist";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Completá email y contraseña" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const previousOnline = user.isOnline;
  await prisma.user.update({
    where: { id: user.id },
    data: { isOnline: true, lastSeenAt: new Date() },
  });
  if (!previousOnline) {
    await notifyWaitingConversations(user.id);
  }

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    fullName: user.fullName,
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
  });
}
