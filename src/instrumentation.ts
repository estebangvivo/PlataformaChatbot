export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startNightlyKnowledgeSync } = await import("./lib/nightly-sync");
  startNightlyKnowledgeSync();
  const { ensureSystemRoles } = await import("./lib/roles");
  await ensureSystemRoles().catch((error) => {
    console.warn("[r5] no se pudieron asegurar los roles del sistema", error);
  });
  const { ensureDeskRoles } = await import("./lib/desk-roles");
  await ensureDeskRoles().catch((error) => {
    console.warn("[r5] no se pudieron asegurar los roles de mesa", error);
  });
}
