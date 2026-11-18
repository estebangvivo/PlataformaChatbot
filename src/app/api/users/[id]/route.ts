import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiAdmin } from "@/lib/auth";
import { DEFAULT_DEPARTMENT } from "@/lib/constants";
import { applyRoleToUser, findRoleBySlugOrId, isAdminUser } from "@/lib/roles";
import { notifyWaitingConversations } from "@/lib/waitlist";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiAdmin();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as {
    isOnline?: boolean;
    role?: string;
    fullName?: string;
    email?: string;
    password?: string;
    department?: string;
    keywords?: string[];
    workHours?: { days: number[]; start: string; end: string };
  };

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { agentProfile: true, accessRole: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const nextRole = body.role ? await findRoleBySlugOrId(body.role) : existing.accessRole;
  if (body.role && !nextRole) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  if (id === user.id && isAdminUser(existing) && nextRole && !nextRole.isAdmin && nextRole.slug !== "SUPERADMIN") {
    return NextResponse.json({ error: "No podés quitarte el permiso de administrador" }, { status: 400 });
  }

  if (body.email) {
    const email = body.email.toLowerCase().trim();
    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(typeof body.isOnline === "boolean" ? { isOnline: body.isOnline } : {}),
      ...(body.fullName?.trim() ? { fullName: body.fullName.trim() } : {}),
      ...(body.email ? { email: body.email.toLowerCase().trim() } : {}),
      ...(body.password?.trim() ? { passwordHash: await hashPassword(body.password) } : {}),
    },
  });

  if (nextRole) {
    await applyRoleToUser(id, nextRole, body.department);
  } else if (body.department?.trim() && existing.agentProfile) {
    await prisma.agentProfile.update({
      where: { userId: id },
      data: { department: body.department.trim() || DEFAULT_DEPARTMENT },
    });
  }

  if (existing.agentProfile && (body.keywords || body.workHours)) {
    await prisma.agentProfile.update({
      where: { userId: id },
      data: {
        ...(body.keywords ? { assignedKeywords: JSON.stringify(body.keywords) } : {}),
        ...(body.workHours ? { workHours: JSON.stringify(body.workHours) } : {}),
      },
    });
  }

  if (!existing.isOnline && updated.isOnline) {
    await notifyWaitingConversations(updated.id);
  }

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      role: nextRole?.slug ?? updated.role,
      fullName: updated.fullName,
      isOnline: updated.isOnline,
    },
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiAdmin();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: "No podés eliminarte" }, { status: 400 });
  }
  await prisma.conversation.updateMany({
    where: { assignedAgentId: id },
    data: { assignedAgentId: null },
  });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
