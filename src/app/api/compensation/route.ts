import { NextResponse, type NextRequest } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { compensationQuerySchema } from "@/lib/validation/query";
import {
  queryCompensation,
  createCompensation,
} from "@/lib/services/compensation.service";
import { compensationSubmissionSchema } from "@/lib/validation/compensation";
import { requireUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/api/request";

export const GET = safeHandler(async (request: NextRequest) => {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = compensationQuerySchema.parse(raw);
  const result = await queryCompensation(query);
  return NextResponse.json(result);
});

export const POST = safeHandler(async (request: NextRequest) => {
  const user = await requireUser();
  const body = await readJsonBody(request);
  const input = compensationSubmissionSchema.parse(body);
  const created = await createCompensation(input, user);
  return NextResponse.json({ data: created }, { status: 201 });
});
