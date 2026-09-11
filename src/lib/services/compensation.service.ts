/**
 * Compensation service — the single place where compensation records are
 * created and queried. Route handlers stay thin.
 *
 * Creation pipeline (mirrors the product thesis data flow):
 *   raw input → Zod validation (route layer) → entity resolution
 *   → invariant enforcement (TC, non-negative, defaults)
 *   → dedupe key → PostgreSQL (unique constraint backstops races)
 */
import { randomBytes } from "crypto";
import { and, eq, gte, lte, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  compensation,
  companies,
  roles,
  roleFamilies,
  canonicalLevels,
  companyLevels,
  locations,
  companyAliases,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { resolveCompany } from "@/lib/normalization/company";
import { resolveLocation } from "@/lib/normalization/location";
import { resolveCompanyLevel } from "@/lib/normalization/level";
import { generateDedupeKey, reportedMonth } from "@/lib/utils/dedupe";
import { calculateTotalCompensation } from "@/lib/domain/compensation";
import type { CompensationSubmissionInput } from "@/lib/validation/compensation";
import type { CompensationQuery } from "@/lib/validation/query";
import type { SessionUser } from "@/lib/auth/session";

const SORT_COLUMNS = {
  tc_desc: { col: compensation.totalCompensation, dir: sql`desc nulls last` },
  tc_asc: { col: compensation.totalCompensation, dir: sql`asc nulls last` },
  base_desc: { col: compensation.baseSalary, dir: sql`desc nulls last` },
  stock_desc: { col: compensation.annualStock, dir: sql`desc nulls last` },
  bonus_desc: { col: compensation.annualBonus, dir: sql`desc nulls last` },
  newest: { col: compensation.reportedAt, dir: sql`desc nulls last` },
} as const;

export type ExplorerRow = {
  id: string;
  companyId: string;
  roleId: string;
  locationId: string;
  company: { name: string; slug: string };
  role: string;
  roleFamily: string;
  canonicalLevel: { id: string; name: string };
  companyLevel: string | null;
  location: { city: string; country: string; slug: string };
  baseSalary: number;
  annualBonus: number;
  annualStock: number;
  totalCompensation: number;
  currency: string;
  yearsExperience: number;
  reportedAt: string;
  sourceType: string;
  verificationStatus: string;
};

/* --------------------------- entity helpers --------------------------- */

async function resolveRoleFamily(ref: string) {
  const row =
    (await db.select().from(roleFamilies).where(eq(roleFamilies.id, ref)).limit(1))[0] ??
    (await db.select().from(roleFamilies).where(eq(roleFamilies.slug, ref)).limit(1))[0];
  if (!row) throw new ApiError("ROLE_NOT_FOUND", `Unknown role family "${ref}".`);
  return row;
}

async function resolveRole(ref: string, familyId: string) {
  const byId = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, ref), eq(roles.roleFamilyId, familyId)))
    .limit(1);
  if (byId[0]) return byId[0];
  const byName = await db
    .select()
    .from(roles)
    .where(and(eq(roles.roleFamilyId, familyId), eq(roles.normalizedName, ref.trim().toLowerCase())))
    .limit(1);
  if (!byName[0]) throw new ApiError("ROLE_NOT_FOUND", `Unknown role "${ref}" for this role family.`);
  return byName[0];
}

async function resolveCanonicalLevel(ref: string) {
  const row =
    (await db.select().from(canonicalLevels).where(eq(canonicalLevels.id, ref)).limit(1))[0] ??
    (
      await db
        .select()
        .from(canonicalLevels)
        .where(eq(canonicalLevels.name, ref))
        .limit(1)
    )[0];
  if (!row) throw new ApiError("LEVEL_NOT_FOUND", `Unknown canonical level "${ref}".`);
  return row;
}

