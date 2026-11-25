import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiAdmin, requireApiUser } from "@/lib/auth";
import { parseJson } from "@/lib/utils";
import { parseHours, describeHours, isWithinHours } from "@/lib/hours";
import { DEFAULT_DEPARTMENT } from "@/lib/constants";
import { isDeskUserOnline } from "@/lib/routing";
import {
  defaultWorkHours,
  ensureSystemRoles,
  findRoleBySlugOrId,
  isAdminUser,
  listDepartments,
} from "@/lib/roles";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  await ensureSystemRoles();

  const [agents, departments] = await Promise.all([
    prisma.agentProfile.findMany({
      include: { user: { include: { accessRole: true } } },
      orderBy: { department: "asc" },
    }),
    listDepartments(),
  ]);

  return NextResponse.json({
    isAdmin: isAdminUser(user),
    departments,
    agents: agents.map((agent) => {
      const hours = parseHours(agent.workHours);
      return {
        id: agent.id,
        userId: agent.userId,
        fullName: agent.user.fullName,
        email: agent.user.email,
        role: agent.user.accessRole?.slug ?? agent.user.role,
        roleName: agent.user.accessRole?.name ?? agent.user.role,
        isOnline: isDeskUserOnline(agent.user),
        department: agent.department,
        keywords: parseJson<string[]>(agent.assignedKeywords, []),
        workHours: hours,
        hoursLabel: describeHours(hours),
        availableNow: isDeskUserOnline(agent.user) && isWithinHours(hours),
        lastAssignedAt: agent.lastAssignedAt,
      };
    }),
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
    return NextResponse.json({ error: "Faltan nombre, email y contraseña" }, { status: 400 });
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
      agentProfile: {
        create: {
          department: body.department?.trim() || DEFAULT_DEPARTMENT,
          workHours: JSON.stringify(hours),
          assignedKeywords: JSON.stringify(body.keywords ?? []),
        },
      },
    },
    include: { agentProfile: true },
  });

  return NextResponse.json({
    agent: {
      id: created.agentProfile?.id,
      userId: created.id,
      fullName: created.fullName,
      email: created.email,
    },
  });
}

export async function PATCH(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const body = (await request.json()) as {
    id?: string;
    department?: string;
    keywords?: string[];
    workHours?: { days: number[]; start: string; end: string };
  };
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const profile = await prisma.agentProfile.findUnique({ where: { id: body.id } });
  if (!profile) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!isAdminUser(user) && profile.userId !== user.id) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const updated = await prisma.agentProfile.update({
    where: { id: body.id },
    data: {
      ...(body.department ? { department: body.department } : {}),
      ...(body.keywords ? { assignedKeywords: JSON.stringify(body.keywords) } : {}),
      ...(body.workHours ? { workHours: JSON.stringify(body.workHours) } : {}),
    },
  });
  return NextResponse.json({ agent: updated });
}
