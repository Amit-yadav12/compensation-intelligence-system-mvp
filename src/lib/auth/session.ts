/**
 * Credential authentication with database-backed sessions.
 *
 * Security model:
 *  - passwords: scrypt (64-byte output, 16-byte random salt) — never stored
 *    in plaintext, never logged
 *  - sessions: 32-byte random token in an httpOnly, SameSite=Lax cookie;
 *    server-side row with expiry; rotation not needed for MVP, expiry is enforced
 *  - CSRF: SameSite=Lax blocks cross-site POSTs; all mutations are POST
 *  - the session cookie is the only auth material; there are no secrets in
 *    client bundles (no NEXT_PUBLIC_ auth vars)
 */
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";

export const SESSION_COOKIE = "compscope_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ------------------------------ password ------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, "hex");
  return storedBuf.length === candidate.length && timingSafeEqual(storedBuf, candidate);
}

/* ------------------------------ sessions ------------------------------ */

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    id: randomBytes(12).toString("hex"),
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/** Read the current user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}

/** For protected routes — throws UNAUTHORIZED instead of returning null. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("UNAUTHORIZED");
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ------------------------------ users --------------------------------- */

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SessionUser> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing[0]) {
    throw new ApiError("VALIDATION_ERROR", "An account with this email already exists.");
  }
  const id = randomBytes(12).toString("hex");
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email,
    passwordHash: hashPassword(input.password),
  });
  return { id, name: input.name, email: input.email };
}
