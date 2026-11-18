import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin, requireApiUser } from "@/lib/auth";
import {
  ensureSystemRoles,
  isAdminUser,
  listDepartments,
  roleSlugFromName,
  serializeRole,
} from "@/lib/roles";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  await ensureSystemRoles();

  const [roles, departments] = await Promise.all([
    prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    }),
    listDepartments(),
  ]);

  return NextResponse.json({
    isAdmin: isAdminUser(user),
    departments,
    roles: roles.map((role) => ({
      ...serializeRole(role),
      usersCount: role._count.users,
    })),
  });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  await ensureSystemRoles();

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    isAdmin?: boolean;
    isDeskAgent?: boolean;
  };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Falta el nombre del rol" }, { status: 400 });

  let slug = roleSlugFromName(name);
  const clash = await prisma.role.findUnique({ where: { slug } });
  if (clash) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;

  const role = await prisma.role.create({
    data: {
      slug,
      name,
      description: body.description?.trim() ?? "",
      isAdmin: Boolean(body.isAdmin),
      isDeskAgent: body.isDeskAgent !== false,
      isSystem: false,
    },
  });
  return NextResponse.json({ role: serializeRole(role) });
}
