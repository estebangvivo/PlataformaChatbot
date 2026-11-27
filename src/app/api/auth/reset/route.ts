import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashResetToken, validateNewPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
    confirm?: string;
  };
  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";
  const confirm = body.confirm ?? "";

  if (!token) {
    return NextResponse.json({ error: "Falta el enlace de recuperación" }, { status: 400 });
  }

  const error = validateNewPassword(password, confirm);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "El enlace no es válido o ya venció. Pedí uno nuevo." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}