import { NextResponse } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { signupSchema } from "@/lib/validation/compensation";
import { createUser, createSession, setSessionCookie } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/api/request";

export const POST = safeHandler(async (request: Request) => {
  const body = await readJsonBody(request);
  const input = signupSchema.parse(body);
  const user = await createUser(input);
  const token = await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json(
    { data: { id: user.id, name: user.name, email: user.email } },
    { status: 201 },
  );
});
