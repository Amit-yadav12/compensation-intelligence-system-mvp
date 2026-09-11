/**
 * Comparison service — cohort-scoped comparison of 2–3 companies.
 *
 * A comparison is only meaningful within a shared cohort (same role family,
 * role, canonical level, location, optional experience band). Each company
 * gets its own percentile profile + mix; insights are derived from the
 * comparison of those profiles — never from general knowledge.
 */
import { and, eq, inArray, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { compensation, companies } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import {
  calculatePercentiles,
  aggregateCompensationMix,
  qualityLabel,
} from "@/lib/analytics/stats";
import { buildComparisonInsights, type Insight } from "@/lib/analytics/insights";
import type { CompareQuery } from "@/lib/validation/query";
import { resolveCohort } from "./cohort.service";

export type CompanyComparison = {
  slug: string;
  name: string;
  sampleSize: number;
  stats: ReturnType<typeof calculatePercentiles>;
  mix: ReturnType<typeof aggregateCompensationMix>;
  components: {
    medianBase: number;
    medianStock: number;
    medianBonus: number;
  };
  qualityLabel: ReturnType<typeof qualityLabel>;
};

export type CompareResponse = {
  cohort: {
    roleFamily: string;
    role: string;
    canonicalLevel: string;
    levelApproximationNote: string | null;
    location: string;
    currency: string;
    experienceBand: { min: number | null; max: number | null };
  };
  market: { median: number; count: number };
  companies: CompanyComparison[];
  insights: Insight[];
  generatedAt: string;
};

async function resolveCompanyRef(ref: string) {
  const bySlug = await db
    .select({ id: companies.id, name: companies.canonicalName, slug: companies.slug })
    .from(companies)
    .where(eq(companies.slug, ref.toLowerCase()))
    .limit(1);
  if (bySlug[0]) return bySlug[0];
  const byName = await db
    .select({ id: companies.id, name: companies.canonicalName, slug: companies.slug })
    .from(companies)
    .where(eq(companies.canonicalName, ref))
    .limit(1);
  if (byName[0]) return byName[0];
  throw new ApiError("COMPANY_NOT_FOUND", `Unknown company "${ref}".`);
}

export async function compareCompanies(query: CompareQuery): Promise<CompareResponse> {
  const cohort = await resolveCohort(query);

  const companyRefs = await Promise.all(query.company.map(resolveCompanyRef));
  const ids = [...new Set(companyRefs.map((c) => c.id))];
  if (ids.length < 1) throw new ApiError("VALIDATION_ERROR", "At least one company is required.");

  const conditions = [
    eq(compensation.roleId, cohort.role.id),
    eq(compensation.canonicalLevelId, cohort.level.id),
    eq(compensation.locationId, cohort.location.id),
    inArray(compensation.companyId, ids),
  ];
  if (query.minExperience != null) conditions.push(gte(compensation.yearsExperience, query.minExperience));
  if (query.maxExperience != null) conditions.push(lte(compensation.yearsExperience, query.maxExperience));

  const records = await db
    .select({
      companyId: compensation.companyId,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      total: compensation.totalCompensation,
    })
    .from(compensation)
    .where(and(...conditions));

  // Market context: ALL companies in the same cohort (not just the selected ones).
  const marketConditions = [
    eq(compensation.roleId, cohort.role.id),
    eq(compensation.canonicalLevelId, cohort.level.id),
    eq(compensation.locationId, cohort.location.id),
  ];
  if (query.minExperience != null) marketConditions.push(gte(compensation.yearsExperience, query.minExperience));
  if (query.maxExperience != null) marketConditions.push(lte(compensation.yearsExperience, query.maxExperience));
  const marketRows = await db
    .select({ total: compensation.totalCompensation })
    .from(compensation)
    .where(and(...marketConditions));
  const market = {
    median: calculatePercentiles(marketRows.map((r) => r.total)).median,
    count: marketRows.length,
  };

  const perCompany = new Map<
    string,
    { totals: number[]; bases: number[]; bonuses: number[]; stocks: number[]; base: number; bonus: number; stock: number }
  >();
  for (const r of records) {
    const entry = perCompany.get(r.companyId) ?? {
      totals: [],
      bases: [],
      bonuses: [],
      stocks: [],
      base: 0,
      bonus: 0,
      stock: 0,
    };
    entry.totals.push(r.total);
    entry.bases.push(r.baseSalary);
    entry.bonuses.push(r.annualBonus);
    entry.stocks.push(r.annualStock);
    entry.base += r.baseSalary;
    entry.bonus += r.annualBonus;
    entry.stock += r.annualStock;
    perCompany.set(r.companyId, entry);
  }

  const companiesResult: CompanyComparison[] = companyRefs.map((c) => {
    const v = perCompany.get(c.id) ?? {
      totals: [],
      bases: [],
      bonuses: [],
      stocks: [],
      base: 0,
      bonus: 0,
      stock: 0,
    };
    const stats = calculatePercentiles(v.totals);
    const mix = aggregateCompensationMix([
      { baseSalary: v.base, annualBonus: v.bonus, annualStock: v.stock },
    ]);
    return {
      slug: c.slug,
      name: c.name,
      sampleSize: stats.count,
      stats,
      mix,
      components: {
        medianBase: calculatePercentiles(v.bases).median,
        medianStock: calculatePercentiles(v.stocks).median,
        medianBonus: calculatePercentiles(v.bonuses).median,
      },
      qualityLabel: qualityLabel(stats.count),
    };
  });

  const cohortLabel = `${cohort.role.name} · ${cohort.level.name} · ${cohort.location.city}`;
  const insights = buildComparisonInsights({
    cohortLabel,
    entries: companiesResult,
    marketMedian: market.median,
    marketCount: market.count,
  });

  return {
    cohort: {
      roleFamily: cohort.family.name,
      role: cohort.role.name,
      canonicalLevel: cohort.level.name,
      levelApproximationNote:
        "Canonical levels are an approximation. Different companies' internal levels are not literally identical.",
      location: cohort.location.city,
      currency: cohort.location.currency,
      experienceBand: { min: query.minExperience ?? null, max: query.maxExperience ?? null },
    },
    market,
    companies: companiesResult,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
