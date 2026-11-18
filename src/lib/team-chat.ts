import { prisma } from "./db";
import { hub } from "./events";
import { isDeskUserOnline } from "./routing";
import { savePublicUpload } from "./uploads";
import { mediaKind, mediaLabel, type InboundMedia } from "./media";

export const MESA_KEY = "group:mesa";

type MemberUser = {
  id: string;
  fullName: string;
  email: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
  agentProfile: { department: string } | null;
  accessRole: { name: string } | null;
};

const memberInclude = {
  user: {
    include: {
      agentProfile: { select: { department: true } },
      accessRole: { select: { name: true } },
    },
  },
} as const;

export function dmKey(a: string, b: string) {
  return `dm:${[a, b].sort().join(":")}`;
}

export function serializePerson(user: MemberUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    department: user.agentProfile?.department ?? null,
    roleName: user.accessRole?.name ?? null,
    isOnline: isDeskUserOnline(user),
  };
}

export async function ensureMesaThread() {
  let thread = await prisma.teamThread.findUnique({ where: { key: MESA_KEY } });
  if (!thread) {
    thread = await prisma.teamThread.create({
      data: {
        key: MESA_KEY,
        kind: "group",
        title: "Mesa Regional 5",
        lastPreview: "Canal de todo el equipo",
      },
    });
  }
  const users = await prisma.user.findMany({ select: { id: true } });
  const existing = await prisma.teamThreadMember.findMany({
    where: { threadId: thread.id },
    select: { userId: true },
  });
  const have = new Set(existing.map((row) => row.userId));
  const missing = users.filter((user) => !have.has(user.id));
  if (missing.length) {
    await prisma.teamThreadMember.createMany({
      data: missing.map((user) => ({ threadId: thread.id, userId: user.id })),
    });
  }
  return thread;
}

export async function findOrCreateDirect(meId: string, otherId: string) {
  if (meId === otherId) throw new Error("No podés chatear con vos mismo");
  const other = await prisma.user.findUnique({ where: { id: otherId } });
  if (!other) throw new Error("No encontramos a esa persona");

  const key = dmKey(meId, otherId);
  const existing = await prisma.teamThread.findUnique({ where: { key } });
  if (existing) {
    await prisma.teamThreadMember.createMany({
      data: [
        { threadId: existing.id, userId: meId },
        { threadId: existing.id, userId: otherId },
      ],
      skipDuplicates: true,
    });
    return existing;
  }

  return prisma.teamThread.create({
    data: {
      key,
      kind: "direct",
      members: {
        create: [{ userId: meId }, { userId: otherId }],
      },
    },
  });
}

export async function requireMembership(threadId: string, userId: string) {
  const member = await prisma.teamThreadMember.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  return member;
}

export async function markRead(threadId: string, userId: string) {
  await prisma.teamThreadMember.updateMany({
    where: { threadId, userId },
    data: { lastReadAt: new Date() },
  });
}

function threadTitle(kind: string, title: string | null, members: Array<{ user: MemberUser }>, meId: string) {
  if (kind === "group") return title || "Grupo";
  const other = members.find((row) => row.user.id !== meId)?.user;
  return other?.fullName || "Chat interno";
}

export async function serializeThread(threadId: string, meId: string) {
  const thread = await prisma.teamThread.findUnique({
    where: { id: threadId },
    include: {
      members: { include: memberInclude },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!thread) return null;
  const mine = thread.members.find((row) => row.userId === meId);
  if (!mine) return null;
  const unread = await prisma.teamChatMessage.count({
    where: {
      threadId,
      createdAt: { gt: mine.lastReadAt },
      NOT: { senderId: meId },
    },
  });
  const other = thread.members.find((row) => row.userId !== meId)?.user ?? null;
  return {
    id: thread.id,
    kind: thread.kind,
    title: threadTitle(thread.kind, thread.title, thread.members, meId),
    lastMessageAt: thread.lastMessageAt,
    lastPreview: thread.lastPreview,
    unread,
    members: thread.members.map((row) => serializePerson(row.user)),
    other: other ? serializePerson(other) : null,
  };
}

export async function listThreads(meId: string) {
  await ensureMesaThread();
  const memberships = await prisma.teamThreadMember.findMany({
    where: { userId: meId },
    include: {
      thread: {
        include: {
          members: { include: memberInclude },
        },
      },
    },
  });
  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const thread = membership.thread;
      const unread = await prisma.teamChatMessage.count({
        where: {
          threadId: thread.id,
          createdAt: { gt: membership.lastReadAt },
          NOT: { senderId: meId },
        },
      });
      const other = thread.members.find((row) => row.userId !== meId)?.user ?? null;
      return {
        id: thread.id,
        kind: thread.kind,
        title: threadTitle(thread.kind, thread.title, thread.members, meId),
        lastMessageAt: thread.lastMessageAt,
        lastPreview: thread.lastPreview,
        unread,
        members: thread.members.map((row) => serializePerson(row.user)),
        other: other ? serializePerson(other) : null,
      };
    }),
  );
  return rows.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
}

export async function listPeople(meId: string) {
  const users = await prisma.user.findMany({
    where: { id: { not: meId } },
    include: {
      agentProfile: { select: { department: true } },
      accessRole: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });
  return users.map((user) => serializePerson(user));
}

export async function postTeamMessage(params: {
  threadId: string;
  senderId: string;
  senderName: string;
  text: string;
  media?: InboundMedia;
}) {
  const caption = params.text.trim();
  let content = caption;
  let metadata: string | null = null;
  if (params.media) {
    const stored = await savePublicUpload(params.media);
    const kind = mediaKind(params.media.mime);
    content = caption || `📎 ${mediaLabel(kind)}${params.media.filename ? ` · ${params.media.filename}` : ""}`;
    metadata = JSON.stringify({
      kind: "media",
      mime: params.media.mime,
      filename: params.media.filename || stored.filename,
      url: stored.url,
    });
  }
  if (!content) throw new Error("Mensaje vacío");

  const message = await prisma.teamChatMessage.create({
    data: {
      threadId: params.threadId,
      senderId: params.senderId,
      content,
      metadata,
    },
  });
  await prisma.teamThread.update({
    where: { id: params.threadId },
    data: {
      lastMessageAt: message.createdAt,
      lastPreview: content.slice(0, 140),
    },
  });
  await markRead(params.threadId, params.senderId);

  const members = await prisma.teamThreadMember.findMany({
    where: { threadId: params.threadId },
    select: { userId: true },
  });
  const thread = await serializeThread(params.threadId, params.senderId);
  hub.emitEvent({
    type: "team.chat",
    payload: {
      threadId: params.threadId,
      memberIds: members.map((row) => row.userId),
      senderId: params.senderId,
      senderName: params.senderName,
      preview: content.slice(0, 140),
      title: thread?.title ?? "Chat interno",
    },
  });
  return message;
}
