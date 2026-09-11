/**
 * Company analytics service — everything the company intelligence page
 * needs, computed from aggregates (never "fetch every record and compute in
 * the client"). We select only the numeric columns required and group in
 * memory; a typical company has < 100 rows so this stays cheap, and the
 * same queries serve any company without N+1.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  compensation,
  companies,
  canonicalLevels,
  companyLevels,
  locations,
  roleFamilies,
} from "@/db/schema";
import {
  calculatePercentiles,
  aggregateCompensationMix,
  qualityLabel,
  relativeDifference,
} from "@/lib/analytics/stats";
import { buildCompanyInsights, type Insight } from "@/lib/analytics/insights";

export type CompanyAnalytics = {
  company: {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    description: string | null;
  };
  recordCount: number;
  latestReport: string | null;
  snapshotByCurrency: Array<{
    currency: string;
    count: number;
    medianTC: number;
    medianBase: number;
    medianStock: number;
    medianBonus: number;
    p25: number;
    p75: number;
  }>;
  primaryCurrency: string | null;
  byLevel: Array<{
    canonicalLevelId: string;
    levelName: string;
    rank: number;
    count: number;
    min: number;
    p25: number;
    median: number;
    p75: number;
    p90: number;
    max: number;
  }>;
  mix: { baseRatio: number; stockRatio: number; bonusRatio: number };
  byLocation: Array<{
    locationId: string;
    city: string;
    country: string;
    slug: string;
    currency: string;
    count: number;
    median: number;
  }>;
  byRoleFamily: Array<{ roleFamilyId: string; name: string; count: number; median: number }>;
  levelMapping: Array<{
    companyLevelName: string;
    canonicalLevelName: string;
    rank: number;
  }>;
  /**
   * Company median vs market median, per canonical level, within the
   * company's primary currency. Market = all companies at that level in that
   * currency. Levels where either side has < 3 records are omitted.
   */
  vsMarket: Array<{
    canonicalLevelId: string;
    levelName: string;
    rank: number;
    companyMedian: number;
    companyCount: number;
    marketMedian: number;
    marketCount: number;
    relativePct: number;
  }>;
  freshness: { latest: Date | null; last90d: number };
  quality: "low" | "moderate" | "strong";
  insights: Insight[];
};

