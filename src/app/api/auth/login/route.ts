import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { safeHandler, ApiError } from "@/lib/api/errors";
import { loginSchema } from "@/lib/validation/compensation";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readJsonBody } from "@/lib/api/request";

export const POST = safeHandler(async (request: Request) => {
  const body = await readJsonBody(request);
  const input = loginSchema.parse(body);
  const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const user = rows[0];
  // Same error for unknown email and wrong password — no account enumeration.
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.");
  }
  const token = await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({ data: { id: user.id, name: user.name, email: user.email } });
});
