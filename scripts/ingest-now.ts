import { ingestRegional5 } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function main() {
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
