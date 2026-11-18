import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { addDaysYmd, startOfWeekYmd, ymdInTz } from "@/lib/calendar-time";
import { createGoogleEvent, getCalendarConnection, listGoogleEvents } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  const connection = await getCalendarConnection();
  if (!connection.connected) {
    return NextResponse.json({ connected: false, events: [] });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || startOfWeekYmd(ymdInTz());
  const to = url.searchParams.get("to") || addDaysYmd(from, 7);
  try {
    const events = await listGoogleEvents(from, to);
    return NextResponse.json({ connected: true, events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudieron leer los eventos";
    return NextResponse.json({ error: message, events: [] }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;
  const connection = await getCalendarConnection();
  if (!connection.connected) {
    return NextResponse.json({ error: "El calendario no está conectado" }, { status: 409 });
  }
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    location?: string;
    allDay?: boolean;
    start?: string;
    end?: string;
    colorId?: string;
  };
  if (!body.title?.trim() || !body.start || !body.end) {
    return NextResponse.json({ error: "Faltan título, inicio o fin" }, { status: 400 });
  }
  try {
    const event = await createGoogleEvent({
      title: body.title,
      description: body.description,
      location: body.location,
      allDay: body.allDay,
      start: body.start,
      end: body.end,
      colorId: body.colorId,
    });
    return NextResponse.json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el evento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
