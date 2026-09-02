export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startNightlyKnowledgeSync } = await import("./lib/nightly-sync");
  startNightlyKnowledgeSync();
}
