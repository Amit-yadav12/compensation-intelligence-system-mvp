/**
 * API tests for analytics surfaces: company analytics, benchmark, compare and
 * record positioning — all against the seeded database.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as analyticsGET } from "@/app/api/companies/[id]/analytics/route";
import { GET as benchmarkGET } from "@/app/api/benchmark/route";
import { GET as compareGET } from "@/app/api/compare/route";
import { GET as compensationGET } from "@/app/api/compensation/route";
import { GET as positionGET } from "@/app/api/compensation/[id]/position/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/companies/[id]/analytics", () => {
  it("returns structured analytics including vs-market rows", async () => {
    const res = await analyticsGET(new Request("http://localhost"), ctx("google"));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.recordCount).toBeGreaterThan(10);
    expect(data.byLevel.length).toBeGreaterThan(3);
    expect(data.snapshotByCurrency.length).toBeGreaterThanOrEqual(1);
    expect(data.vsMarket.length).toBeGreaterThan(0);
    for (const v of data.vsMarket) {
      expect(v.companyCount).toBeGreaterThanOrEqual(3);
      expect(v.marketCount).toBeGreaterThanOrEqual(3);
      expect(typeof v.relativePct).toBe("number");
    }
    // Level medians must be monotonic-ish: top level > bottom level.
    const sorted = [...data.byLevel].sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank);
    expect(sorted[sorted.length - 1].median).toBeGreaterThan(sorted[0].median);
    // No sensitive/internal fields leak.
    expect(JSON.stringify(data)).not.toMatch(/passwordHash|dedupeKey|submittedBy/);
  });

  it("404s for unknown companies with the stable error code", async () => {
    const res = await analyticsGET(new Request("http://localhost"), ctx("no-such-company"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("COMPANY_NOT_FOUND");
  });
});

describe("GET /api/benchmark", () => {
  const base = "http://localhost/api/benchmark?roleFamily=software-engineering&role=role_software-engineer&canonicalLevel=c4";

  it("returns a complete cohort distribution with coverage label", async () => {
    const res = await benchmarkGET(new NextRequest(`${base}&location=bengaluru`));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.sampleSize).toBeGreaterThan(10);
    expect(data.stats.p25).toBeLessThanOrEqual(data.stats.median);
    expect(data.stats.median).toBeLessThanOrEqual(data.stats.p75);
    expect(data.stats.p75).toBeLessThanOrEqual(data.stats.p90);
    expect(["low", "moderate", "strong"]).toContain(data.qualityLabel);
    expect(data.cohort.currency).toBe("INR");
    // Location differentials never cross currencies.
    expect(data.locationDifferentials.every((d: { slug: string }) => !["seattle", "sf-bay-area", "new-york"].includes(d.slug))).toBe(true);
  });

  it("resolves location aliases in cohorts", async () => {
    const res = await benchmarkGET(new NextRequest(`${base}&location=bangalore`));
    expect(res.status).toBe(200);
    expect((await res.json()).data.cohort.location).toBe("Bengaluru");
  });

  it("returns an empty-but-valid benchmark for a cohort with no data", async () => {
    const res = await benchmarkGET(
      new NextRequest("http://localhost/api/benchmark?roleFamily=hr&role=role_recruiter&canonicalLevel=c10&location=indore"),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.sampleSize).toBe(0);
    expect(data.qualityLabel).toBe("low");
    expect(data.insights[0].kind).toBe("coverage");
  });

  it("rejects missing cohort fields and unknown levels", async () => {
    expect((await benchmarkGET(new NextRequest("http://localhost/api/benchmark?role=x"))).status).toBe(400);
    const res = await benchmarkGET(new NextRequest(`http://localhost/api/benchmark?roleFamily=software-engineering&role=role_software-engineer&canonicalLevel=c99&location=bengaluru`));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("LEVEL_NOT_FOUND");
  });
});

describe("GET /api/compare", () => {
  it("compares companies within one cohort and flags approximation", async () => {
    const res = await compareGET(
      new NextRequest(
        "http://localhost/api/compare?company=google&company=microsoft&company=amazon&roleFamily=software-engineering&role=role_software-engineer&canonicalLevel=c4&location=bengaluru",
      ),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.companies).toHaveLength(3);
    expect(data.cohort.levelApproximationNote).toMatch(/approximation/i);
    expect(data.market.count).toBeGreaterThan(0);
    for (const c of data.companies) {
      expect(c.components).toMatchObject({ medianBase: expect.any(Number) });
      expect(c.mix.baseRatio + c.mix.stockRatio + c.mix.bonusRatio).toBeCloseTo(c.sampleSize > 0 ? 1 : 0, 5);
    }
  });

  it("rejects more than three companies and unknown companies", async () => {
    const q = "roleFamily=software-engineering&role=role_software-engineer&canonicalLevel=c4&location=bengaluru";
    expect((await compareGET(new NextRequest(`http://localhost/api/compare?${q}&company=a&company=b&company=c&company=d`))).status).toBe(400);
    const res = await compareGET(new NextRequest(`http://localhost/api/compare?${q}&company=google&company=nonexistent-co`));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("COMPANY_NOT_FOUND");
  });
});

describe("GET /api/compensation/[id]/position", () => {
  it("positions a real record inside its cohort", async () => {
    const list = await compensationGET(new NextRequest("http://localhost/api/compensation?company=google&canonicalLevel=c4&location=bengaluru&limit=1"));
    const { data } = await list.json();
    const id = data[0].id as string;
    const res = await positionGET(new Request("http://localhost"), ctx(id));
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.record.id).toBe(id);
    expect(body.sampleSize).toBeGreaterThanOrEqual(5);
    expect(body.percentileRank).toBeGreaterThanOrEqual(0);
    expect(body.percentileRank).toBeLessThanOrEqual(100);
    expect(body.companyCohort.sampleSize).toBeGreaterThan(0);
  });

  it("404s for unknown record ids", async () => {
    const res = await positionGET(new Request("http://localhost"), ctx("does-not-exist"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
});
