import { createHmac, timingSafeEqual } from "node:crypto";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateWorkspaceUser,
  changeAuthenticatedUserPassword,
  getWorkspaceUserById,
  resetWorkspaceUserPassword,
  resolveAuthenticatedWorkspaceContext,
  resolveWorkspaceContext,
  type ActiveWorkspaceContext,
  type CompanyWorkspaceContext,
  type WorkspaceContext,
  type WorkspaceUser,
} from "@/lib/company-workspace";
import { canAccessRoute } from "@/lib/navigation";

export type AuthSession = {
  userId: string;
};

export type AuthSelection = {
  companyId?: string | number;
  versionId?: string;
};

export const authCookieName = "drishti_session";
export const authCookieLifetimeSeconds = 60 * 60 * 12;

const authSecret = process.env.DRISHTI_AUTH_SECRET ?? "drishti-local-demo-secret";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSignature(payload: string) {
  return createHmac("sha256", authSecret).update(payload).digest("base64url");
}

export function createSessionCookieValue(session: AuthSession) {
  const encodedPayload = toBase64Url(JSON.stringify(session));
  const signature = createSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseSessionCookieValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(encodedPayload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as AuthSession;
    return payload?.userId ? payload : null;
  } catch {
    return null;
  }
}

function readCookieValueFromHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${authCookieName}=`))
    ?.slice(authCookieName.length + 1) ?? null;
}

export function getRequestSession(request: Request) {
  return parseSessionCookieValue(readCookieValueFromHeader(request.headers.get("cookie")));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: authCookieLifetimeSeconds,
  };
}

export async function getServerSession() {
  const cookieStore = await cookies();
  return parseSessionCookieValue(cookieStore.get(authCookieName)?.value);
}

export async function getAuthenticatedUser() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  const user = await getWorkspaceUserById(session.userId);
  return user?.isActive ? user : null;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function resolveWorkspaceContextForUser(user: WorkspaceUser, selection?: AuthSelection): Promise<WorkspaceContext> {
  return resolveAuthenticatedWorkspaceContext({
    user,
    companyId: selection?.companyId,
    versionId: selection?.versionId,
  });
}

function isActiveWorkspaceContext(context: WorkspaceContext): context is ActiveWorkspaceContext {
  return Boolean(context.company && context.currentVersion);
}

function isCompanyWorkspaceContext(context: WorkspaceContext): context is CompanyWorkspaceContext {
  return Boolean(context.company);
}

export async function requireWorkspaceContext(selection?: AuthSelection) {
  const user = await requireAuthenticatedUser();
  return resolveWorkspaceContextForUser(user, selection);
}

export async function requireRequestUser(request: Request) {
  const session = getRequestSession(request);

  if (!session) {
    return null;
  }

  const user = await getWorkspaceUserById(session.userId);
  return user?.isActive ? user : null;
}

export async function requireRequestWorkspaceContext(request: Request, selection?: AuthSelection) {
  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return null;
  }

  const context = await resolveWorkspaceContextForUser(user, selection);
  return isActiveWorkspaceContext(context) ? context : null;
}

export async function requireRequestWorkspaceCompany(request: Request, selection?: AuthSelection) {
  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return null;
  }

  const context = await resolveWorkspaceContextForUser(user, selection);
  return isCompanyWorkspaceContext(context) ? context : null;
}

export async function requireRequestWorkspaceState(request: Request, selection?: AuthSelection) {
  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return null;
  }

  return resolveWorkspaceContextForUser(user, selection);
}

export function postAuthenticationPath(user: WorkspaceUser): Route {
  if (user.tempLogin) {
    return "/change-password" as Route;
  }

  if (user.role === "SITE_ADMIN") {
    return "/admin";
  }

  if (!user.companyId) {
    return "/dashboard";
  }

  if (canAccessRoute(user.role, "/import-center")) {
    return `/import-center?company=${user.companyId}` as Route;
  }

  return `/dashboard?company=${user.companyId}` as Route;
}

export async function attemptLogin(email: string, password: string) {
  return authenticateWorkspaceUser(email, password);
}

export async function resetPasswordForWorkspaceUser(email: string, password: string) {
  return resetWorkspaceUserPassword(email, password);
}

export async function changePasswordForAuthenticatedUser(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  return changeAuthenticatedUserPassword(input);
}

export { resolveWorkspaceContext };
