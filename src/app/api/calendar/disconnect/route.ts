import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/lib/google-calendar";

export async function POST() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  await disconnectGoogleCalendar();
  return NextResponse.json({ ok: true, connected: false });
}
