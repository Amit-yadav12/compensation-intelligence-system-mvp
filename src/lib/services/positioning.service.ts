/**
 * Percentile positioning — where does ONE compensation record sit inside its
 * own cohort (same role + canonical level + location, any company)?
 *
 * Methodology (stated in the UI): empirical percentile rank =
 *   (records strictly below + 0.5 × records equal) / n
 * computed over total compensation. Requires n ≥ 5, otherwise we return the
 * cohort size and decline to rank — small cohorts make ranks meaningless.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { compensation } from "@/db/schema";
import { calculatePercentiles, qualityLabel } from "@/lib/analytics/stats";
import { getCompensationById, type ExplorerRow } from "./compensation.service";

export const MIN_COHORT_FOR_RANK = 5;

export type PositioningResponse = {
  record: ExplorerRow;
  cohort: { role: string; canonicalLevel: string; location: string; currency: string };
  sampleSize: number;
  qualityLabel: ReturnType<typeof qualityLabel>;
  percentileRank: number | null; // 0..100
  stats: ReturnType<typeof calculatePercentiles>;
  vsMedianPct: number | null;
  companyCohort: { sampleSize: number; median: number } | null;
};

export function empiricalPercentileRank(values: number[], target: number): number | null {
  if (values.length < MIN_COHORT_FOR_RANK) return null;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < target) below += 1;
    else if (v === target) equal += 1;
  }
  return Math.round(((below + 0.5 * equal) / values.length) * 100);
}

export async function positionRecord(id: string): Promise<PositioningResponse | null> {
  const record = await getCompensationById(id);
  if (!record) return null;

  const rows = await db
    .select({
      companySlug: compensation.companyId,
      total: compensation.totalCompensation,
    })
    .from(compensation)
    .where(
      and(
        eq(compensation.roleId, record.roleId),
        eq(compensation.canonicalLevelId, record.canonicalLevel.id),
        eq(compensation.locationId, record.locationId),
      ),
    );

  const totals = rows.map((r) => r.total);
  const stats = calculatePercentiles(totals);
  const rank = empiricalPercentileRank(totals, record.totalCompensation);
  const companyTotals = rows.filter((r) => r.companySlug === record.companyId).map((r) => r.total);

  return {
    record,
    cohort: {
      role: record.role,
      canonicalLevel: record.canonicalLevel.name,
      location: record.location.city,
      currency: record.currency,
    },
    sampleSize: totals.length,
    qualityLabel: qualityLabel(totals.length),
    percentileRank: rank,
    stats,
    vsMedianPct:
      stats.median > 0 ? (record.totalCompensation - stats.median) / stats.median : null,
    companyCohort:
      companyTotals.length > 0
        ? { sampleSize: companyTotals.length, median: calculatePercentiles(companyTotals).median }
        : null,
  };
}
