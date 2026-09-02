import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { DEFAULT_DEPARTMENT, ROLES } from "@/lib/constants";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: { agentProfile: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      isOnline: u.isOnline,
      createdAt: u.createdAt,
      department: u.agentProfile?.department ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    department?: string;
    keywords?: string[];
  };

  if (!body.email || !body.password || !body.fullName) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const created = await prisma.user.create({
    data: {
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      fullName: body.fullName,
      role: body.role === "SUPERADMIN" ? "SUPERADMIN" : "AGENT",
      ...(body.role !== "SUPERADMIN"
        ? {
            agentProfile: {
              create: {
                department: body.department || DEFAULT_DEPARTMENT,
                workHours: JSON.stringify({ days: [1, 2, 3, 4, 5], start: "08:00", end: "14:00" }),
                assignedKeywords: JSON.stringify(body.keywords ?? []),
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ user: { id: created.id, email: created.email } });
}
