import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { EMPTY_PROFILE, readProfile, type ContactProfile } from "@/lib/personality";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireApiUser();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.conversation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  const body = (await request.json()) as {
    userName?: string | null;
    profile?: Partial<ContactProfile>;
  };

  const current = readProfile(existing.contactProfile);
  const next: ContactProfile = {
    ...EMPTY_PROFILE,
    ...current,
    ...(body.profile ?? {}),
    interests: body.profile?.interests ?? current.interests,
    notes: current.notes,
    unansweredStreak: current.unansweredStreak,
    lastGreetedOn: current.lastGreetedOn,
  };

  const display =
    body.userName?.trim() ||
    [next.firstName, next.lastName].filter(Boolean).join(" ") ||
    existing.userName;

  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      userName: display || null,
      contactProfile: JSON.stringify(next),
    },
  });

  return NextResponse.json({
    contact: {
      id: conversation.id,
      whatsappPhone: conversation.whatsappPhone,
      userName: conversation.userName,
      status: conversation.status,
      lastIntent: conversation.lastIntent,
      lastMessageAt: conversation.lastMessageAt,
      profile: next,
    },
  });
}
