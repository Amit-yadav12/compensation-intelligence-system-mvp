/**
 * CompScope — relational schema.
 *
 * Conceptual separation preserved:
 *   Company | CompanyAlias | RoleFamily | Role | CanonicalLevel |
 *   CompanyLevel | Location | Compensation | User | Session
 *
 * Index philosophy (documented per index):
 * - Unique constraints double as the indexes for identity lookups (slug,
 *   normalizedName, dedupeKey, normalizedAlias).
 * - Foreign-key columns used as equality filters in hot queries get
 *   b-tree indexes: compensation(companyId), (locationId), (canonicalLevelId),
 *   (roleId), (roleFamilyId).
 * - Sort paths used by the explorer get indexes: compensation(totalCompensation),
 *   compensation(reportedAt).
 * - Composite indexes support the two hottest aggregate shapes:
 *   (companyId, canonicalLevelId) for company pages,
 *   (locationId, canonicalLevelId) for cohort/benchmark queries.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Identity & access                                                   */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_unique").on(t.token),
    index("sessions_user_id_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Company identity                                                    */
/* ------------------------------------------------------------------ */

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    slug: text("slug").notNull(),
    website: text("website"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("companies_normalized_name_unique").on(t.normalizedName),
    uniqueIndex("companies_slug_unique").on(t.slug),
  ],
);

export const companyAliases = pgTable(
  "company_aliases",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("company_aliases_normalized_alias_unique").on(t.normalizedAlias),
    index("company_aliases_company_id_idx").on(t.companyId),
  ],
);

/* ------------------------------------------------------------------ */
/* Role taxonomy                                                       */
/* ------------------------------------------------------------------ */

export const roleFamilies = pgTable(
  "role_families",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
  },
  (t) => [
    uniqueIndex("role_families_normalized_name_unique").on(t.normalizedName),
    uniqueIndex("role_families_slug_unique").on(t.slug),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    roleFamilyId: text("role_family_id")
      .notNull()
      .references(() => roleFamilies.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
  },
  (t) => [
    uniqueIndex("roles_family_name_unique").on(t.roleFamilyId, t.normalizedName),
    index("roles_role_family_id_idx").on(t.roleFamilyId),
  ],
);

/* ------------------------------------------------------------------ */
/* Level model — canonical vs company-specific (kept separate)         */
/* ------------------------------------------------------------------ */

export const canonicalLevels = pgTable(
  "canonical_levels",
  {
    id: text("id").primaryKey(), // e.g. "c4"
    name: text("name").notNull(), // e.g. "C4 · Mid"
    rank: integer("rank").notNull(), // 1..10, ordered seniority
    description: text("description"),
  },
  (t) => [
    uniqueIndex("canonical_levels_rank_unique").on(t.rank),
  ],
);

export const companyLevels = pgTable(
  "company_levels",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    canonicalLevelId: text("canonical_level_id")
      .notNull()
      .references(() => canonicalLevels.id, { onDelete: "restrict" }),
    companyLevelName: text("company_level_name").notNull(),
    normalizedCompanyLevelName: text("normalized_company_level_name").notNull(),
  },
  (t) => [
    uniqueIndex("company_levels_company_name_unique").on(
      t.companyId,
      t.normalizedCompanyLevelName,
    ),
    index("company_levels_canonical_idx").on(t.canonicalLevelId),
  ],
);

/* ------------------------------------------------------------------ */
/* Locations — city/state/country split, currency attached             */
/* ------------------------------------------------------------------ */

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    city: text("city").notNull(),
    state: text("state"),
    country: text("country").notNull(),
    normalizedName: text("normalized_name").notNull(),
    slug: text("slug").notNull(),
    currency: text("currency").notNull().default("INR"),
  },
  (t) => [
    uniqueIndex("locations_normalized_name_unique").on(t.normalizedName),
    uniqueIndex("locations_slug_unique").on(t.slug),
  ],
);

/* ------------------------------------------------------------------ */
/* Compensation — the core fact table                                  */
/* ------------------------------------------------------------------ */

export const compensation = pgTable(
  "compensation",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    roleFamilyId: text("role_family_id")
      .notNull()
      .references(() => roleFamilies.id, { onDelete: "restrict" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    canonicalLevelId: text("canonical_level_id")
      .notNull()
      .references(() => canonicalLevels.id, { onDelete: "restrict" }),
    // Nullable: a submission may precede a configured company ladder.
    companyLevelId: text("company_level_id").references(
      () => companyLevels.id,
      { onDelete: "set null" },
    ),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    baseSalary: integer("base_salary").notNull(),
    annualBonus: integer("annual_bonus").notNull().default(0),
    annualStock: integer("annual_stock").notNull().default(0),
    // Derived server-side: base + bonus + stock. Client totals are ignored.
    totalCompensation: integer("total_compensation").notNull(),
    currency: text("currency").notNull().default("INR"),
    yearsExperience: integer("years_experience").notNull(),
    yearsAtCompany: integer("years_at_company"),
    employmentType: text("employment_type").notNull().default("full_time"),
    sourceType: text("source_type").notNull().default("self_reported"),
    sourceReference: text("source_reference"),
    notes: text("notes"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    // Deterministic dedupe key, enforced at the database level (race-safe).
    dedupeKey: text("dedupe_key").notNull(),
    submittedBy: text("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("compensation_dedupe_key_unique").on(t.dedupeKey),
    index("compensation_company_idx").on(t.companyId),
    index("compensation_location_idx").on(t.locationId),
    index("compensation_canonical_level_idx").on(t.canonicalLevelId),
    index("compensation_role_idx").on(t.roleId),
    index("compensation_role_family_idx").on(t.roleFamilyId),
    index("compensation_tc_idx").on(t.totalCompensation),
    index("compensation_reported_at_idx").on(t.reportedAt),
    // Company page: per-level aggregates.
    index("compensation_company_level_idx").on(t.companyId, t.canonicalLevelId),
    // Benchmark/cohort: location + canonical level.
    index("compensation_location_level_idx").on(t.locationId, t.canonicalLevelId),
    check(
      "compensation_non_negative",
      sql`base_salary >= 0 AND annual_bonus >= 0 AND annual_stock >= 0 AND total_compensation >= 0`,
    ),
    check("compensation_total_invariant", sql`total_compensation = base_salary + annual_bonus + annual_stock`),
    check(
      "compensation_experience_range",
      sql`years_experience >= 0 AND years_experience <= 60`,
    ),
  ],
);

export type DbUser = typeof users.$inferSelect;
export type DbCompany = typeof companies.$inferSelect;
export type DbCompensation = typeof compensation.$inferSelect;
