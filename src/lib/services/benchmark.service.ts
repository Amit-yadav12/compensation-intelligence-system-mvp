/**
 * Benchmark service — cohort-level market statistics.
 *
 * A cohort is fully specified: role family + role + canonical level +
 * location (+ optional experience band). Percentiles are computed in ONE
 * place (stats.ts) so every surface reports the same numbers.
 *
 * Location differentials are computed only for the same role + level within
 * the same currency — never across fundamentally different cohorts.
 */
import { and, eq, gte, lte, ne, inArray, SQL } from "drizzle-orm";
import { db } from "@/db";
import { compensation, locations, companies } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { resolveLocation } from "@/lib/normalization/location";
import {
  calculatePercentiles,
  aggregateCompensationMix,
  qualityLabel,
  calculateLocationDifferential,
} from "@/lib/analytics/stats";
import { buildBenchmarkInsights } from "@/lib/analytics/insights";
import type { CohortQuery } from "@/lib/validation/query";
import { resolveCohort, type ResolvedCohort } from "./cohort.service";

export type BenchmarkResponse = {
  cohort: {
    roleFamily: string;
    role: string;
    canonicalLevel: string;
    location: string;
    currency: string;
    experienceBand: { min: number | null; max: number | null };
  };
  sampleSize: number;
  stats: ReturnType<typeof calculatePercentiles>;
  mix: ReturnType<typeof aggregateCompensationMix>;
  qualityLabel: ReturnType<typeof qualityLabel>;
  companies: Array<{ name: string; slug: string; count: number; median: number }>;
  locationDifferentials: Array<{
    city: string;
    slug: string;
    n: number;
    median: number;
    relativePct: number;
    direction: string;
  }>;
  insights: ReturnType<typeof buildBenchmarkInsights>;
  generatedAt: string;
};

export async function benchmarkCohort(query: CohortQuery): Promise<BenchmarkResponse> {
  const cohort = await resolveCohort(query);

  const where: SQL[] = [
    eq(compensation.roleId, cohort.role.id),
    eq(compensation.canonicalLevelId, cohort.level.id),
    eq(compensation.locationId, cohort.location.id),
  ];
  if (query.minExperience != null) where.push(gte(compensation.yearsExperience, query.minExperience));
  if (query.maxExperience != null) where.push(lte(compensation.yearsExperience, query.maxExperience));

  const records = await db
    .select({
      companyId: compensation.companyId,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      total: compensation.totalCompensation,
    })
    .from(compensation)
    .where(and(...where));

  const stats = calculatePercentiles(records.map((r) => r.total));
  const mix = aggregateCompensationMix(records);
  const quality = qualityLabel(stats.count);

  // Per-company leaderboard (companies with >= 3 records keep the table honest).
  const byCompany = new Map<string, { count: number; totals: number[] }>();
  for (const r of records) {
    const entry = byCompany.get(r.companyId) ?? { count: 0, totals: [] };
    entry.count += 1;
    entry.totals.push(r.total);
    byCompany.set(r.companyId, entry);
  }
  const companyRows = await db
    .select({ id: companies.id, name: companies.canonicalName, slug: companies.slug })
    .from(companies)
    .where(inArray(companies.id, [...byCompany.keys()]));
  const companyById = new Map(companyRows.map((c) => [c.id, c]));
  const leaderboard = [...byCompany.entries()]
    .map(([id, v]) => {
      const meta = companyById.get(id);
      return {
        name: meta?.name ?? id,
        slug: meta?.slug ?? "",
        count: v.count,
        median: calculatePercentiles(v.totals).median,
      };
    })
    .sort((a, b) => b.median - a.median);

  // Location differentials: same role + level + currency, other locations.
  const otherRows = await db
    .select({
      locationId: compensation.locationId,
      city: locations.city,
      slug: locations.slug,
      total: compensation.totalCompensation,
    })
    .from(compensation)
    .innerJoin(locations, eq(compensation.locationId, locations.id))
    .where(
      and(
        eq(compensation.roleId, cohort.role.id),
        eq(compensation.canonicalLevelId, cohort.level.id),
        eq(locations.currency, cohort.location.currency),
        ne(compensation.locationId, cohort.location.id),
      ),
    );
  const byLocation = new Map<string, { city: string; slug: string; totals: number[] }>();
  for (const r of otherRows) {
    const entry = byLocation.get(r.locationId) ?? { city: r.city, slug: r.slug, totals: [] };
    entry.totals.push(r.total);
    byLocation.set(r.locationId, entry);
  }
  const locationDifferentials = [...byLocation.entries()]
    .map(([, v]) => {
      const median = calculatePercentiles(v.totals).median;
      const diff = calculateLocationDifferential(stats.median, median);
      return {
        city: v.city,
        slug: v.slug,
        n: v.totals.length,
        median,
        relativePct: Math.round(diff.relativePct * 1000) / 1000,
        direction: diff.direction,
      };
    })
    .filter((d) => d.n >= 3)
    .sort((a, b) => Math.abs(b.relativePct) - Math.abs(a.relativePct));

  const cohortLabel = `${cohort.role.name} · ${cohort.level.name} · ${cohort.location.city}`;
  const insights = buildBenchmarkInsights({
    cohortLabel,
    stats,
    mix,
    quality,
    companyCount: leaderboard.length,
    locationDifferentials,
  });

  return {
    cohort: {
      roleFamily: cohort.family.name,
      role: cohort.role.name,
      canonicalLevel: cohort.level.name,
      location: cohort.location.city,
      currency: cohort.location.currency,
      experienceBand: { min: query.minExperience ?? null, max: query.maxExperience ?? null },
    },
    sampleSize: stats.count,
    stats,
    mix,
    qualityLabel: quality,
    companies: leaderboard,
    locationDifferentials,
    insights,
    generatedAt: new Date().toISOString(),
  };
}

export type { ResolvedCohort };
