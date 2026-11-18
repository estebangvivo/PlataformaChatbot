import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";

function originOf(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

export async function GET(request: Request) {
  const origin = originOf(request);
  const { user, error } = await requireApiAdmin();
  if (error || !user) {
    const dest = new URL("/agenda", origin);
    dest.searchParams.set("error", "Solo un administrador puede conectar Google Calendar");
    return NextResponse.redirect(dest);
  }
  const state = `${user.id}.${randomBytes(16).toString("hex")}`;
  const jar = await cookies();
  jar.set("r5_gcal_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  try {
    const url = await buildGoogleAuthUrl(originOf(request), state);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo iniciar Google";
    const dest = new URL("/agenda", originOf(request));
    dest.searchParams.set("error", message);
    return NextResponse.redirect(dest);
  }
}
