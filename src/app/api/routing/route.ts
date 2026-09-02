import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { parseJson } from "@/lib/utils";
import { ROLES } from "@/lib/constants";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  const rules = await prisma.routingRule.findMany({ orderBy: { priority: "desc" } });
  return NextResponse.json({
    rules: rules.map((rule) => ({
      ...rule,
      keywords: parseJson<string[]>(rule.keywords, []),
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
    intent?: string;
    department?: string;
    keywords?: string[];
    priority?: number;
  };
  if (!body.intent || !body.department) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const rule = await prisma.routingRule.create({
    data: {
      intent: body.intent,
      department: body.department,
      keywords: JSON.stringify(body.keywords ?? []),
      priority: body.priority ?? 10,
    },
  });
  return NextResponse.json({ rule });
}

export async function PATCH(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }
  const body = (await request.json()) as {
    id?: string;
    isActive?: boolean;
    keywords?: string[];
    department?: string;
    priority?: number;
    intent?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const rule = await prisma.routingRule.update({
    where: { id: body.id },
    data: {
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(body.keywords ? { keywords: JSON.stringify(body.keywords) } : {}),
      ...(body.department ? { department: body.department } : {}),
      ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
      ...(body.intent ? { intent: body.intent } : {}),
    },
  });
  return NextResponse.json({ rule });
}

export async function DELETE(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }
  const { id } = (await request.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.routingRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
