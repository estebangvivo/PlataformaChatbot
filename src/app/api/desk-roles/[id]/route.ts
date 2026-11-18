import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { deleteDeskRole, updateDeskRole } from "@/lib/desk-roles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { id } = await params;
  const body = (await request.json()) as { name?: string; description?: string };
  try {
    const role = await updateDeskRole(id, body);
    return NextResponse.json({ role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo guardar el rol";
    const status = message === "Rol no encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { id } = await params;
  try {
    await deleteDeskRole(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo eliminar";
    const status = message === "Rol no encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
