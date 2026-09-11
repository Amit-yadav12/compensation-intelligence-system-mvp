import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listRoles } from "@/lib/services/reference.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const family = request.nextUrl.searchParams.get("roleFamily") ?? undefined;
  const data = await listRoles(family);
  return NextResponse.json({ data });
});
