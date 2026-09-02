import { answerWithRag } from "../src/lib/rag";
import { prisma } from "../src/lib/db";

async function main() {
  const cats = await prisma.knowledgeChunk.groupBy({
    by: ["category"],
    _count: true,
  });
  console.log("CATEGORIES", cats);

  for (const q of [
    "Hola, qué cursos hay disponibles?",
    "Cómo saco un turno para asesoría?",
    "Quiero hacer un trámite de expediente",
    "Hay bolsa de trabajo?",
  ]) {
    const r = await answerWithRag(q);
    console.log("\nQ:", q);
    console.log("found", r.found, "conf", r.confidence.toFixed(3), "src", r.sources[0]?.title);
    console.log((r.answer || "(vacío)").slice(0, 220).replace(/\n/g, " "));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
