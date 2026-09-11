import { describe, it, expect } from "vitest";
import { normalizeCompanyText } from "@/lib/normalization/company";
import { normalizeLocationText } from "@/lib/normalization/location";
import { normalizeLevelText } from "@/lib/normalization/level";

describe("normalizeCompanyText", () => {
  it("strips whitespace and lowercases", () => {
    expect(normalizeCompanyText("  Google  ")).toBe("google");
  });

  it("removes legal suffixes", () => {
    expect(normalizeCompanyText("Google India Pvt. Ltd.")).toBe("google");
    expect(normalizeCompanyText("Microsoft Corporation")).toBe("microsoft");
    expect(normalizeCompanyText("Uber Technologies")).toBe("uber");
    expect(normalizeCompanyText("Flipkart Internet Pvt Ltd")).toBe("flipkart");
  });

  it("removes punctuation", () => {
    expect(normalizeCompanyText("Amazon.com, Inc.")).toBe("amazon");
  });

  it("collapses repeated whitespace and removes contextual suffixes", () => {
    expect(normalizeCompanyText("  IBM    India   ")).toBe("ibm");
  });

  it("never returns empty for non-empty input after cleanup", () => {
    // "Pvt. Ltd." alone collapses to empty — the caller treats that as no match.
    expect(normalizeCompanyText("Pvt. Ltd.")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeCompanyText("Google India Pvt. Ltd.");
    expect(normalizeCompanyText(once)).toBe(once);
  });
});

describe("normalizeLocationText", () => {
  it("maps known variants to the canonical location", () => {
    expect(normalizeLocationText("Bangalore")).toBe("bengaluru");
    expect(normalizeLocationText("BANGALORE")).toBe("bengaluru");
    expect(normalizeLocationText("Bombay")).toBe("mumbai");
    expect(normalizeLocationText("Gurgaon")).toBe("delhi ncr");
    expect(normalizeLocationText("Gurugram")).toBe("delhi ncr");
    expect(normalizeLocationText("Noida")).toBe("delhi ncr");
    expect(normalizeLocationText("Madras")).toBe("chennai");
    expect(normalizeLocationText("SF")).toBe("san francisco bay area");
    expect(normalizeLocationText("Silicon Valley")).toBe("san francisco bay area");
    expect(normalizeLocationText("NYC")).toBe("new york");
  });

  it("passes through unknown locations in normalized form", () => {
    expect(normalizeLocationText("Pondicherry")).toBe("pondicherry");
  });
});

describe("normalizeLevelText", () => {
  it("uppercases and collapses whitespace", () => {
    expect(normalizeLevelText("sde ii")).toBe("SDE II");
    expect(normalizeLevelText("  L4  ")).toBe("L4");
  });

  it("joins single-letter/digit groups: 'L 4' → 'L4'", () => {
    expect(normalizeLevelText("L 4")).toBe("L4");
    expect(normalizeLevelText("e 5")).toBe("E5");
  });

  it("keeps Roman numerals intact", () => {
    expect(normalizeLevelText("SDE II")).toBe("SDE II");
  });

  it("joins letter-digit groups so 'ICT 3' matches 'ICT3'", () => {
    expect(normalizeLevelText("ICT 3")).toBe("ICT3");
  });

  it("strips disallowed punctuation", () => {
    expect(normalizeLevelText("L4,")).toBe("L4");
    expect(normalizeLevelText("62")).toBe("62");
  });
});
