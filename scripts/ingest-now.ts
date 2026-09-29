import { ingestRegional5, upsertCuratedFichas } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function main() {
  if (process.argv.includes("--fichas")) {
    const stored = await upsertCuratedFichas();
    const total = await prisma.knowledgeChunk.count();
    console.log(JSON.stringify({ fichas: stored, totalInDb: total }, null, 2));
    return;
  }
  console.log("Indexando regional5.com.ar …");
  const result = await ingestRegional5();
  const total = await prisma.knowledgeChunk.count();
  console.log(JSON.stringify({ ...result, totalInDb: total }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
