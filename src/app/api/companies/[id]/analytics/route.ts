import { NextResponse } from "next/server";
import { safeHandler, errorResponse } from "@/lib/api/errors";
import { getCompanyAnalytics } from "@/lib/services/analytics.service";

export const GET = safeHandler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const analytics = await getCompanyAnalytics(id);
    if (!analytics) return errorResponse("COMPANY_NOT_FOUND");
    return NextResponse.json({ data: analytics });
  },
);
