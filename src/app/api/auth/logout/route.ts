import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { safeHandler } from "@/lib/api/errors";
import { SESSION_COOKIE, destroySession, clearSessionCookie } from "@/lib/auth/session";

export const POST = safeHandler(async (_request: NextRequest) => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  return NextResponse.json({ data: { ok: true } });
});
