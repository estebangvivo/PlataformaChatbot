import { prisma } from "./db";
import { readProfile } from "./personality";
import { sendWhatsAppText } from "./whatsapp";
import { emitDeskNotify, hub } from "./events";

export async function subscribeAgentWait(conversationId: string, department?: string | null) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return;
  const profile = readProfile(conversation.contactProfile);
  profile.notifyOnAgent = true;
  profile.notifyDepartment = department || null;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { contactProfile: JSON.stringify(profile) },
  });
}

export async function notifyWaitingConversations(agentUserId: string) {
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId },
    include: { agentProfile: true },
  });
  if (!agent?.isOnline) return 0;

  const department = agent.agentProfile?.department ?? null;
  const waiting = await prisma.conversation.findMany({
    where: { status: { in: ["BOT", "PENDING"] }, botEnabled: true },
  });

  let notified = 0;
  for (const conversation of waiting) {
    const profile = readProfile(conversation.contactProfile);
    if (!profile.notifyOnAgent) continue;
    if (profile.notifyDepartment && department && profile.notifyDepartment !== department) continue;

    profile.notifyOnAgent = false;
    profile.awaiting = "confirmar_humano";
    const reply = department
      ? `Se conectó ${agent.fullName} de ${department}. Si seguís queriendo hablar con mesa, respondé “sí” y te dejo con esa persona.`
      : `Se conectó ${agent.fullName}. Si seguís queriendo hablar con mesa, respondé “sí” y te derivo.`;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { contactProfile: JSON.stringify(profile), lastIntent: "offer_human" },
    });
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "BOT",
        content: reply,
        metadata: JSON.stringify({ kind: "agent_online", agentUserId: agent.id }),
      },
    });
    hub.emitEvent({ type: "message.created", payload: message });
    await sendWhatsAppText(conversation.whatsappPhone, reply);
    emitDeskNotify({
      agentUserId: agent.id,
      conversationId: conversation.id,
      title: "Hay un matriculado esperándote",
      body: `${conversation.userName ?? conversation.whatsappPhone} pidió mesa mientras no había nadie en línea.`,
      kind: "assign",
    });
    hub.emitEvent({ type: "conversation.updated", payload: { conversationId: conversation.id } });
    notified += 1;
  }
  return notified;
}
