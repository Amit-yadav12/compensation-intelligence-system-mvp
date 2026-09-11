/**
 * Cohort resolution — shared by benchmark and comparison services so both
 * interpret "the same cohort" identically. A cohort is the unit of valid
 * comparison: role family + role + canonical level + location.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roleFamilies, roles, canonicalLevels, locations } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { resolveLocation } from "@/lib/normalization/location";
import type { CohortQuery } from "@/lib/validation/query";

export type ResolvedCohort = {
  family: { id: string; name: string; slug: string };
  role: { id: string; name: string };
  level: { id: string; name: string; rank: number; description: string | null };
  location: {
    id: string;
    city: string;
    state: string | null;
    country: string;
    slug: string;
    currency: string;
  };
};

export async function resolveCohort(query: CohortQuery): Promise<ResolvedCohort> {
  const family =
    (await db.select().from(roleFamilies).where(eq(roleFamilies.id, query.roleFamily)).limit(1))[0] ??
    (await db.select().from(roleFamilies).where(eq(roleFamilies.slug, query.roleFamily)).limit(1))[0];
  if (!family) throw new ApiError("ROLE_NOT_FOUND", `Unknown role family "${query.roleFamily}".`);

  const roleRows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.roleFamilyId, family.id), eq(roles.id, query.role)))
    .limit(1);
  const role =
    roleRows[0] ??
    (
      await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.roleFamilyId, family.id),
            eq(roles.normalizedName, query.role.trim().toLowerCase()),
          ),
        )
        .limit(1)
    )[0];
  if (!role) throw new ApiError("ROLE_NOT_FOUND", `Unknown role "${query.role}" in ${family.name}.`);

  const level =
    (await db.select().from(canonicalLevels).where(eq(canonicalLevels.id, query.canonicalLevel)).limit(1))[0] ??
    (
      await db
        .select()
        .from(canonicalLevels)
        .where(eq(canonicalLevels.name, query.canonicalLevel))
        .limit(1)
    )[0];
  if (!level) throw new ApiError("LEVEL_NOT_FOUND", `Unknown canonical level "${query.canonicalLevel}".`);

  const location =
    (await resolveLocation(query.location)) ??
    (
      await db.select().from(locations).where(eq(locations.slug, query.location.toLowerCase())).limit(1)
    )[0];
  if (!location) throw new ApiError("LOCATION_NOT_FOUND", `Unknown location "${query.location}".`);

  return {
    family: { id: family.id, name: family.name, slug: family.slug },
    role: { id: role.id, name: role.name },
    level: { id: level.id, name: level.name, rank: level.rank, description: level.description },
    location,
  };
}
