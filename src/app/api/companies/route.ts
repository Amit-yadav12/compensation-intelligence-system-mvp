import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listCompanies } from "@/lib/services/reference.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const companies = await listCompanies(q);
  return NextResponse.json({ data: companies });
});
