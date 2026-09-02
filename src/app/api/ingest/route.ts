import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { ingestRegional5 } from "@/lib/ingest";
import { ROLES } from "@/lib/constants";

export const maxDuration = 120;

export async function POST() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  if (user.role !== ROLES.SUPERADMIN) {
    return NextResponse.json({ error: "Solo SuperAdmin" }, { status: 403 });
  }
  const result = await ingestRegional5({ source: "manual" });
  return NextResponse.json(result);
}
