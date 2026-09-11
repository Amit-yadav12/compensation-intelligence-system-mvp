import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { safeHandler, errorResponse } from "@/lib/api/errors";
import { db } from "@/db";
import { companies, compensation } from "@/db/schema";
import { sql } from "drizzle-orm";

export const GET = safeHandler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const rows = await db
      .select({
        id: companies.id,
        name: companies.canonicalName,
        slug: companies.slug,
        website: companies.website,
        description: companies.description,
        recordCount: sql<number>`(
          select count(*)::int from ${compensation} where ${compensation.companyId} = ${companies.id}
        )`,
      })
      .from(companies)
      .where(or(eq(companies.slug, id.toLowerCase()), eq(companies.id, id)))
      .limit(1);
    const company = rows[0];
    if (!company) return errorResponse("COMPANY_NOT_FOUND");
    return NextResponse.json({ data: company });
  },
);
