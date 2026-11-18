import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiAdmin } from "@/lib/auth";
import { DEFAULT_DEPARTMENT } from "@/lib/constants";
import { defaultWorkHours, ensureSystemRoles, findRoleBySlugOrId } from "@/lib/roles";

export async function GET() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  await ensureSystemRoles();

  const users = await prisma.user.findMany({
    include: { agentProfile: true, accessRole: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.accessRole?.slug ?? u.role,
      roleName: u.accessRole?.name ?? u.role,
      roleId: u.roleId,
      fullName: u.fullName,
      isOnline: u.isOnline,
      createdAt: u.createdAt,
      department: u.agentProfile?.department ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  await ensureSystemRoles();

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    department?: string;
    keywords?: string[];
    workHours?: { days: number[]; start: string; end: string };
  };

  if (!body.email || !body.password || !body.fullName) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });

  const accessRole = (await findRoleBySlugOrId(body.role)) ?? (await findRoleBySlugOrId("AGENT"));
  if (!accessRole) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  const hours = body.workHours ?? defaultWorkHours();
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(body.password),
      fullName: body.fullName.trim(),
      role: accessRole.slug,
      roleId: accessRole.id,
      ...(accessRole.isDeskAgent
        ? {
            agentProfile: {
              create: {
                department: body.department?.trim() || DEFAULT_DEPARTMENT,
                workHours: JSON.stringify(hours),
                assignedKeywords: JSON.stringify(body.keywords ?? []),
              },
            },
          }
        : {}),
    },
    include: { agentProfile: true, accessRole: true },
  });

  return NextResponse.json({
    user: {
      id: created.id,
      email: created.email,
      role: accessRole.slug,
      fullName: created.fullName,
    },
  });
}
