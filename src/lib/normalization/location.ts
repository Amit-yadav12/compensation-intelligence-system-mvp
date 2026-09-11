/**
 * Location normalization.
 *
 * Common variants resolve consistently:
 *   Bangalore / Bengaluru → Bengaluru
 *   Bombay / Mumbai       → Mumbai
 *   Gurgaon / Gurugram / Noida / New Delhi → Delhi NCR
 *   SF / San Francisco / Silicon Valley / Bay Area → San Francisco Bay Area
 *   NYC / New York City   → New York
 *
 * The alias map covers known variants; unknown locations normalize to their
 * own canonical text and simply won't resolve to a seeded location (which
 * callers surface as LOCATION_NOT_FOUND).
 */
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";

const LOCATION_ALIASES: Record<string, string> = {
  // India
  bangalore: "bengaluru",
  bengaluru: "bengaluru",
  banglore: "bengaluru",
  bombay: "mumbai",
  mumbai: "mumbai",
  gurgaon: "delhi ncr",
  gurugram: "delhi ncr",
  noida: "delhi ncr",
  "new delhi": "delhi ncr",
  delhi: "delhi ncr",
  "delhi ncr": "delhi ncr",
  madras: "chennai",
  chennai: "chennai",
  calcutta: "kolkata",
  kolkata: "kolkata",
  hyderabad: "hyderabad",
  pune: "pune",
  ahmedabad: "ahmedabad",
  jaipur: "jaipur",
  kochi: "kochi",
  cochin: "kochi",
  chandigarh: "chandigarh",
  indore: "indore",
  // USA
  "san francisco": "san francisco bay area",
  sf: "san francisco bay area",
  "sf bay area": "san francisco bay area",
  "bay area": "san francisco bay area",
  "silicon valley": "san francisco bay area",
  sfo: "san francisco bay area",
  "new york": "new york",
  "new york city": "new york",
  nyc: "new york",
  ny: "new york",
  seattle: "seattle",
  austin: "austin",
  denver: "denver",
  boston: "boston",
};

/** Pure text normalization — lowercases, strips punctuation, then maps aliases. */
export function normalizeLocationText(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const mapped = LOCATION_ALIASES[s];
  return mapped ?? s;
}

export type ResolvedLocation = {
  id: string;
  city: string;
  state: string | null;
  country: string;
  slug: string;
  currency: string;
};

export async function resolveLocation(raw: string): Promise<ResolvedLocation | null> {
  const normalized = normalizeLocationText(raw);
  if (!normalized) return null;
  const row = await db
    .select({
      id: locations.id,
      city: locations.city,
      state: locations.state,
      country: locations.country,
      slug: locations.slug,
      currency: locations.currency,
    })
    .from(locations)
    .where(eq(locations.normalizedName, normalized))
    .limit(1);
  return row[0] ?? null;
}