async function resolveCompanyRef(ref: string) {
  const bySlug = await db
    .select({ id: companies.id, canonicalName: companies.canonicalName, slug: companies.slug })
    .from(companies)
    .where(eq(companies.slug, ref.toLowerCase()))
    .limit(1);
  if (bySlug[0]) return bySlug[0];
  const resolved = await resolveCompany(ref);
  if (!resolved) throw new ApiError("COMPANY_NOT_FOUND", `Unknown company "${ref}".`);
  return resolved;
}

/* ------------------------------ creation ------------------------------ */

export async function createCompensation(
  input: CompensationSubmissionInput,
  user: SessionUser,
) {
  // 1. Resolve every free-text reference to a canonical entity.
  const company = await resolveCompany(input.company);
  if (!company) {
    throw new ApiError("COMPANY_NOT_FOUND", `Unknown company "${input.company}". Try a supported company name.`);
  }
  const family = await resolveRoleFamily(input.roleFamily);
  const role = await resolveRole(input.role, family.id);
  const location = await resolveLocation(input.location);
  if (!location) {
    throw new ApiError("LOCATION_NOT_FOUND", `Unknown location "${input.location}".`);
  }
  const level = await resolveCompanyLevel(company.id, input.companyLevel);
  if (!level) {
    throw new ApiError(
      "LEVEL_NOT_FOUND",
      `"${input.companyLevel}" is not a configured level at ${company.canonicalName}.`,
    );
  }
  if (input.currency !== location.currency) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Currency ${input.currency} does not match the location currency (${location.currency}).`,
    );
  }
  if (input.reportedAt.getTime() > Date.now()) {
    throw new ApiError("VALIDATION_ERROR", "Reporting date cannot be in the future.");
  }

  // 2. Invariants: missing → 0, non-negative, TC computed server-side.
  const annualBonus = input.annualBonus ?? 0;
  const annualStock = input.annualStock ?? 0;
  const totalCompensation = calculateTotalCompensation(
    input.baseSalary,
    annualBonus,
    annualStock,
  );

  const dedupeKey = generateDedupeKey({
    companyId: company.id,
    roleId: role.id,
    companyLevelId: level.companyLevel.id,
    locationId: location.id,
    baseSalary: input.baseSalary,
    annualBonus,
    annualStock,
    yearsExperience: input.yearsExperience,
    reportedMonth: reportedMonth(input.reportedAt),
  });

  const id = randomBytes(12).toString("hex");
  const inserted = await db
    .insert(compensation)
    .values({
      id,
      companyId: company.id,
      roleFamilyId: family.id,
      roleId: role.id,
      canonicalLevelId: level.canonicalLevel.id,
      companyLevelId: level.companyLevel.id,
      locationId: location.id,
      baseSalary: input.baseSalary,
      annualBonus,
      annualStock,
      totalCompensation,
      currency: input.currency,
      yearsExperience: input.yearsExperience,
      yearsAtCompany: input.yearsAtCompany ?? null,
      employmentType: input.employmentType,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference || null,
      notes: input.notes || null,
      reportedAt: input.reportedAt,
      verificationStatus: "unverified",
      dedupeKey,
      submittedBy: user.id,
    })
    .returning({
      id: compensation.id,
      companyId: compensation.companyId,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      totalCompensation: compensation.totalCompensation,
      currency: compensation.currency,
      createdAt: compensation.createdAt,
    });

  return {
    ...inserted[0],
    company: company.canonicalName,
    role: role.name,
    canonicalLevel: level.canonicalLevel.name,
    companyLevel: level.companyLevel.companyLevelName,
    location: location.city,
    note: "Record accepted. It is labeled unverified demo data.",
  };
}

/* ------------------------------ querying ------------------------------ */

export async function queryCompensation(params: CompensationQuery): Promise<{
  data: ExplorerRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const where: SQL[] = [];

  if (params.q) {
    const q = params.q;
    where.push(
      sql`(${companies.canonicalName} ilike ${`%${q}%`}
        or exists (
          select 1 from ${companyAliases} ca
          where ca.company_id = ${companies.id} and ca.alias ilike ${`%${q}%`}
        )
        or ${roles.name} ilike ${`%${q}%`}
        or ${companyLevels.companyLevelName} ilike ${`%${q}%`}
        or ${canonicalLevels.name} ilike ${`%${q}%`})`,
    );
  }
  if (params.company) {
    const company = await resolveCompanyRef(params.company);
    where.push(eq(compensation.companyId, company.id));
  }
  if (params.roleFamily) {
    const family = await resolveRoleFamily(params.roleFamily);
    where.push(eq(compensation.roleFamilyId, family.id));
  }
  if (params.role) {
    // Resolve within family when provided, else by id alone.
    if (params.roleFamily) {
      const family = await resolveRoleFamily(params.roleFamily);
      const role = await resolveRole(params.role, family.id);
      where.push(eq(compensation.roleId, role.id));
    } else {
      where.push(eq(compensation.roleId, params.role));
    }
  }
  if (params.canonicalLevel) {
    const level = await resolveCanonicalLevel(params.canonicalLevel);
    where.push(eq(compensation.canonicalLevelId, level.id));
  }
  if (params.companyLevel) {
    where.push(eq(companyLevels.normalizedCompanyLevelName, params.companyLevel.toUpperCase()));
  }
  if (params.location) {
    const location =
      (await resolveLocation(params.location)) ??
      (
        await db.select().from(locations).where(eq(locations.slug, params.location.toLowerCase())).limit(1)
      )[0];
    if (!location) throw new ApiError("LOCATION_NOT_FOUND", `Unknown location "${params.location}".`);
    where.push(eq(compensation.locationId, location.id));
  }
  if (params.minTC != null) where.push(gte(compensation.totalCompensation, params.minTC));
  if (params.maxTC != null) where.push(lte(compensation.totalCompensation, params.maxTC));
  if (params.minExperience != null) where.push(gte(compensation.yearsExperience, params.minExperience));
  if (params.maxExperience != null) where.push(lte(compensation.yearsExperience, params.maxExperience));

  const whereSql = where.length ? and(...where) : undefined;
  const sort = SORT_COLUMNS[params.sort];

  // Total count — same WHERE/JOIN shape as the data query (no N+1, no overfetch).
  // Every join is many-to-one, so count(*) cannot double-count rows.
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(compensation)
    .innerJoin(companies, eq(compensation.companyId, companies.id))
    .innerJoin(roles, eq(compensation.roleId, roles.id))
    .innerJoin(roleFamilies, eq(compensation.roleFamilyId, roleFamilies.id))
    .innerJoin(canonicalLevels, eq(compensation.canonicalLevelId, canonicalLevels.id))
    .leftJoin(companyLevels, eq(compensation.companyLevelId, companyLevels.id))
    .innerJoin(locations, eq(compensation.locationId, locations.id))
    .where(whereSql);
  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));

  const rows = await db
    .select({
      id: compensation.id,
      companyId: compensation.companyId,
      roleId: compensation.roleId,
      locationId: compensation.locationId,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      totalCompensation: compensation.totalCompensation,
      currency: compensation.currency,
      yearsExperience: compensation.yearsExperience,
      reportedAt: compensation.reportedAt,
      sourceType: compensation.sourceType,
      verificationStatus: compensation.verificationStatus,
      companyName: companies.canonicalName,
      companySlug: companies.slug,
      roleName: roles.name,
      roleFamilyName: roleFamilies.name,
      canonicalLevelId: canonicalLevels.id,
      canonicalLevelName: canonicalLevels.name,
      companyLevelName: companyLevels.companyLevelName,
      locationCity: locations.city,
      locationCountry: locations.country,
      locationSlug: locations.slug,
    })
    .from(compensation)
    .innerJoin(companies, eq(compensation.companyId, companies.id))
    .innerJoin(roles, eq(compensation.roleId, roles.id))
    .innerJoin(roleFamilies, eq(compensation.roleFamilyId, roleFamilies.id))
    .innerJoin(canonicalLevels, eq(compensation.canonicalLevelId, canonicalLevels.id))
    .leftJoin(companyLevels, eq(compensation.companyLevelId, companyLevels.id))
    .innerJoin(locations, eq(compensation.locationId, locations.id))
    .where(whereSql)
    .orderBy(sql`${sort.col} ${sort.dir}`)
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  return {
    data: rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      roleId: r.roleId,
      locationId: r.locationId,
      company: { name: r.companyName, slug: r.companySlug },
      role: r.roleName,
      roleFamily: r.roleFamilyName,
      canonicalLevel: { id: r.canonicalLevelId, name: r.canonicalLevelName },
      companyLevel: r.companyLevelName,
      location: { city: r.locationCity, country: r.locationCountry, slug: r.locationSlug },
      baseSalary: r.baseSalary,
      annualBonus: r.annualBonus,
      annualStock: r.annualStock,
      totalCompensation: r.totalCompensation,
      currency: r.currency,
      yearsExperience: r.yearsExperience,
      reportedAt: r.reportedAt.toISOString(),
      sourceType: r.sourceType,
      verificationStatus: r.verificationStatus,
    })),
    pagination: { page: params.page, limit: params.limit, total, totalPages },
  };
}

export async function getCompensationById(id: string): Promise<ExplorerRow | null> {
  const rows = await db
    .select({
      id: compensation.id,
      companyId: compensation.companyId,
      roleId: compensation.roleId,
      locationId: compensation.locationId,
      baseSalary: compensation.baseSalary,
      annualBonus: compensation.annualBonus,
      annualStock: compensation.annualStock,
      totalCompensation: compensation.totalCompensation,
      currency: compensation.currency,
      yearsExperience: compensation.yearsExperience,
      reportedAt: compensation.reportedAt,
      sourceType: compensation.sourceType,
      verificationStatus: compensation.verificationStatus,
      companyName: companies.canonicalName,
      companySlug: companies.slug,
      roleName: roles.name,
      roleFamilyName: roleFamilies.name,
      canonicalLevelId: canonicalLevels.id,
      canonicalLevelName: canonicalLevels.name,
      companyLevelName: companyLevels.companyLevelName,
      locationCity: locations.city,
      locationCountry: locations.country,
      locationSlug: locations.slug,
    })
    .from(compensation)
    .innerJoin(companies, eq(compensation.companyId, companies.id))
    .innerJoin(roles, eq(compensation.roleId, roles.id))
    .innerJoin(roleFamilies, eq(compensation.roleFamilyId, roleFamilies.id))
    .innerJoin(canonicalLevels, eq(compensation.canonicalLevelId, canonicalLevels.id))
    .leftJoin(companyLevels, eq(compensation.companyLevelId, companyLevels.id))
    .innerJoin(locations, eq(compensation.locationId, locations.id))
    .where(eq(compensation.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    companyId: r.companyId,
    roleId: r.roleId,
    locationId: r.locationId,
    company: { name: r.companyName, slug: r.companySlug },
    role: r.roleName,
    roleFamily: r.roleFamilyName,
    canonicalLevel: { id: r.canonicalLevelId, name: r.canonicalLevelName },
    companyLevel: r.companyLevelName,
    location: { city: r.locationCity, country: r.locationCountry, slug: r.locationSlug },
    baseSalary: r.baseSalary,
    annualBonus: r.annualBonus,
    annualStock: r.annualStock,
    totalCompensation: r.totalCompensation,
    currency: r.currency,
    yearsExperience: r.yearsExperience,
    reportedAt: r.reportedAt.toISOString(),
    sourceType: r.sourceType,
    verificationStatus: r.verificationStatus,
  };
}
