import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { listPeople } from "@/lib/team-chat";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error || !user) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const people = await listPeople(user.id);
  return NextResponse.json({ people });
}
