import { prisma } from "./db";
import { ROLES } from "./constants";
import { normalizeText } from "./utils";

export type AccessRole = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isAdmin: boolean;
  isDeskAgent: boolean;
};

const DEFAULT_HOURS = { days: [1, 2, 3, 4, 5], start: "08:00", end: "14:00" };

export function defaultWorkHours() {
  return { ...DEFAULT_HOURS, days: [...DEFAULT_HOURS.days] };
}

export function isAdminUser(user: { role: string; accessRole?: { isAdmin: boolean } | null }) {
  return user.role === ROLES.SUPERADMIN || Boolean(user.accessRole?.isAdmin);
}

export function roleSlugFromName(name: string) {
  const base =
    normalizeText(name)
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 40) || "rol";
  return base.toUpperCase() === "SUPERADMIN" || base.toUpperCase() === "AGENT"
    ? `${base}_custom`
    : base;
}

export async function ensureSystemRoles() {
  const superadmin = await prisma.role.upsert({
    where: { slug: ROLES.SUPERADMIN },
    update: { isSystem: true, isAdmin: true },
    create: {
      slug: ROLES.SUPERADMIN,
      name: "SuperAdmin",
      description: "Administración total del panel, usuarios y configuración.",
      isSystem: true,
      isAdmin: true,
      isDeskAgent: false,
    },
  });
  const agent = await prisma.role.upsert({
    where: { slug: ROLES.AGENT },
    update: { isSystem: true, isDeskAgent: true },
    create: {
      slug: ROLES.AGENT,
      name: "Agente",
      description: "Atiende la mesa de WhatsApp y deriva consultas.",
      isSystem: true,
      isAdmin: false,
      isDeskAgent: true,
    },
  });

  const users = await prisma.user.findMany({
    where: { roleId: null },
    select: { id: true, role: true },
  });
  for (const user of users) {
    const role = user.role === ROLES.SUPERADMIN ? superadmin : agent;
    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: role.id, role: role.slug },
    });
  }

  return { superadmin, agent };
}

export async function findRoleBySlugOrId(value?: string | null) {
  if (!value) return null;
  return prisma.role.findFirst({
    where: { OR: [{ id: value }, { slug: value }] },
  });
}

export async function listDepartments() {
  const { listDepartmentNames } = await import("./desk-roles");
  return listDepartmentNames();
}

export async function applyRoleToUser(userId: string, role: AccessRole | { slug: string; isDeskAgent: boolean; id: string }, department?: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { agentProfile: true },
  });
  if (!existing) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: role.slug, roleId: role.id },
  });

  if (!role.isDeskAgent) return;

  const dept = department?.trim() || existing.agentProfile?.department || "Consultas Generales y Ejercicio Profesional";
  if (existing.agentProfile) {
    if (department?.trim()) {
      await prisma.agentProfile.update({
        where: { userId },
        data: { department: dept },
      });
    }
    return;
  }
  await prisma.agentProfile.create({
    data: {
      userId,
      department: dept,
      workHours: JSON.stringify(defaultWorkHours()),
      assignedKeywords: JSON.stringify([]),
    },
  });
}

export function serializeRole(role: {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isAdmin: boolean;
  isDeskAgent: boolean;
}): AccessRole {
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isAdmin: role.isAdmin,
    isDeskAgent: role.isDeskAgent,
  };
}
