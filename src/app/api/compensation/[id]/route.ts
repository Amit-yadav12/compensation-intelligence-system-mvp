import { NextResponse } from "next/server";
import { safeHandler, errorResponse } from "@/lib/api/errors";
import { getCompensationById } from "@/lib/services/compensation.service";

export const GET = safeHandler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const row = await getCompensationById(id);
    if (!row) return errorResponse("NOT_FOUND", "Compensation record not found.");
    return NextResponse.json({ data: row });
  },
);
