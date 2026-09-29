import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { DEFAULT_DEPARTMENT, ROLES } from "@/lib/constants";
import { notifyWaitingConversations } from "@/lib/waitlist";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as {
    isOnline?: boolean;
    role?: string;
    fullName?: string;
    email?: string;
    password?: string;
    department?: string;
  };

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { agentProfile: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const nextRole = body.role === "SUPERADMIN" || body.role === "AGENT" ? body.role : existing.role;
  if (id === user.id && existing.role === "SUPERADMIN" && nextRole !== "SUPERADMIN") {
    return NextResponse.json({ error: "No podés quitarte el rol SuperAdmin" }, { status: 400 });
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
      role: nextRole,
      ...(body.fullName?.trim() ? { fullName: body.fullName.trim() } : {}),
      ...(body.email ? { email: body.email.toLowerCase().trim() } : {}),
      ...(body.password?.trim() ? { passwordHash: await hashPassword(body.password) } : {}),
    },
  });

  if (!existing.isOnline && updated.isOnline) {
    await notifyWaitingConversations(updated.id);
  }

  if (nextRole === "AGENT") {
    const department = body.department?.trim() || existing.agentProfile?.department || DEFAULT_DEPARTMENT;
    if (existing.agentProfile) {
      await prisma.agentProfile.update({
        where: { userId: id },
        data: { department },
      });
    } else {
      await prisma.agentProfile.create({
        data: {
          userId: id,
          department,
          workHours: JSON.stringify({ days: [1, 2, 3, 4, 5], start: "08:00", end: "14:00" }),
          assignedKeywords: JSON.stringify([]),
        },
      });
    }
  }

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      fullName: updated.fullName,
      isOnline: updated.isOnline,
    },
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }
  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: "No podés eliminarte" }, { status: 400 });
  }
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
