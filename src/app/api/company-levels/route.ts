import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listCompanyLevels } from "@/lib/services/reference.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const company = request.nextUrl.searchParams.get("company") ?? undefined;
  const data = await listCompanyLevels(company);
  return NextResponse.json({ data });
});
