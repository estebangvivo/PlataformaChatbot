import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { deleteGoogleEvent, getCalendarConnection, updateGoogleEvent } from "@/lib/google-calendar";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiUser();
  if (error) return error;
  const connection = await getCalendarConnection();
  if (!connection.connected) {
    return NextResponse.json({ error: "El calendario no está conectado" }, { status: 409 });
  }
  const { id } = await params;
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
    const event = await updateGoogleEvent(id, {
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
    const message = err instanceof Error ? err.message : "No se pudo guardar el evento";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiUser();
  if (error) return error;
  const connection = await getCalendarConnection();
  if (!connection.connected) {
    return NextResponse.json({ error: "El calendario no está conectado" }, { status: 409 });
  }
  const { id } = await params;
  try {
    await deleteGoogleEvent(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo eliminar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
