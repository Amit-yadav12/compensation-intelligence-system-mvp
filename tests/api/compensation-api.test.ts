/**
 * API-level tests — invoke the actual route handlers with constructed
 * NextRequest objects against the real (seeded) database.
 *
 * Auth is exercised by mocking next/headers cookies; a dedicated test user
 * with a known session token is created and cleaned up around the suite.
 */
import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, compensation } from "@/db/schema";
import { hashPassword, SESSION_COOKIE } from "@/lib/auth/session";

const TEST_USER_ID = "user_api_test";
const TEST_TOKEN = "test-token-" + randomBytes(8).toString("hex");

let sessionToken: string | null = TEST_TOKEN;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && sessionToken ? { value: sessionToken } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Imported AFTER the mock is registered (vitest hoists vi.mock, this is safe).
import { GET, POST } from "@/app/api/compensation/route";

const URL = "http://localhost/api/compensation";
const VALID_PAYLOAD = {
  company: "Google",
  roleFamily: "software-engineering",
  role: "role_software-engineer",
  companyLevel: "L5",
  location: "Bengaluru",
  baseSalary: 3_900_000,
  annualBonus: 500_000,
  annualStock: 1_100_000,
  currency: "INR",
  yearsExperience: 5,
  yearsAtCompany: 3,
  employmentType: "full_time",
  sourceType: "self_reported",
  reportedAt: "2025-06-15T00:00:00.000Z",
};

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: "api-test@compscope.dev",
      name: "API Test",
      passwordHash: hashPassword("test12345"),
    })
    .onConflictDoNothing();
  await db
    .insert(sessions)
    .values({
      id: randomBytes(12).toString("hex"),
      token: TEST_TOKEN,
      userId: TEST_USER_ID,
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(compensation).where(eq(compensation.submittedBy, TEST_USER_ID));
  await db.delete(sessions).where(eq(sessions.userId, TEST_USER_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
});

describe("GET /api/compensation", () => {
  it("returns paginated records with the expected shape", async () => {
    const res = await GET(new NextRequest(`${URL}?limit=5&page=1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(5);
    expect(json.pagination).toMatchObject({ page: 1, limit: 5 });
    expect(json.pagination.total).toBeGreaterThan(1000);
    const row = json.data[0];
    expect(row).toMatchObject({
      company: { name: expect.any(String), slug: expect.any(String) },
      baseSalary: expect.any(Number),
      totalCompensation: expect.any(Number),
      canonicalLevel: { id: expect.any(String), name: expect.any(String) },
    });
  });

  it("rejects malformed query parameters", async () => {
    const res = await GET(new NextRequest(`${URL}?page=abc&limit=5`));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects out-of-range limit", async () => {
    const res = await GET(new NextRequest(`${URL}?limit=5000`));
    expect(res.status).toBe(400);
  });

  it("filters by company", async () => {
    const res = await GET(new NextRequest(`${URL}?company=google&limit=100`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.every((r: { company: { slug: string } }) => r.company.slug === "google")).toBe(true);
  });

  it("filters by location including alias variants", async () => {
    const res = await GET(new NextRequest(`${URL}?location=bangalore&limit=100`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.every((r: { location: { slug: string } }) => r.location.slug === "bengaluru")).toBe(true);
  });

  it("sorts by total compensation descending", async () => {
    const res = await GET(new NextRequest(`${URL}?sort=tc_desc&limit=50`));
    expect(res.status).toBe(200);
    const json = await res.json();
    const totals = json.data.map((r: { totalCompensation: number }) => r.totalCompensation);
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i - 1]).toBeGreaterThanOrEqual(totals[i]);
    }
  });

  it("returns an empty page beyond available pages without crashing", async () => {
    const res = await GET(new NextRequest(`${URL}?page=9999&limit=20`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(0);
    expect(json.pagination.page).toBe(9999);
    expect(json.pagination.totalPages).toBeGreaterThan(1);
  });

  it("returns empty results for unknown search terms", async () => {
    const res = await GET(new NextRequest(`${URL}?q=zzzz-no-match-zzzz`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(0);
    expect(json.pagination.total).toBe(0);
  });
});

describe("POST /api/compensation", () => {
  it("rejects unauthenticated submissions", async () => {
    sessionToken = null;
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    sessionToken = TEST_TOKEN;
  });

  it("accepts a valid submission and computes TC server-side", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.totalCompensation).toBe(
      VALID_PAYLOAD.baseSalary + VALID_PAYLOAD.annualBonus + VALID_PAYLOAD.annualStock,
    );
    expect(json.data.canonicalLevel).toBe("C4 · Mid");
  });

  it("defaults missing bonus and stock to 0", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      company: "Microsoft",
      companyLevel: "63",
      annualBonus: undefined,
      annualStock: undefined,
      baseSalary: 2_100_000,
      yearsExperience: 7,
    };
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.totalCompensation).toBe(2_100_000);
  });

  it("rejects negative base salary", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({ ...VALID_PAYLOAD, baseSalary: -100 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unknown companies", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({ ...VALID_PAYLOAD, company: "Totally Unknown Corp" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("COMPANY_NOT_FOUND");
  });

  it("rejects unknown roles", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({ ...VALID_PAYLOAD, role: "role-nonexistent" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects unconfigured company levels", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({ ...VALID_PAYLOAD, companyLevel: "L99" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("LEVEL_NOT_FOUND");
  });

  it("rejects currency/location mismatch", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({ ...VALID_PAYLOAD, location: "Seattle", currency: "INR" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate submissions", async () => {
    // Distinct base salary so this payload has its own dedupe key, separate
    // from the "valid submission" test above.
    const dupPayload = { ...VALID_PAYLOAD, baseSalary: 4_050_000 };
    const first = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify(dupPayload),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(first.status).toBe(201);

    const second = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify(dupPayload),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("DUPLICATE_COMPENSATION");
  });

  it("ignores client-supplied totalCompensation", async () => {
    const res = await POST(
      new NextRequest(URL, {
        method: "POST",
        body: JSON.stringify({
          ...VALID_PAYLOAD,
          company: "Amazon",
          companyLevel: "SDE II",
          location: "Hyderabad",
          baseSalary: 2_800_000,
          totalCompensation: 999_999_999,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.totalCompensation).not.toBe(999_999_999);
    // Zod strips unknown keys, so the server computes from components.
    expect(json.data.totalCompensation).toBe(
      2_800_000 + (VALID_PAYLOAD.annualBonus ?? 0) + (VALID_PAYLOAD.annualStock ?? 0),
    );
  });
});