export async function getCompanyAnalytics(slug: string): Promise<CompanyAnalytics | null> {
  const companyRows = await db
    .select({
      id: companies.id,
      name: companies.canonicalName,
      slug: companies.slug,
      website: companies.website,
      description: companies.description,
    })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  const company = companyRows[0];
  if (!company) return null;

  const rows = await db
    .select({
      canonicalLevelId: compensation.canonicalLevelId,
      rank: canonicalLevels.rank,
      levelName: canonicalLevels.name,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      total: compensation.totalCompensation,
      currency: compensation.currency,
      locationId: compensation.locationId,
      city: locations.city,
      country: locations.country,
      locationSlug: locations.slug,
      roleFamilyId: compensation.roleFamilyId,
      roleFamilyName: roleFamilies.name,
      reportedAt: compensation.reportedAt,
    })
    .from(compensation)
    .innerJoin(canonicalLevels, eq(compensation.canonicalLevelId, canonicalLevels.id))
    .innerJoin(locations, eq(compensation.locationId, locations.id))
    .innerJoin(roleFamilies, eq(compensation.roleFamilyId, roleFamilies.id))
    .where(eq(compensation.companyId, company.id))
    .orderBy(desc(compensation.reportedAt));

  const recordCount = rows.length;
  const latest = rows[0]?.reportedAt ?? null;

  // Snapshot per currency (companies span INR + USD records; never mix them).
  const byCurrency = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byCurrency.get(r.currency) ?? [];
    list.push(r);
    byCurrency.set(r.currency, list);
  }
  const snapshotByCurrency = [...byCurrency.entries()].map(([currency, list]) => {
    const tc = calculatePercentiles(list.map((r) => r.total));
    return {
      currency,
      count: list.length,
      medianTC: tc.median,
      medianBase: calculatePercentiles(list.map((r) => r.baseSalary)).median,
      medianStock: calculatePercentiles(list.map((r) => r.annualStock)).median,
      medianBonus: calculatePercentiles(list.map((r) => r.annualBonus)).median,
      p25: tc.p25,
      p75: tc.p75,
    };
  });
  snapshotByCurrency.sort((a, b) => b.count - a.count);
  const primaryCurrency = snapshotByCurrency[0]?.currency ?? null;

  // By canonical level
  const byLevelMap = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byLevelMap.get(r.canonicalLevelId) ?? [];
    list.push(r);
    byLevelMap.set(r.canonicalLevelId, list);
  }
  const byLevel = [...byLevelMap.entries()]
    .map(([levelId, list]) => {
      const p = calculatePercentiles(list.map((r) => r.total));
      return {
        canonicalLevelId: levelId,
        levelName: list[0].levelName,
        rank: list[0].rank,
        count: p.count,
        min: p.min,
        p25: p.p25,
        median: p.median,
        p75: p.p75,
        p90: p.p90,
        max: p.max,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const mix = aggregateCompensationMix(
    rows.map((r) => ({
      baseSalary: r.baseSalary,
      annualBonus: r.annualBonus,
      annualStock: r.annualStock,
    })),
  );

  // By location
  const byLocationMap = new Map<string, { city: string; country: string; slug: string; currency: string; totals: number[] }>();
  for (const r of rows) {
    const entry = byLocationMap.get(r.locationId) ?? {
      city: r.city,
      country: r.country,
      slug: r.locationSlug,
      currency: r.currency,
      totals: [],
    };
    entry.totals.push(r.total);
    byLocationMap.set(r.locationId, entry);
  }
  const byLocation = [...byLocationMap.entries()]
    .map(([locationId, v]) => ({
      locationId,
      city: v.city,
      country: v.country,
      slug: v.slug,
      currency: v.currency,
      count: v.totals.length,
      median: calculatePercentiles(v.totals).median,
    }))
    .sort((a, b) => b.count - a.count);

  // By role family
  const byFamilyMap = new Map<string, { name: string; totals: number[] }>();
  for (const r of rows) {
    const entry = byFamilyMap.get(r.roleFamilyId) ?? { name: r.roleFamilyName, totals: [] };
    entry.totals.push(r.total);
    byFamilyMap.set(r.roleFamilyId, entry);
  }
  const byRoleFamily = [...byFamilyMap.entries()]
    .map(([roleFamilyId, v]) => ({
      roleFamilyId,
      name: v.name,
      count: v.totals.length,
      median: calculatePercentiles(v.totals).median,
    }))
    .sort((a, b) => b.count - a.count);

  // Company → canonical level mapping (the approximation table we expose).
  const mappingRows = await db
    .select({
      companyLevelName: companyLevels.companyLevelName,
      canonicalLevelName: canonicalLevels.name,
      rank: canonicalLevels.rank,
    })
    .from(companyLevels)
    .innerJoin(canonicalLevels, eq(companyLevels.canonicalLevelId, canonicalLevels.id))
    .where(eq(companyLevels.companyId, company.id))
    .orderBy(canonicalLevels.rank);

  const cutoff = Date.now() - 90 * 86_400_000;
  const freshness = {
    latest,
    last90d: rows.filter((r) => r.reportedAt.getTime() >= cutoff).length,
  };

  // Company vs market, per level, in the primary currency. One grouped query
  // (percentile_cont in SQL) — no per-level round trips.
  const vsMarket: CompanyAnalytics["vsMarket"] = [];
  if (primaryCurrency) {
    const marketRows = await db
      .select({
        canonicalLevelId: compensation.canonicalLevelId,
        count: sql<number>`count(*)::int`,
        median: sql<number>`percentile_cont(0.5) within group (order by ${compensation.totalCompensation})`,
      })
      .from(compensation)
      .where(eq(compensation.currency, primaryCurrency))
      .groupBy(compensation.canonicalLevelId);
    const marketByLevel = new Map(marketRows.map((m) => [m.canonicalLevelId, m]));
    const primaryRows = rows.filter((r) => r.currency === primaryCurrency);
    const companyByLevel = new Map<string, { levelName: string; rank: number; totals: number[] }>();
    for (const r of primaryRows) {
      const e = companyByLevel.get(r.canonicalLevelId) ?? { levelName: r.levelName, rank: r.rank, totals: [] };
      e.totals.push(r.total);
      companyByLevel.set(r.canonicalLevelId, e);
    }
    for (const [levelId, c] of companyByLevel) {
      const m = marketByLevel.get(levelId);
      if (!m || c.totals.length < 3 || m.count < 3) continue;
      const companyMedian = calculatePercentiles(c.totals).median;
      const marketMedian = Math.round(Number(m.median));
      vsMarket.push({
        canonicalLevelId: levelId,
        levelName: c.levelName,
        rank: c.rank,
        companyMedian,
        companyCount: c.totals.length,
        marketMedian,
        marketCount: m.count,
        relativePct: relativeDifference(companyMedian, marketMedian),
      });
    }
    vsMarket.sort((a, b) => a.rank - b.rank);
  }

  const overall = calculatePercentiles(rows.map((r) => r.total));
  const quality = qualityLabel(recordCount);
  const insights = buildCompanyInsights({
    companyName: company.name,
    overall,
    mix,
    quality,
    levelMedians: byLevel.map((l) => ({
      levelName: l.levelName,
      rank: l.rank,
      median: l.median,
      count: l.count,
    })),
    freshness,
    vsMarket,
  });

  return {
    company,
    recordCount,
    latestReport: latest ? latest.toISOString() : null,
    snapshotByCurrency,
    primaryCurrency,
    byLevel,
    mix,
    byLocation,
    byRoleFamily,
    levelMapping: mappingRows,
    vsMarket,
    freshness,
    quality,
    insights,
  };
}
