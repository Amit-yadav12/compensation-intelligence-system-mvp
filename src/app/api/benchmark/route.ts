import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { cohortSchema } from "@/lib/validation/query";
import { benchmarkCohort } from "@/lib/services/benchmark.service";

export const GET = safeHandler(async (request: NextRequest) => {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = cohortSchema.parse(raw);
  const result = await benchmarkCohort(query);
  return NextResponse.json({ data: result });
});
