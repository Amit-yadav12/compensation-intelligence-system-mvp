import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listLocations } from "@/lib/services/reference.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const data = await listLocations(q);
  return NextResponse.json({ data });
});
