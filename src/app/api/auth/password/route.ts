import { NextResponse } from "next/server";
import { hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateNewPassword } from "@/lib/password";

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error || !user) return error;

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    password?: string;
    confirm?: string;
  };
  const currentPassword = body.currentPassword ?? "";
  const password = body.password ?? "";
  const confirm = body.confirm ?? "";

  if (!currentPassword) {
    return NextResponse.json({ error: "Ingresá tu contraseña actual" }, { status: 400 });
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  const validation = validateNewPassword(password, confirm);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }
  if (currentPassword === password) {
    return NextResponse.json({ error: "La nueva clave tiene que ser distinta" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  return NextResponse.json({ ok: true });
}