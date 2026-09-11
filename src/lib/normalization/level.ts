/**
 * Level normalization.
 *
 * Two distinct concepts are kept separate:
 *   - company-specific level ("L4", "62", "SDE II") — what the company calls it
 *   - canonical level ("C4 · Mid") — the comparison group we map it into
 *
 * Mappings are EXPLICIT and CONFIGURED (company_levels table), never inferred
 * by an opaque model. The UI labels them as approximate. This module only
 * does exact text resolution against the configured vocabulary.
 */
import { db } from "@/db";
import { companyLevels, canonicalLevels } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Normalize a level string:
 *  - uppercase
 *  - strip stray punctuation but keep dots/roman numerals meaningful
 *  - collapse internal whitespace ("L 4" → "L4")
 */
export function normalizeLevelText(raw: string): string {
  let s = raw.trim().toUpperCase();
  // Remove characters that are never meaningful in a level name.
  s = s.replace(/[,()/\\#@!$%^&*_+=~`]/g, "");
  // Collapse whitespace between letter groups and numbers: "L 4" → "L4",
  // "SDE  II" → "SDE II" (single space between words).
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/([A-Z])\s(\d)/g, "$1$2");
  return s;
}

export type ResolvedCompanyLevel = {
  companyLevel: {
    id: string;
    companyLevelName: string;
  };
  canonicalLevel: {
    id: string;
    name: string;
    rank: number;
    description: string | null;
  };
};

/**
 * Resolve a company-specific level name to its configured canonical mapping.
 * Exact match only — no fuzzy inference. Returns null when the company has
 * no configured level with that name.
 */
export async function resolveCompanyLevel(
  companyId: string,
  raw: string,
): Promise<ResolvedCompanyLevel | null> {
  const normalized = normalizeLevelText(raw);
  if (!normalized) return null;
  const rows = await db
    .select({
      id: companyLevels.id,
      companyLevelName: companyLevels.companyLevelName,
      canonicalId: canonicalLevels.id,
      canonicalName: canonicalLevels.name,
      rank: canonicalLevels.rank,
      description: canonicalLevels.description,
    })
    .from(companyLevels)
    .innerJoin(canonicalLevels, eq(companyLevels.canonicalLevelId, canonicalLevels.id))
    .where(
      and(
        eq(companyLevels.companyId, companyId),
        eq(companyLevels.normalizedCompanyLevelName, normalized),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    companyLevel: { id: row.id, companyLevelName: row.companyLevelName },
    canonicalLevel: {
      id: row.canonicalId,
      name: row.canonicalName,
      rank: row.rank,
      description: row.description,
    },
  };
}
