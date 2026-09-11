import { describe, it, expect } from "vitest";
import { empiricalPercentileRank, MIN_COHORT_FOR_RANK } from "@/lib/services/positioning.service";
import { formatMoney, formatMoneyExact, formatPercent, formatCompactNumber } from "@/lib/utils/format";
import { compensationQuerySchema, cohortSchema, compareQuerySchema } from "@/lib/validation/query";
import { compensationSubmissionSchema } from "@/lib/validation/compensation";
import { normalizeCompanyText } from "@/lib/normalization/company";

describe("empiricalPercentileRank", () => {
  it("declines to rank tiny cohorts", () => {
    expect(empiricalPercentileRank([1, 2, 3, 4], 3)).toBeNull();
    expect(MIN_COHORT_FOR_RANK).toBe(5);
  });
  it("ranks below / equal / above correctly", () => {
    const cohort = [100, 200, 300, 400, 500];
    expect(empiricalPercentileRank(cohort, 300)).toBe(50); // 2 below + 0.5 equal = 2.5 / 5
    expect(empiricalPercentileRank(cohort, 50)).toBe(0);
    expect(empiricalPercentileRank(cohort, 1000)).toBe(100);
  });
  it("handles ties", () => {
    expect(empiricalPercentileRank([100, 100, 100, 100, 100], 100)).toBe(50);
  });
});

describe("format utilities", () => {
  it("formats INR in lakh/crore consistently", () => {
    expect(formatMoney(4_200_000, "INR")).toBe("₹42.0L");
    expect(formatMoney(12_500_000, "INR")).toBe("₹1.25Cr");
    expect(formatMoney(50_000, "INR")).toBe("₹50,000");
    expect(formatMoney(0, "INR")).toBe("₹0");
  });
  it("formats USD compactly", () => {
    expect(formatMoney(195_000, "USD")).toBe("$195K");
    expect(formatMoney(1_200_000, "USD")).toBe("$1.20M");
  });
  it("handles null/undefined/NaN", () => {
    expect(formatMoney(null, "INR")).toBe("—");
    expect(formatMoney(undefined, "USD")).toBe("—");
    expect(formatMoney(Number.NaN, "USD")).toBe("—");
    expect(formatPercent(null)).toBe("—");
    expect(formatCompactNumber(undefined)).toBe("—");
  });
  it("exact formatting uses locale grouping", () => {
    expect(formatMoneyExact(4_200_000, "INR")).toBe("₹42,00,000");
    expect(formatMoneyExact(195_000, "USD")).toBe("$195,000");
  });
  it("percent is signed by default", () => {
    expect(formatPercent(0.274)).toBe("+27%");
    expect(formatPercent(-0.05)).toBe("-5%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.274, { signed: false })).toBe("27%");
  });
});

describe("query validation", () => {
  it("rejects impossible TC ranges", () => {
    const r = compensationQuerySchema.safeParse({ minTC: "5000000", maxTC: "1000000" });
    expect(r.success).toBe(false);
  });
  it("rejects impossible experience ranges in explorer and cohort", () => {
    expect(compensationQuerySchema.safeParse({ minExperience: "10", maxExperience: "2" }).success).toBe(false);
    expect(
      cohortSchema.safeParse({ roleFamily: "x", role: "y", canonicalLevel: "c4", location: "b", minExperience: "9", maxExperience: "1" }).success,
    ).toBe(false);
    expect(
      compareQuerySchema.safeParse({
        roleFamily: "x", role: "y", canonicalLevel: "c4", location: "b", company: ["a", "b"], minExperience: "9", maxExperience: "1",
      }).success,
    ).toBe(false);
  });
  it("rejects negative pages, huge limits and unsupported sorts", () => {
    expect(compensationQuerySchema.safeParse({ page: "-10" }).success).toBe(false);
    expect(compensationQuerySchema.safeParse({ limit: "999999" }).success).toBe(false);
    expect(compensationQuerySchema.safeParse({ sort: "DROP TABLE" }).success).toBe(false);
    expect(compensationQuerySchema.safeParse({ minTC: "-1" }).success).toBe(false);
  });
  it("treats empty and whitespace params as unset", () => {
    const r = compensationQuerySchema.parse({ q: "   ", company: "" });
    expect(r.q).toBeUndefined();
    expect(r.company).toBeUndefined();
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });
  it("caps compare at 3 companies", () => {
    expect(
      compareQuerySchema.safeParse({ roleFamily: "x", role: "y", canonicalLevel: "c4", location: "b", company: ["a", "b", "c", "d"] }).success,
    ).toBe(false);
  });
});

describe("submission validation", () => {
  const valid = {
    company: "Google", roleFamily: "software-engineering", role: "role_software-engineer", companyLevel: "L4",
    location: "Bengaluru", baseSalary: 1000, currency: "INR", yearsExperience: 3, reportedAt: "2025-01-01",
  };
  it("accepts a minimal valid payload and strips client totals", () => {
    const r = compensationSubmissionSchema.parse({ ...valid, totalCompensation: 999 });
    expect((r as Record<string, unknown>).totalCompensation).toBeUndefined();
    expect(r.annualBonus).toBeUndefined();
    expect(r.employmentType).toBe("full_time");
  });
  it("rejects negative bonus and stock and non-integers", () => {
    expect(compensationSubmissionSchema.safeParse({ ...valid, annualBonus: -1 }).success).toBe(false);
    expect(compensationSubmissionSchema.safeParse({ ...valid, annualStock: -1 }).success).toBe(false);
    expect(compensationSubmissionSchema.safeParse({ ...valid, baseSalary: 10.5 }).success).toBe(false);
  });
  it("rejects values that would overflow the integer column with a validation error", () => {
    const r = compensationSubmissionSchema.safeParse({ ...valid, baseSalary: 99_999_999_999 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/supported maximum/);
    const sum = compensationSubmissionSchema.safeParse({ ...valid, baseSalary: 1_500_000_000, annualStock: 1_500_000_000 });
    expect(sum.success).toBe(false);
  });
  it("rejects invalid currency and out-of-range experience", () => {
    expect(compensationSubmissionSchema.safeParse({ ...valid, currency: "EUR" }).success).toBe(false);
    expect(compensationSubmissionSchema.safeParse({ ...valid, yearsExperience: 61 }).success).toBe(false);
  });
});

describe("company normalization — assignment variants", () => {
  it("collapses every required Google variant to one key", () => {
    const variants = [
      "Google", "GOOGLE", "Google LLC", "Google India", "Google India Pvt Ltd",
      "Google India Private Limited", "  Google India Pvt. Ltd.  ",
    ];
    const keys = new Set(variants.map(normalizeCompanyText));
    expect(keys).toEqual(new Set(["google"]));
  });
});
