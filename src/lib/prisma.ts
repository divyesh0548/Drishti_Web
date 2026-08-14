import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPgPool(connectionString: string) {
  const sslRequested = /[?&]sslmode=(?!disable\b)[^&]*/i.test(connectionString) || /[?&]ssl=true\b/i.test(connectionString);
  const sanitized = connectionString
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/([?&])ssl=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?")
    .replace(/&&+/g, "&");

  return new Pool({
    connectionString: sanitized,
    ssl: sslRequested ? { rejectUnauthorized: false } : undefined,
  });
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  return new PrismaClient({
    adapter: new PrismaPg(createPgPool(connectionString)),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
