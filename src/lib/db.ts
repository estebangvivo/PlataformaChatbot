import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isStaleClient(client: PrismaClient | undefined) {
  return !client || typeof (client as { deskEvent?: unknown }).deskEvent === "undefined";
}

export const prisma = isStaleClient(globalForPrisma.prisma)
  ? createPrisma()
  : (globalForPrisma.prisma as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
