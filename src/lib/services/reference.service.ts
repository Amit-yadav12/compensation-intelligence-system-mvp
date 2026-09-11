/**
 * Reference data service — controlled vocabularies (companies, role
 * families, roles, canonical levels, locations) used by filters, forms and
 * the companies index. Counts come from grouped queries (no N+1).
 */
import { desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  compensation,
  roleFamilies,
  roles,
  canonicalLevels,
  locations,
  companyLevels,
} from "@/db/schema";

export async function listRoleFamilies() {
  const counts = await db
    .select({ roleFamilyId: compensation.roleFamilyId, count: sql<number>`count(*)::int` })
    .from(compensation)
    .groupBy(compensation.roleFamilyId);
  const countMap = new Map(counts.map((c) => [c.roleFamilyId, c.count]));
  const rows = await db.select().from(roleFamilies).orderBy(roleFamilies.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    recordCount: countMap.get(r.id) ?? 0,
  }));
}

export async function listRoles(roleFamilyId?: string) {
  const rows = roleFamilyId
    ? await db.select().from(roles).where(eq(roles.roleFamilyId, roleFamilyId)).orderBy(roles.name)
    : await db.select().from(roles).orderBy(roles.name);
  return rows.map((r) => ({
    id: r.id,
    roleFamilyId: r.roleFamilyId,
    name: r.name,
  }));
}

export async function listCanonicalLevels() {
  return db.select().from(canonicalLevels).orderBy(canonicalLevels.rank);
}

export async function listLocations(q?: string) {
  const counts = await db
    .select({ locationId: compensation.locationId, count: sql<number>`count(*)::int` })
    .from(compensation)
    .groupBy(compensation.locationId);
  const countMap = new Map(counts.map((c) => [c.locationId, c.count]));
  const rows = q
    ? await db.select().from(locations).where(ilike(locations.city, `%${q}%`)).orderBy(locations.city)
    : await db.select().from(locations).orderBy(locations.city);
  return rows.map((r) => ({
    id: r.id,
    city: r.city,
    state: r.state,
    country: r.country,
    slug: r.slug,
    currency: r.currency,
    recordCount: countMap.get(r.id) ?? 0,
  }));
}

export async function listCompanies(q?: string, limit = 60) {
  const counts = await db
    .select({ companyId: compensation.companyId, count: sql<number>`count(*)::int` })
    .from(compensation)
    .groupBy(compensation.companyId);
  const countMap = new Map(counts.map((c) => [c.companyId, c.count]));
  const base = db
    .select({
      id: companies.id,
      name: companies.canonicalName,
      slug: companies.slug,
      website: companies.website,
      description: companies.description,
    })
    .from(companies);
  const rows = q
    ? await base.where(ilike(companies.canonicalName, `%${q}%`)).orderBy(companies.canonicalName).limit(limit)
    : await base.orderBy(companies.canonicalName).limit(limit);
  return rows
    .map((r) => ({ ...r, recordCount: countMap.get(r.id) ?? 0 }))
    .sort((a, b) => b.recordCount - a.recordCount);
}

/**
 * Top companies by record count — for the dashboard. A company can have
 * records in two currencies; we report the median for its dominant currency
 * only, so each company appears exactly once and no currency mixing occurs.
 */
export async function topCompanies(limit = 8) {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.canonicalName,
      slug: companies.slug,
      count: sql<number>`count(*)::int`,
      medianTc: sql<number>`percentile_cont(0.5) within group (order by ${compensation.totalCompensation})`,
      currency: compensation.currency,
    })
    .from(compensation)
    .innerJoin(companies, eq(compensation.companyId, companies.id))
    .groupBy(companies.id, companies.canonicalName, companies.slug, compensation.currency)
    .orderBy(desc(sql`count(*)`));

  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; slug: string; count: number; medianTc: number; currency: string; totalCount: number }> = [];
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.id, (totals.get(r.id) ?? 0) + r.count);
  for (const r of rows) {
    if (seen.has(r.id)) continue; // rows are ordered by count desc → first is dominant currency
    seen.add(r.id);
    result.push({ ...r, medianTc: Number(r.medianTc), totalCount: totals.get(r.id) ?? r.count });
  }
  return result.sort((a, b) => b.totalCount - a.totalCount).slice(0, limit);
}

/** Company → canonical level mappings, optionally filtered by company. */
export async function listCompanyLevels(companyId?: string) {
  const base = db
    .select({
      companyId: companyLevels.companyId,
      companyLevelName: companyLevels.companyLevelName,
      canonicalLevelName: canonicalLevels.name,
      rank: canonicalLevels.rank,
    })
    .from(companyLevels)
    .innerJoin(canonicalLevels, eq(companyLevels.canonicalLevelId, canonicalLevels.id));
  const rows = companyId
    ? await base.where(eq(companyLevels.companyId, companyId)).orderBy(canonicalLevels.rank)
    : await base.orderBy(canonicalLevels.rank);
  return rows;
}

/** Global dashboard metrics — every number comes from the database. */
export async function globalMetrics() {
  const [companiesCount, compCount, rolesCount, locationsCount, latest] = await Promise.all([
    db.select({ v: sql<number>`count(*)::int` }).from(companies),
    db.select({ v: sql<number>`count(*)::int` }).from(compensation),
    db.select({ v: sql<number>`count(*)::int` }).from(roles),
    db.select({ v: sql<number>`count(*)::int` }).from(locations),
    db
      .select({ v: sql<Date>`max(${compensation.reportedAt})` })
      .from(compensation),
  ]);
  return {
    companies: companiesCount[0]?.v ?? 0,
    records: compCount[0]?.v ?? 0,
    roles: rolesCount[0]?.v ?? 0,
    locations: locationsCount[0]?.v ?? 0,
    latestReportAt: latest[0]?.v ?? null,
  };
}
