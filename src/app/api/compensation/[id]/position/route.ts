import { NextResponse } from "next/server";
import { safeHandler, errorResponse } from "@/lib/api/errors";
import { positionRecord } from "@/lib/services/positioning.service";

/** Percentile positioning of one record inside its role × level × location cohort. */
export const GET = safeHandler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const result = await positionRecord(id);
    if (!result) return errorResponse("NOT_FOUND", "Compensation record not found.");
    return NextResponse.json({ data: result });
  },
);
