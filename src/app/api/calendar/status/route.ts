import { NextResponse } from "next/server";
import { requireApiAdmin, requireApiUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/roles";
import {
  calendarRedirectUri,
  getCalendarConnection,
  listGoogleCalendars,
  saveCalendarOAuthConfig,
  setActiveCalendar,
} from "@/lib/google-calendar";

function originOf(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const connection = await getCalendarConnection();
  let calendars: Awaited<ReturnType<typeof listGoogleCalendars>> = [];
  if (connection.connected) {
    try {
      calendars = await listGoogleCalendars();
    } catch {
      calendars = [];
    }
  }
  return NextResponse.json({
    ...connection,
    canConnect: isAdminUser(user),
    redirectUri: calendarRedirectUri(originOf(request)),
    calendars,
  });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const body = (await request.json()) as {
    clientId?: string;
    clientSecret?: string;
    calendarId?: string;
  };
  if (body.clientId || body.clientSecret) {
    await saveCalendarOAuthConfig(body.clientId ?? "", body.clientSecret);
  }
  if (body.calendarId) {
    try {
      await setActiveCalendar(body.calendarId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo elegir el calendario";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  const connection = await getCalendarConnection();
  return NextResponse.json({ ok: true, ...connection });
}
