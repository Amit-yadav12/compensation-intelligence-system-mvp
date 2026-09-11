/**
 * Deterministic deduplication.
 *
 * A compensation record's identity is:
 *   company | role | company-level | location | base | bonus | stock
 *   | years of experience | reported month
 *
 * Repeated submissions of the same fact (double-click, retry, two tabs)
 * produce the same key. The key is stored in `compensation.dedupe_key` with
 * a UNIQUE index, so the DATABASE — not just application code — is the
 * race-safe authority. The service layer translates a 23505 violation into
 * the DUPLICATE_COMPENSATION API error.
 */
import { createHash } from "crypto";

export type DedupeParts = {
  companyId: string;
  roleId: string;
  companyLevelId: string | null;
  locationId: string;
  baseSalary: number;
  annualBonus: number;
  annualStock: number;
  yearsExperience: number;
  /** Month bucket — "2025-03" — so the same fact reported twice in a month collides. */
  reportedMonth: string;
};

export function generateDedupeKey(parts: DedupeParts): string {
  const payload = [
    parts.companyId,
    parts.roleId,
    parts.companyLevelId ?? "_",
    parts.locationId,
    parts.baseSalary,
    parts.annualBonus,
    parts.annualStock,
    parts.yearsExperience,
    parts.reportedMonth,
  ].join("|");
  return createHash("sha1").update(payload).digest("hex");
}

export function reportedMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
