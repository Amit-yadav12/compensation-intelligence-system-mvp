/**
 * Query-parameter validation for the explorer, benchmark and compare APIs.
 *
 * Every query param is validated and coerced before touching the database:
 * malformed values (page=abc, minTC=-5) become VALIDATION_ERROR instead of
 * SQL errors, and out-of-range values are clamped to safe bounds.
 */
import { z } from "zod";

const sortEnum = z.enum([
  "tc_desc",
  "tc_asc",
  "base_desc",
  "stock_desc",
  "bonus_desc",
  "newest",
]);

// Empty query params (?q=) mean "no filter" — they must not become VALIDATION_ERROR.
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(1).max(max).optional(),
  );

export const compensationQuerySchema = z.object({
  q: optionalText(120),
  company: optionalText(120),
  role: optionalText(120),
  roleFamily: optionalText(120),
  canonicalLevel: optionalText(40),
  companyLevel: optionalText(60),
  location: optionalText(120),
  minTC: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  maxTC: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  maxExperience: z.coerce.number().int().min(0).max(60).optional(),
  sort: sortEnum.default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
  // Impossible ranges are rejected explicitly instead of silently returning nothing.
  .refine((q) => q.minTC == null || q.maxTC == null || q.minTC <= q.maxTC, {
    message: "minTC must be less than or equal to maxTC.",
    path: ["minTC"],
  })
  .refine(
    (q) => q.minExperience == null || q.maxExperience == null || q.minExperience <= q.maxExperience,
    { message: "minExperience must be less than or equal to maxExperience.", path: ["minExperience"] },
  );

export type CompensationQuery = z.infer<typeof compensationQuerySchema>;

const experienceBandValidRaw = (q: { minExperience?: number; maxExperience?: number }) =>
  q.minExperience == null || q.maxExperience == null || q.minExperience <= q.maxExperience;

/** A comparison cohort — every field is explicit; no implicit scope creep. */
const cohortBase = z.object({
  roleFamily: z.string().trim().min(1, "Role family is required for a cohort."),
  role: z.string().trim().min(1, "Role is required for a cohort."),
  canonicalLevel: z.string().trim().min(1, "Canonical level is required for a cohort."),
  location: z.string().trim().min(1, "Location is required for a cohort."),
  minExperience: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).max(60).optional()),
  maxExperience: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).max(60).optional()),
});

const EXPERIENCE_BAND_ISSUE = {
  message: "minExperience must be less than or equal to maxExperience.",
  path: ["minExperience"] as string[],
};

export const cohortSchema = cohortBase.refine(experienceBandValidRaw, EXPERIENCE_BAND_ISSUE);

export type CohortQuery = z.infer<typeof cohortSchema>;



export const compareQuerySchema = cohortBase
  .extend({
    // Repeated query param: /api/compare?company=google&company=microsoft
    company: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  })
  .refine(experienceBandValidRaw, EXPERIENCE_BAND_ISSUE);

export type CompareQuery = z.infer<typeof compareQuerySchema>;
