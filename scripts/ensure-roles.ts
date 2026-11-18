import { ensureSystemRoles } from "../src/lib/roles";

async function main() {
  const roles = await ensureSystemRoles();
  console.log("Roles listos:", roles.superadmin.slug, roles.agent.slug);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
