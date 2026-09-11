import { describe, it, expect } from "vitest";
import {
  quantile,
  calculatePercentiles,
  qualityLabel,
  calculateCompensationMix,
  aggregateCompensationMix,
  calculateLocationDifferential,
  relativeDifference,
} from "@/lib/analytics/stats";

describe("quantile", () => {
  it("handles empty input", () => {
    expect(quantile([], 0.5)).toBe(0);
  });

  it("handles single element", () => {
    expect(quantile([42], 0.5)).toBe(42);
  });

  it("matches numpy-style linear interpolation", () => {
    const sorted = [10, 20, 30, 40];
    expect(quantile(sorted, 0)).toBe(10);
    expect(quantile(sorted, 0.5)).toBe(25);
    expect(quantile(sorted, 1)).toBe(40);
    expect(quantile(sorted, 0.25)).toBe(17.5);
  });
});

describe("calculatePercentiles", () => {
  it("returns the full distribution shape", () => {
    const p = calculatePercentiles([100, 200, 300, 400, 500]);
    expect(p.count).toBe(5);
    expect(p.min).toBe(100);
    expect(p.max).toBe(500);
    expect(p.median).toBe(300);
    expect(p.p25).toBe(200);
    expect(p.p75).toBe(400);
  });

  it("returns zeros for empty input", () => {
    const p = calculatePercentiles([]);
    expect(p.count).toBe(0);
    expect(p.median).toBe(0);
  });

  it("rounds interpolated values", () => {
    const p = calculatePercentiles([100, 200, 300, 400]);
    expect(p.median).toBe(250);
    expect(p.p25).toBe(175);
  });
});

describe("qualityLabel", () => {
  it("classifies coverage by sample size", () => {
    expect(qualityLabel(0)).toBe("low");
    expect(qualityLabel(9)).toBe("low");
    expect(qualityLabel(10)).toBe("moderate");
    expect(qualityLabel(49)).toBe("moderate");
    expect(qualityLabel(50)).toBe("strong");
  });
});

describe("calculateCompensationMix", () => {
  it("computes ratios", () => {
    const mix = calculateCompensationMix(70, 14, 16);
    expect(mix.baseRatio).toBeCloseTo(0.7);
    expect(mix.stockRatio).toBeCloseTo(0.16);
    expect(mix.bonusRatio).toBeCloseTo(0.14);
    expect(mix.total).toBe(100);
  });

  it("handles total = 0 without NaN", () => {
    const mix = calculateCompensationMix(0, 0, 0);
    expect(mix.baseRatio).toBe(0);
    expect(mix.stockRatio).toBe(0);
    expect(mix.bonusRatio).toBe(0);
  });

  it("aggregates across records (sums first, ratios second)", () => {
    const mix = aggregateCompensationMix([
      { baseSalary: 70, annualBonus: 10, annualStock: 20 },
      { baseSalary: 80, annualBonus: 20, annualStock: 0 },
    ]);
    expect(mix.total).toBe(200);
    expect(mix.baseRatio).toBeCloseTo(0.75);
  });
});

describe("calculateLocationDifferential", () => {
  it("computes relative difference", () => {
    const d = calculateLocationDifferential(4_000_000, 4_800_000);
    expect(d.relativePct).toBeCloseTo(0.2);
    expect(d.direction).toBe("higher");
  });

  it("detects lower and equal", () => {
    expect(calculateLocationDifferential(100, 80).direction).toBe("lower");
    expect(calculateLocationDifferential(100, 100).direction).toBe("equal");
  });

  it("returns unknown when a median is zero", () => {
    const d = calculateLocationDifferential(0, 100);
    expect(d.direction).toBe("unknown");
    expect(d.relativePct).toBe(0);
  });

  it("relativeDifference", () => {
    expect(relativeDifference(110, 100)).toBeCloseTo(0.1);
    expect(relativeDifference(90, 100)).toBeCloseTo(-0.1);
    expect(relativeDifference(100, 0)).toBe(0);
  });
});
