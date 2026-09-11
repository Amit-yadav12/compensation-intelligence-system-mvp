/**
 * Core compensation invariants — extracted so the business rules live in
 * exactly one place and can be unit-tested without any I/O.
 */

/**
 * Invariant 1 — total compensation is derived, never trusted from the client:
 *   total = base + bonus + stock
 * Invariant 2 — missing bonus/stock become 0.
 * Invariant 3 — money is non-negative; negative inputs clamp to 0.
 */
export function calculateTotalCompensation(
  baseSalary: number,
  annualBonus?: number | null,
  annualStock?: number | null,
): number {
  const base = clampMoney(baseSalary);
  const bonus = annualBonus == null || Number.isNaN(annualBonus) ? 0 : clampMoney(annualBonus);
  const stock = annualStock == null || Number.isNaN(annualStock) ? 0 : clampMoney(annualStock);
  return base + bonus + stock;
}

function clampMoney(v: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export const SOURCE_TYPES = ["self_reported", "offer_letter", "pay_slip", "anonymous_survey"] as const;
export const CURRENCIES = ["INR", "USD"] as const;
