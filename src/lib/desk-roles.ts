import { prisma } from "./db";
import { DEPARTMENTS } from "./constants";

export type DeskRoleRow = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  agentsCount: number;
  rulesCount: number;
};

export async function ensureDeskRoles() {
  const existing = await prisma.deskRole.findMany({ select: { name: true } });
  const have = new Set(existing.map((row) => row.name));
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const name = DEPARTMENTS[i];
    if (have.has(name)) continue;
    await prisma.deskRole.create({
      data: { name, sortOrder: i, description: "" },
    });
  }
}

export async function listDeskRoles(): Promise<DeskRoleRow[]> {
  await ensureDeskRoles();
  const roles = await prisma.deskRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const [agents, rules] = await Promise.all([
    prisma.agentProfile.groupBy({
      by: ["department"],
      _count: { _all: true },
    }),
    prisma.routingRule.groupBy({
      by: ["department"],
      _count: { _all: true },
    }),
  ]);
  const agentMap = new Map(agents.map((row) => [row.department, row._count._all]));
  const ruleMap = new Map(rules.map((row) => [row.department, row._count._all]));
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    sortOrder: role.sortOrder,
    agentsCount: agentMap.get(role.name) ?? 0,
    rulesCount: ruleMap.get(role.name) ?? 0,
  }));
}

export async function listDepartmentNames() {
  const roles = await listDeskRoles();
  const names = roles.map((role) => role.name);
  const [fromAgents, fromRules] = await Promise.all([
    prisma.agentProfile.findMany({ select: { department: true } }),
    prisma.routingRule.findMany({ select: { department: true } }),
  ]);
  const set = new Set(names);
  for (const row of fromAgents) if (row.department.trim()) set.add(row.department.trim());
  for (const row of fromRules) if (row.department.trim()) set.add(row.department.trim());
  return [...set].sort((a, b) => {
    const ia = names.indexOf(a);
    const ib = names.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, "es");
  });
}

export async function createDeskRole(params: { name: string; description?: string }) {
  const name = params.name.trim();
  if (!name) throw new Error("Falta el nombre del rol");
  const clash = await prisma.deskRole.findFirst({
    where: { name: { equals: name } },
  });
  if (clash) throw new Error("Ya existe un rol con ese nombre");
  const max = await prisma.deskRole.aggregate({ _max: { sortOrder: true } });
  return prisma.deskRole.create({
    data: {
      name,
      description: params.description?.trim() ?? "",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateDeskRole(id: string, params: { name?: string; description?: string }) {
  const existing = await prisma.deskRole.findUnique({ where: { id } });
  if (!existing) throw new Error("Rol no encontrado");
  const name = params.name?.trim() || existing.name;
  if (name !== existing.name) {
    const clash = await prisma.deskRole.findFirst({ where: { name, NOT: { id } } });
    if (clash) throw new Error("Ya existe un rol con ese nombre");
  }

  const updated = await prisma.deskRole.update({
    where: { id },
    data: {
      name,
      ...(typeof params.description === "string" ? { description: params.description.trim() } : {}),
    },
  });

  if (name !== existing.name) {
    await prisma.agentProfile.updateMany({
      where: { department: existing.name },
      data: { department: name },
    });
    await prisma.routingRule.updateMany({
      where: { department: existing.name },
      data: { department: name },
    });
  }

  return updated;
}

export async function deleteDeskRole(id: string) {
  const existing = await prisma.deskRole.findUnique({ where: { id } });
  if (!existing) throw new Error("Rol no encontrado");
  const [agents, rules] = await Promise.all([
    prisma.agentProfile.count({ where: { department: existing.name } }),
    prisma.routingRule.count({ where: { department: existing.name } }),
  ]);
  if (agents > 0) {
    throw new Error(`Hay ${agents} agente${agents === 1 ? "" : "s"} con este rol. Asignalés otro antes de borrarlo.`);
  }
  if (rules > 0) {
    throw new Error(`Hay ${rules} regla${rules === 1 ? "" : "s"} de enrutamiento con este rol. Cambialas antes de borrarlo.`);
  }
  await prisma.deskRole.delete({ where: { id } });
  return existing;
}
