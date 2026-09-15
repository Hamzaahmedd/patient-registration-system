import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Single shared Prisma client for the whole monolith - both the REST module
// and the voice-agent module import this, never instantiate their own.
export const prisma = new PrismaClient({
  log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
});

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
