import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.knowledgeChunk.deleteMany({
    where: {
      OR: [
        { title: "Capacitaciones y cursos Regional 5" },
        { title: "Matrícula M7 y capacitaciones para recién recibidos" },
      ],
    },
  });

  await prisma.knowledgeChunk.createMany({
    data: [
      {
        pageUrl: "https://regional5.com.ar/colegio-arquitectos/capacitacion/",
        title: "Capacitaciones y cursos Regional 5",
        category: "Capacitación",
        contentChunk:
          "Las capacitaciones y cursos de Regional 5 se publican en regional5.com.ar/colegio-arquitectos/capacitacion/ y se envían por mail y WhatsApp a los matriculados. Hay jornadas presenciales en sede y subcentros, con cupos limitados e inscripción previa. Ejemplo reciente: Capacitación en Perfilería y terminaciones ATRIM, presencial en Subcentro Oncativo (Rivadavia 743), 18 hs. Para próximas fechas conviene mirar esa sección o preguntar el tema de interés (gas, catastro, firma digital, patrimonio, obra).",
      },
      {
        pageUrl: "https://regional5.com.ar/colegio-arquitectos/servicios/",
        title: "Matrícula M7 y capacitaciones para recién recibidos",
        category: "Capacitación",
        contentChunk:
          "La matrícula M7 es gratuita para arquitectos recientemente recibidos y permite acceso a las capacitaciones, servicios, beneficios e instalaciones del CAPC.",
      },
    ],
  });

  const exists = await prisma.routingRule.findFirst({ where: { intent: "capacitacion" } });
  if (!exists) {
    await prisma.routingRule.create({
      data: {
        intent: "capacitacion",
        department: "Consultas Generales",
        keywords: JSON.stringify(["curso", "cursos", "capacitacion", "taller", "charla"]),
        priority: 16,
      },
    });
  }

  console.log("Knowledge de capacitación actualizada");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
