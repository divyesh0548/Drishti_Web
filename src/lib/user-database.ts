import { compare, hash } from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import type { User, UserRole } from "@prisma/client";

import { isSmtpConfigured, sendTempPasswordEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export type StoredWorkspaceUserRole = "SITE_ADMIN" | "COMPANY_ADMIN" | "FINANCE" | "AUDITOR";

export type StoredWorkspaceUserRecord = {
  id: string;
  name: string;
  email: string;
  role: StoredWorkspaceUserRole;
  companyId?: number;
  isActive: boolean;
  tempLogin: boolean;
  createdAt: string;
};

const PASSWORD_SALT_ROUNDS = 10;
const TEMP_PASSWORD_LENGTH = 12;

let bootstrapPromise: Promise<void> | null = null;

function mapUser(user: User): StoredWorkspaceUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId ?? undefined,
    isActive: user.isActive,
    tempLogin: user.tempLogin,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function hashPassword(password: string) {
  return hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash.startsWith("$2")) {
    return false;
  }

  return compare(password, passwordHash);
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let password = "";

  for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
    password += alphabet[bytes[index] % alphabet.length];
  }

  return password;
}

function siteAdminEmail() {
  return process.env.SITE_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
}

function siteAdminName() {
  return process.env.SITE_ADMIN_NAME?.trim() || "Site Admin";
}

async function bootstrapDefaultSiteAdmin() {
  const email = siteAdminEmail();
  if (!email) {
    console.warn("[auth] SITE_ADMIN_EMAIL is not set; skipping default site admin creation.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const tempPassword = generateTempPassword();
  const name = siteAdminName();

  await prisma.user.create({
    data: {
      id: randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(tempPassword),
      role: "SITE_ADMIN",
      companyId: null,
      isActive: true,
      tempLogin: true,
    },
  });

  if (isSmtpConfigured()) {
    await sendTempPasswordEmail({
      to: email,
      name,
      tempPassword,
    });
    console.info(`[auth] Site admin created and temporary password emailed to ${email}.`);
    return;
  }

  console.warn(
    `[auth] Site admin created for ${email}, but SMTP is not configured. Temporary password: ${tempPassword}`,
  );
}

export async function ensureDefaultSiteAdmin() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapDefaultSiteAdmin().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

export async function listWorkspaceUsersByCompany(companyId: number) {
  await ensureDefaultSiteAdmin();
  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  return users.map(mapUser);
}

export async function listWorkspaceSiteUsers() {
  await ensureDefaultSiteAdmin();
  const users = await prisma.user.findMany({
    where: { companyId: null },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  return users.map(mapUser);
}

export async function listAllWorkspaceUsers() {
  await ensureDefaultSiteAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ email: "asc" }],
  });
  return users.map(mapUser);
}

export async function findWorkspaceUserRecordByEmail(email: string) {
  await ensureDefaultSiteAdmin();
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  return user ? mapUser(user) : null;
}

export async function getWorkspaceUserRecordById(userId: string) {
  await ensureDefaultSiteAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user ? mapUser(user) : null;
}

export async function getWorkspaceUserWithSecretByEmail(email: string) {
  await ensureDefaultSiteAdmin();
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export async function createWorkspaceUser(input: {
  id?: string;
  name: string;
  email: string;
  role: StoredWorkspaceUserRole;
  companyId?: number;
  password: string;
  isActive?: boolean;
  tempLogin?: boolean;
}) {
  await ensureDefaultSiteAdmin();
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      id: input.id ?? randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role as UserRole,
      companyId: input.companyId ?? null,
      isActive: input.isActive ?? true,
      tempLogin: input.tempLogin ?? false,
    },
  });

  return mapUser(user);
}

export async function createWorkspaceUserWithEmailedTempPassword(input: {
  id?: string;
  name: string;
  email: string;
  role: StoredWorkspaceUserRole;
  companyId?: number;
  isActive?: boolean;
}) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured. A temporary password cannot be emailed to the company admin.");
  }

  const tempPassword = generateTempPassword();
  const user = await createWorkspaceUser({
    ...input,
    password: tempPassword,
    tempLogin: true,
  });

  try {
    await sendTempPasswordEmail({
      to: user.email,
      name: user.name,
      tempPassword,
    });
  } catch {
    throw new Error("Unable to email the temporary password. Check SMTP settings and try again.");
  }

  return user;
}

export async function updateWorkspaceUserPasswordById(userId: string, password: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      tempLogin: false,
    },
  });

  return mapUser(user);
}

export async function changeWorkspaceUserPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.isActive) {
    return null;
  }

  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) {
    return null;
  }

  return updateWorkspaceUserPasswordById(user.id, input.nextPassword);
}
