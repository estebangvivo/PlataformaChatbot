import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const { user, error } = await requireApiUser();
  if (error) return error;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      isOnline: user.isOnline,
      department: user.agentProfile?.department ?? null,
    },
  });
}
