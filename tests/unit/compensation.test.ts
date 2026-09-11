import { describe, it, expect } from "vitest";
import { calculateTotalCompensation } from "@/lib/domain/compensation";
import { generateDedupeKey, reportedMonth } from "@/lib/utils/dedupe";

describe("calculateTotalCompensation", () => {
  it("sums base + bonus + stock", () => {
    expect(calculateTotalCompensation(100, 20, 30)).toBe(150);
  });

  it("missing bonus/stock become 0", () => {
    expect(calculateTotalCompensation(100)).toBe(100);
    expect(calculateTotalCompensation(100, null, null)).toBe(100);
    expect(calculateTotalCompensation(100, undefined, 5)).toBe(105);
  });

  it("rejects negative values by clamping to 0", () => {
    expect(calculateTotalCompensation(-100, 20, 30)).toBe(50);
    expect(calculateTotalCompensation(100, -20, 30)).toBe(130);
    expect(calculateTotalCompensation(100, 20, -30)).toBe(120);
  });

  it("zero salary produces zero total", () => {
    expect(calculateTotalCompensation(0, 0, 0)).toBe(0);
  });

  it("handles NaN safely", () => {
    expect(calculateTotalCompensation(Number.NaN, 10, 10)).toBe(20);
  });
});

describe("generateDedupeKey", () => {
  const base = {
    companyId: "google",
    roleId: "role_software-engineer",
    companyLevelId: "cl_google_l5",
    locationId: "bengaluru",
    baseSalary: 3_700_000,
    annualBonus: 500_000,
    annualStock: 900_000,
    yearsExperience: 5,
    reportedMonth: "2025-03",
  };

  it("is deterministic for identical inputs", () => {
    expect(generateDedupeKey(base)).toBe(generateDedupeKey({ ...base }));
  });

  it("changes when any component changes", () => {
    const a = generateDedupeKey(base);
    expect(generateDedupeKey({ ...base, baseSalary: 3_700_001 })).not.toBe(a);
    expect(generateDedupeKey({ ...base, yearsExperience: 6 })).not.toBe(a);
    expect(generateDedupeKey({ ...base, reportedMonth: "2025-04" })).not.toBe(a);
    expect(generateDedupeKey({ ...base, locationId: "hyderabad" })).not.toBe(a);
  });

  it("tolerates a null company level", () => {
    const key = generateDedupeKey({ ...base, companyLevelId: null });
    expect(key).toMatch(/^[0-9a-f]{40}$/);
  });

  it("produces a 40-char hex digest", () => {
    expect(generateDedupeKey(base)).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("reportedMonth", () => {
  it("formats UTC year-month", () => {
    expect(reportedMonth(new Date("2025-03-15T10:00:00Z"))).toBe("2025-03");
    expect(reportedMonth(new Date("2025-01-02T00:00:00Z"))).toBe("2025-01");
  });
});
