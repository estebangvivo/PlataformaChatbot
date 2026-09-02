import { handleInboundWhatsApp } from "../src/lib/bot";
import { prisma } from "../src/lib/db";

async function main() {
  const phone = "5493534999001";
  await prisma.message.deleteMany({
    where: { conversation: { whatsappPhone: phone } },
  });
  await prisma.conversation.deleteMany({ where: { whatsappPhone: phone } });

  const first = await handleInboundWhatsApp({
    phone,
    name: "Lucía Gómez",
    text: "Hola buenas tardes, quiero saber que cursos hay disponibles",
  });
  console.log("FIRST", JSON.stringify(first));

  const second = await handleInboundWhatsApp({
    phone,
    name: "Lucía Gómez",
    text: "Me llamo Lucía, soy de Bell Ville, arquitecta matriculada",
  });
  console.log("SECOND", JSON.stringify(second));

  const conversation = await prisma.conversation.findUnique({
    where: { whatsappPhone: phone },
    include: { messages: { orderBy: { timestamp: "asc" } } },
  });
  console.log("PROFILE", conversation?.contactProfile);
  console.log("BOT1", conversation?.messages.find((m) => m.senderType === "BOT")?.content);
  console.log(
    "BOT2",
    conversation?.messages.filter((m) => m.senderType === "BOT").at(-1)?.content,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
