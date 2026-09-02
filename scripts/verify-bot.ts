import { answerWithRag } from "../src/lib/rag";
import { handleInboundWhatsApp } from "../src/lib/bot";
import { prisma } from "../src/lib/db";

async function main() {
  const rag = await answerWithRag("¿Cuál es el horario de atención de Regional 5?");
  console.log("RAG_CONFIDENCE", rag.confidence.toFixed(3));
  console.log("RAG_ANSWER_SNIPPET", rag.answer.slice(0, 180).replace(/\n/g, " "));

  const sede = await answerWithRag("¿Dónde queda la sede y cuál es el teléfono?");
  console.log("SEDE_CONFIDENCE", sede.confidence.toFixed(3));
  console.log("SEDE_SNIPPET", sede.answer.slice(0, 180).replace(/\n/g, " "));

  const result = await handleInboundWhatsApp({
    phone: "5493534111777",
    name: "Arq. Verificacion 2",
    text: "¿Dónde queda la sede y cuál es el teléfono?",
  });
  console.log("BOT_RESULT", JSON.stringify(result));

  const handoff = await handleInboundWhatsApp({
    phone: "5493534111777",
    name: "Arq. Verificacion",
    text: "quiero hablar con un agente humano de tesorería porque tengo una deuda",
  });
  console.log("HANDOFF_RESULT", JSON.stringify(handoff));

  const conversation = await prisma.conversation.findUnique({
    where: { whatsappPhone: "5493534111777" },
    include: { messages: true, assignedAgent: true },
  });
  console.log("STATUS", conversation?.status);
  console.log("MESSAGES", conversation?.messages.length);
  console.log("ASSIGNED", conversation?.assignedAgent?.fullName ?? "none");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
