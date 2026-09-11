import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { compareQuerySchema } from "@/lib/validation/query";
import { compareCompanies } from "@/lib/services/comparison.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const query = compareQuerySchema.parse({
    roleFamily: params.get("roleFamily") ?? undefined,
    role: params.get("role") ?? undefined,
    canonicalLevel: params.get("canonicalLevel") ?? undefined,
    location: params.get("location") ?? undefined,
    minExperience: params.get("minExperience") ?? undefined,
    maxExperience: params.get("maxExperience") ?? undefined,
    company: params.getAll("company"),
  });
  const result = await compareCompanies(query);
  return NextResponse.json({ data: result });
});
