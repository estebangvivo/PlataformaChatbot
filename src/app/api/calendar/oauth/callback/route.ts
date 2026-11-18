import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { exchangeGoogleCode } from "@/lib/google-calendar";

function originOf(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { error } = await requireApiAdmin();
  const origin = originOf(request);
  const dest = new URL("/agenda", origin);
  if (error) {
    dest.pathname = "/login";
    dest.searchParams.set("from", "/agenda");
    return NextResponse.redirect(dest);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const jar = await cookies();
  const expected = jar.get("r5_gcal_oauth")?.value;
  jar.delete("r5_gcal_oauth");

  if (oauthError) {
    dest.searchParams.set("error", "Se canceló la conexión con Google");
    return NextResponse.redirect(dest);
  }
  if (!code || !state || !expected || state !== expected) {
    dest.searchParams.set("error", "La conexión con Google no es válida. Probá de nuevo.");
    return NextResponse.redirect(dest);
  }

  try {
    await exchangeGoogleCode(origin, code);
    dest.searchParams.set("connected", "1");
  } catch (err) {
    dest.searchParams.set("error", err instanceof Error ? err.message : "No se pudo vincular Google Calendar");
  }
  return NextResponse.redirect(dest);
}
