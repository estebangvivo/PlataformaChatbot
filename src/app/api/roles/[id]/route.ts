import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { serializeRole } from "@/lib/roles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    isAdmin?: boolean;
    isDeskAgent?: boolean;
  };

  const name = body.name?.trim();
  const role = await prisma.role.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(typeof body.description === "string" ? { description: body.description.trim() } : {}),
      ...(existing.isSystem
        ? {}
        : {
            ...(typeof body.isAdmin === "boolean" ? { isAdmin: body.isAdmin } : {}),
            ...(typeof body.isDeskAgent === "boolean" ? { isDeskAgent: body.isDeskAgent } : {}),
          }),
    },
  });
  return NextResponse.json({ role: serializeRole(role) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
  if (existing.isSystem) {
    return NextResponse.json({ error: "Ese rol del sistema no se puede eliminar" }, { status: 400 });
  }
  if (existing._count.users > 0) {
    return NextResponse.json(
      { error: `Hay ${existing._count.users} persona(s) con este rol. Asignalés otro antes de borrarlo.` },
      { status: 400 },
    );
  }
  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
