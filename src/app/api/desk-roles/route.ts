import { NextResponse } from "next/server";
import { requireApiAdmin, requireApiUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/roles";
import { createDeskRole, listDeskRoles } from "@/lib/desk-roles";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  const roles = await listDeskRoles();
  return NextResponse.json({
    isAdmin: isAdminUser(user),
    roles,
    departments: roles.map((role) => role.name),
  });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const body = (await request.json()) as { name?: string; description?: string };
  try {
    const role = await createDeskRole({
      name: body.name ?? "",
      description: body.description,
    });
    return NextResponse.json({ role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el rol";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
