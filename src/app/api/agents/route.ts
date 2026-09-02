import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJson } from "@/lib/utils";
import { parseHours, describeHours, isWithinHours } from "@/lib/hours";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const agents = await prisma.agentProfile.findMany({
    include: { user: true },
    orderBy: { department: "asc" },
  });

  return NextResponse.json({
    agents: agents.map((agent) => {
      const hours = parseHours(agent.workHours);
      return {
        id: agent.id,
        userId: agent.userId,
        fullName: agent.user.fullName,
        email: agent.user.email,
        isOnline: agent.user.isOnline && Date.now() - (agent.user.lastSeenAt?.getTime() ?? 0) < 3 * 60 * 1000,
        department: agent.department,
        keywords: parseJson<string[]>(agent.assignedKeywords, []),
        workHours: hours,
        hoursLabel: describeHours(hours),
        availableNow: agent.user.isOnline && isWithinHours(hours),
        lastAssignedAt: agent.lastAssignedAt,
      };
    }),
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
  if (user.role !== "SUPERADMIN" && profile.userId !== user.id) {
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
