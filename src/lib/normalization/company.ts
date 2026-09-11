/**
 * Company normalization.
 *
 * Raw company text is NEVER treated as canonical identity. The pipeline:
 *   trim → lowercase → punctuation → whitespace → legal-suffix removal
 *   → CompanyAlias lookup → canonical Company row.
 *
 * Aliases are data (company_aliases table), so new variants can be added
 * without code changes. Fuzzy matching is intentionally NOT used as a source
 * of truth — resolution is exact against a controlled vocabulary.
 */
import { db } from "@/db";
import { companies, companyAliases } from "@/db/schema";
import { eq } from "drizzle-orm";

const LEGAL_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt. ltd.",
  "pvt ltd.",
  "pvt.",
  "limited",
  "ltd",
  "llc",
  "l.l.c",
  "inc",
  "incorporated",
  "corporation",
  "corp",
  "company",
  "co",
  "com",
  // Contextual suffixes that commonly appear in Indian job posts.
  "india",
  "india pvt",
  "solutions",
  "technologies",
  "technology",
  "software",
  "systems",
  "services",
  "internet",
];

/** Deterministic text normalization — pure function, unit-tested. */
export function normalizeCompanyText(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Unify punctuation (.,/&# etc.) to spaces.
  s = s.replace(/[^a-z0-9\s&]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Remove legal/contextual suffixes repeatedly (they can appear at the end
  // or before another suffix, e.g. "Google India Pvt. Ltd.").
  let prev = "";
  while (prev !== s) {
    prev = s;
    for (const suffix of LEGAL_SUFFIXES) {
      const re = new RegExp(`\\b${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      s = s.replace(re, " ");
    }
    s = s.replace(/\s+/g, " ").trim();
  }
  return s;
}

export type ResolvedCompany = {
  id: string;
  canonicalName: string;
  slug: string;
  matchedVia: "alias" | "canonical";
};

/**
 * Resolve raw company text to a canonical company.
 * Order: alias lookup first (more specific), then canonical normalized name.
 * Returns null when nothing matches — callers decide whether that is an error.
 */
export async function resolveCompany(raw: string): Promise<ResolvedCompany | null> {
  const normalized = normalizeCompanyText(raw);
  if (!normalized) return null;

  const aliasRows = await db
    .select({
      id: companies.id,
      canonicalName: companies.canonicalName,
      slug: companies.slug,
    })
    .from(companyAliases)
    .innerJoin(companies, eq(companyAliases.companyId, companies.id))
    .where(eq(companyAliases.normalizedAlias, normalized))
    .limit(1);

  if (aliasRows[0]) {
    return { ...aliasRows[0], matchedVia: "alias" };
  }

  const direct = await db
    .select({
      id: companies.id,
      canonicalName: companies.canonicalName,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.normalizedName, normalized))
    .limit(1);

  if (direct[0]) {
    return { ...direct[0], matchedVia: "canonical" };
  }

  return null;
}
