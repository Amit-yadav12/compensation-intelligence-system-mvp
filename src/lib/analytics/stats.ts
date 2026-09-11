/**
 * Pure statistical primitives.
 *
 * All analytics in the system funnel through this module so that
 * percentile/mix/difference semantics are defined exactly once and can be
 * unit-tested in isolation. No I/O, no ORM, no framework — only numbers in,
 * numbers out.
 */

export type Percentiles = {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
};

export type QualityLabel = "low" | "moderate" | "strong";

/**
 * Linear-interpolation quantile (equivalent to numpy's default method).
 * `sortedAsc` must already be sorted ascending; `p` in [0, 1].
 */
export function quantile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = Math.min(1, Math.max(0, p));
  const idx = (sortedAsc.length - 1) * clamped;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

/** Sorted copy + the full benchmark distribution used by every cohort view. */
export function calculatePercentiles(values: number[]): Percentiles {
  if (values.length === 0) {
    return { count: 0, min: 0, p25: 0, median: 0, p75: 0, p90: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    p25: Math.round(quantile(sorted, 0.25)),
    median: Math.round(quantile(sorted, 0.5)),
    p75: Math.round(quantile(sorted, 0.75)),
    p90: Math.round(quantile(sorted, 0.9)),
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
  };
}

/**
 * Coverage label — a transparent confidence signal, NOT a statistical claim.
 *   n < 10  → low      (show a warning, weaken wording)
 *   10–49   → moderate
 *   50+     → strong
 */
export function qualityLabel(n: number): QualityLabel {
  if (n < 10) return "low";
  if (n < 50) return "moderate";
  return "strong";
}

export type CompensationMix = {
  baseRatio: number;
  stockRatio: number;
  bonusRatio: number;
  total: number;
};

/**
 * Compensation mix. total = 0 (e.g. all-zero edge case) is handled safely:
 * ratios collapse to 0 instead of producing NaN/Infinity.
 */
export function calculateCompensationMix(
  base: number,
  bonus: number,
  stock: number,
): CompensationMix {
  const total = base + bonus + stock;
  if (total <= 0) {
    return { baseRatio: 0, stockRatio: 0, bonusRatio: 0, total: 0 };
  }
  return {
    baseRatio: base / total,
    stockRatio: stock / total,
    bonusRatio: bonus / total,
    total,
  };
}

/** Average mix across many records — component sums first, ratios second. */
export function aggregateCompensationMix(
  records: Array<{ baseSalary: number; annualBonus: number; annualStock: number }>,
): CompensationMix {
  const sums = records.reduce(
    (acc, r) => ({
      base: acc.base + r.baseSalary,
      bonus: acc.bonus + r.annualBonus,
      stock: acc.stock + r.annualStock,
    }),
    { base: 0, bonus: 0, stock: 0 },
  );
  return calculateCompensationMix(sums.base, sums.bonus, sums.stock);
}

export type LocationDifferential = {
  referenceMedian: number;
  comparisonMedian: number;
  relativePct: number; // (comparison - reference) / reference, may be negative
  direction: "higher" | "lower" | "equal" | "unknown";
};

/**
 * Location differential. Only meaningful when both medians are > 0 —
 * otherwise we return `unknown` rather than fabricate a percentage.
 */
export function calculateLocationDifferential(
  referenceMedian: number,
  comparisonMedian: number,
): LocationDifferential {
  if (referenceMedian <= 0 || comparisonMedian <= 0) {
    return {
      referenceMedian,
      comparisonMedian,
      relativePct: 0,
      direction: "unknown",
    };
  }
  const relativePct = (comparisonMedian - referenceMedian) / referenceMedian;
  return {
    referenceMedian,
    comparisonMedian,
    relativePct,
    direction:
      Math.abs(relativePct) < 0.005 ? "equal" : relativePct > 0 ? "higher" : "lower",
  };
}

/** Signed percent difference, used for "x% above/below median" insights. */
export function relativeDifference(value: number, reference: number): number {
  if (reference <= 0) return 0;
  return (value - reference) / reference;
}

/** Format a ratio (0.274) as a whole percentage (27). */
export function pct(ratio: number): number {
  return Math.round(ratio * 100);
}
