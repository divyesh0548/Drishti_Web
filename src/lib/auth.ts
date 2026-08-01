import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateWorkspaceUser,
  getWorkspaceUserById,
  resetWorkspaceUserPassword,
  resolveWorkspaceContext,
  type WorkspaceContext,
  type WorkspaceUser,
} from "@/lib/company-workspace";

export type AuthSession = {
  userId: string;
};

export type AuthSelection = {
  companyId?: string;
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

  const user = getWorkspaceUserById(session.userId);
  return user?.isActive ? user : null;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function resolveWorkspaceContextForUser(user: WorkspaceUser, selection?: AuthSelection): WorkspaceContext {
  const companyId = user.role === "SITE_ADMIN" ? selection?.companyId : user.companyId;

  return resolveWorkspaceContext({
    companyId,
    userId: user.id,
    versionId: selection?.versionId,
  });
}

export async function requireWorkspaceContext(selection?: AuthSelection) {
  const user = await requireAuthenticatedUser();
  return resolveWorkspaceContextForUser(user, selection);
}

export function requireRequestUser(request: Request) {
  const session = getRequestSession(request);

  if (!session) {
    return null;
  }

  const user = getWorkspaceUserById(session.userId);
  return user?.isActive ? user : null;
}

export function requireRequestWorkspaceContext(request: Request, selection?: AuthSelection) {
  const user = requireRequestUser(request);

  if (!user) {
    return null;
  }

  return resolveWorkspaceContextForUser(user, selection);
}

export function attemptLogin(email: string, password: string) {
  return authenticateWorkspaceUser(email, password);
}

export function resetPasswordForWorkspaceUser(email: string, password: string) {
  return resetWorkspaceUserPassword(email, password);
}
