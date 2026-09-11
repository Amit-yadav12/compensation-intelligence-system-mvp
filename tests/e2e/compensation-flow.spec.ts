import { test, expect } from "@playwright/test";

/**
 * E2E flows for CompScope. Requires a running server (npm run start) with a
 * seeded database. These exercise the full stack: UI → API → validation →
 * services → PostgreSQL.
 */

test.describe("Compensation intelligence flow", () => {
  test("home → search → filter → company page", async ({ page }) => {
    // Home
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Understand your compensation market." }),
    ).toBeVisible();
    await expect(page.getByText("Compensation records")).toBeVisible();

    // Search
    await page
      .getByRole("searchbox", { name: "Search company, role or level" })
      .fill("software engineer");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/compensation\?q=software\+engineer/);
    await expect(page.getByRole("heading", { name: "Compensation Explorer" })).toBeVisible();

    // Apply a company filter (URL must reflect it)
    await page.getByRole("button", { name: "Show filters" }).click();
    await page.getByLabel("Filter by company").selectOption({ label: "Google" });
    await expect(page).toHaveURL(/company=google/);
    await expect(page.getByRole("link", { name: "Google" }).first()).toBeVisible();

    // Open a company page
    await page.getByRole("link", { name: "Google" }).first().click();
    await expect(page.getByRole("heading", { name: "Google" })).toBeVisible();
    await expect(page.getByText("Compensation by level")).toBeVisible();
    await expect(page.getByText("Level mapping")).toBeVisible();
  });

  test("compare companies within a cohort", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Smart comparison" })).toBeVisible();

    // Select 3 companies
    await page.getByRole("button", { name: /Google/ }).click();
    await page.getByRole("button", { name: /Microsoft/ }).click();
    await page.getByRole("button", { name: /Amazon/ }).click();

    // Cohort
    await page.getByLabel("Role family *").selectOption({ label: "Software Engineering" });
    await page.getByLabel("Role *").selectOption({ label: "Software Engineer" });
    await page.getByLabel("Canonical level *").selectOption({ label: "C4 · Mid" });
    await page.getByLabel("Location *").selectOption({ label: "Bengaluru" });
    await page.getByRole("button", { name: /Compare/ }).click();

    await expect(page.getByRole("heading", { name: "Side-by-side" })).toBeVisible();
    await expect(page.getByText("Median total compensation")).toBeVisible();
    await expect(page.getByText("Insights")).toBeVisible();
    // Approximation notice must be present
    await expect(page.getByText(/approximation/i).first()).toBeVisible();
  });

  test("record detail shows percentile positioning; methodology page renders", async ({ page }) => {
    await page.goto("/compensation?company=google&canonicalLevel=c4&location=bengaluru&sort=tc_desc");
    // Active filter chips reflect URL state
    await expect(page.getByLabel("Remove filter Company: google")).toBeVisible();
    // Open the first record via its total-compensation link
    await page.getByTitle("View record and percentile position").first().click();
    await expect(page).toHaveURL(/\/compensation\/[a-f0-9]+/);
    await expect(page.getByText("Position within cohort")).toBeVisible();
    await expect(page.getByText(/Percentile rank/i)).toBeVisible();

    await page.goto("/methodology");
    await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
    await expect(page.getByText("The demonstration dataset is synthetic.")).toBeVisible();
  });

  test("benchmark a cohort", async ({ page }) => {
    await page.goto("/benchmark");
    await page.getByLabel("Role family *").selectOption({ label: "Software Engineering" });
    await page.getByLabel("Role *").selectOption({ label: "Software Engineer" });
    await page.getByLabel("Canonical level *").selectOption({ label: "C4 · Mid" });
    await page.getByLabel("Location *").selectOption({ label: "Bengaluru" });
    await page.getByRole("button", { name: "Run benchmark" }).click();

    await expect(page).toHaveURL(/canonicalLevel=c4/);
    await expect(page.getByText("Total compensation distribution")).toBeVisible();
    await expect(page.getByText("Median total comp.")).toBeVisible();
  });
});

test.describe("Submission flow", () => {
  test("login → invalid salary → server validation → valid submit → duplicate", async ({ page }) => {
    // Login with the demo account
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@compscope.dev");
    await page.getByLabel("Password").fill("demo1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(compensation|submit|compare|benchmark)?/);

    // Go to submit — must not redirect back to login
    await page.goto("/submit");
    await expect(page.getByRole("heading", { name: "Submit compensation" })).toBeVisible();

    // Invalid base salary — client and server both reject
    await page.getByLabel("Company *").fill("Google");
    await page.getByLabel("Location *").fill("Bengaluru");
    await page.getByLabel("Role family *").selectOption({ label: "Software Engineering" });
    await page.getByLabel("Role *").selectOption({ label: "Software Engineer" });
    await page.getByLabel("Company-specific level *").fill("L5");
    await page.getByLabel("Base salary *").fill("-500");
    await page.getByLabel("Years of experience *").fill("5");
    await page.getByRole("button", { name: "Submit compensation" }).click();
    await expect(page.getByText(/non-negative/i).first()).toBeVisible();

    // Valid submission
    await page.getByLabel("Base salary *").fill("4200000");
    await page.getByLabel("Annual bonus").fill("600000");
    await page.getByLabel("Annual stock").fill("900000");
    await page.getByRole("button", { name: "Submit compensation" }).click();
    await expect(page.getByText("Record accepted")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("₹57.0L").first()).toBeVisible();

    // Submit again — duplicate protection
    await page.getByRole("button", { name: "Submit another record" }).click();
    await page.getByLabel("Company *").fill("Google");
    await page.getByLabel("Location *").fill("Bengaluru");
    await page.getByLabel("Role family *").selectOption({ label: "Software Engineering" });
    await page.getByLabel("Role *").selectOption({ label: "Software Engineer" });
    await page.getByLabel("Company-specific level *").fill("L5");
    await page.getByLabel("Base salary *").fill("4200000");
    await page.getByLabel("Annual bonus").fill("600000");
    await page.getByLabel("Annual stock").fill("900000");
    await page.getByLabel("Years of experience *").fill("5");
    await page.getByRole("button", { name: "Submit compensation" }).click();
    await expect(page.getByText(/Duplicate record/i)).toBeVisible({ timeout: 20_000 });
  });

  test("unauthenticated user is redirected from /submit", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/login/);
  });
});
