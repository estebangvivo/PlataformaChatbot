import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { appOrigin, hashResetToken, newResetToken, resetExpiry } from "@/lib/password";

const GENERIC =
  "Si el correo está registrado, vas a recibir un enlace para elegir una clave nueva. Vale una hora. Si no llega, pedile a un SuperAdmin que te asigne una desde Usuarios.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Ingresá el email de tu cuenta" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, message: GENERIC });
  }

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = newResetToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: resetExpiry(),
    },
  });

  const resetUrl = `${appOrigin()}/login/nueva-clave?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Recuperar contraseña · CAPC Regional 5",
    text: [
      `Hola ${user.fullName},`,
      "",
      "Pediste restablecer tu clave del panel interno de Regional 5.",
      "Abrí este enlace (vale una hora):",
      resetUrl,
      "",
      "Si no fuiste vos, ignorá este mensaje.",
    ].join("\n"),
  });

  return NextResponse.json({
    ok: true,
    message: GENERIC,
    ...(process.env.NODE_ENV !== "production" ? { devResetUrl: resetUrl } : {}),
  });
}