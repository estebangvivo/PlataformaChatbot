import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { readProfile } from "@/lib/personality";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });

  const contacts = conversations
    .map((row) => {
      const profile = readProfile(row.contactProfile);
      return {
        id: row.id,
        whatsappPhone: row.whatsappPhone,
        userName: row.userName,
        status: row.status,
        lastIntent: row.lastIntent,
        lastMessageAt: row.lastMessageAt,
        createdAt: row.createdAt,
        messageCount: row._count.messages,
        profile,
      };
    })
    .filter((contact) => {
      if (!q) return true;
      const hay = [
        contact.userName,
        contact.whatsappPhone,
        contact.profile.firstName,
        contact.profile.lastName,
        contact.profile.locality,
        contact.profile.matricula,
        contact.profile.email,
        contact.profile.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  return NextResponse.json({ contacts });
}
