import { NextResponse } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";

export const GET = safeHandler(async () => {
  const user = await getSessionUser();
  return NextResponse.json({ data: { user } });
});
