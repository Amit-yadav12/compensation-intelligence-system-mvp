# CompScope

**Level-aware compensation intelligence.**

CompScope turns fragmented compensation records into comparable market
intelligence by normalizing company, role, level and location — and keeping
base salary, bonus, stock and total compensation separate.

> **Live Demo:** _[deployment URL placeholder — Vercel + Neon]_
>
> **Repository:** _[repository URL placeholder]_

---

## 1. Problem

Salary sites mix seniorities inside job titles, trust raw company text as
identity, and present averages without sample sizes. The result: numbers that
look precise but aren't comparable.

## 2. Product thesis

> **Levels matter more than job titles.**

A “Software Engineer” at Google and at a startup are not the same cohort.
CompScope compares compensation only within **matched cohorts**: role family +
role + canonical level + location (+ optional experience band).

## 3. Features

- **Compensation Explorer** (`/compensation`) — search, filter, sort, paginate
  over every record. All filtering is server-side; the full filter state lives
  in the URL.
- **Company Intelligence** (`/companies/[slug]`) — snapshot (median TC/base/stock/bonus),
  compensation by level (P25/median/P75/P90 + n), compensation mix, by-location
  and by-role-family tables, the company-level→canonical-level mapping,
  freshness, coverage labels, deterministic insights.
- **Smart Comparison** (`/compare`) — 2–3 companies within one cohort: median
  components side by side, market median reference, mix chart, insights.
- **Benchmark** (`/benchmark`) — min/P25/median/P75/P90/max for any cohort,
  leaderboard, location differentials (same-currency, matched-cohort only).
- **Record positioning** (`/compensation/[id]`) — one record's empirical
  percentile rank inside its role × level × location cohort, vs cohort median
  and vs its own company's median, with methodology stated inline.
- **Company vs market** — per canonical level, company median against the
  level-matched market median in the same currency (≥3 records on both sides),
  plus a weighted "X% above/below market" insight.
- **Submission** (`/submit`) — authenticated, server-validated, deduplicated
  submissions grouped into Identity / Role / Level / Experience / Compensation /
  Source / Additional. Live TC preview uses the same domain function the server
  uses. Total compensation is computed on the server.
- **Methodology** (`/methodology`) — every formula, normalization rule, coverage
  threshold and data limitation in one place.
- **Auth** — signup / login / logout (scrypt + DB sessions + httpOnly cookies).

## 4. Screenshots

_[Add screenshots: dashboard, explorer, company page, compare, benchmark, submit]_

## 5. Architecture

Modular monolith (Next.js App Router) with clean boundaries:

```
UI (RSC + client components)
 → Route Handlers (parse, validate, authorize)
 → Zod validation
 → Domain services (compensation, benchmark, comparison, analytics)
 → Normalization (company, location, level) + Analytics (stats, insights)
 → Drizzle ORM
 → PostgreSQL
```

Full diagram and rationale: [`docs/architecture.md`](docs/architecture.md),
[`docs/architecture-decisions.md`](docs/architecture-decisions.md),
[`docs/interview-notes.md`](docs/interview-notes.md).

## 6. Data model

Normalized relational schema (`src/db/schema.ts`):

`users · sessions · companies · company_aliases · role_families · roles ·
canonical_levels · company_levels · locations · compensation`

Key integrity:

- `compensation.dedupe_key` UNIQUE — race-safe duplicate protection
- CHECK: components ≥ 0; `total_compensation = base + bonus + stock`
- FK + unique constraints on all identity columns; indexes on every hot filter
  (documented per index in the schema file)

## 7. API overview

| Endpoint | Purpose |
| --- | --- |
| `GET /api/compensation` | Explorer — `q, company, roleFamily, role, canonicalLevel, location, minTC, maxTC, minExperience, maxExperience, sort, page, limit` |
| `GET /api/compensation/[id]` | One record (DTO) |
| `GET /api/compensation/[id]/position` | Percentile rank of a record inside its cohort |
| `POST /api/compensation` | Submit (auth required, server-validated, deduped) |
| `GET /api/companies` · `GET /api/companies/[id]` · `GET /api/companies/[id]/analytics` | Company index + intelligence |
| `GET /api/role-families` · `GET /api/roles` · `GET /api/levels` · `GET /api/locations` · `GET /api/company-levels` | Controlled vocabularies |
| `GET /api/benchmark` | Cohort percentiles + leaderboard + differentials |
| `GET /api/compare` | 2–3 companies in one cohort (repeated `company` param) |
| `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Credential auth |

Every error has a stable shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Base salary must be ≥ 0." } }
```

Codes: `VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, COMPANY_NOT_FOUND,
ROLE_NOT_FOUND, LEVEL_NOT_FOUND, LOCATION_NOT_FOUND, NOT_FOUND,
DUPLICATE_COMPENSATION, INTERNAL_ERROR`.

## 8. Normalization

- **Company** — trim → lowercase → punctuation → whitespace → legal-suffix
  removal → `company_aliases` → canonical `Company`
  (`“Google India Pvt. Ltd.”` → `google`).
- **Location** — same hygiene + alias map (`Bangalore → Bengaluru`,
  `Gurgaon → Delhi NCR`, `SF → San Francisco Bay Area`).
- **Level** — exact resolution against `company_levels`; mappings are explicit
  data, always labeled **approximate**.

## 9. Compensation calculation

`total = base + bonus + stock`, computed **server-side only**
(`src/lib/domain/compensation.ts`), pinned by unit tests, re-enforced by a
database CHECK constraint. Missing bonus/stock → 0. Negative values → rejected
by Zod and clamped by the domain function.

## 10. Benchmark methodology

Linear-interpolation quantiles (numpy-equivalent) computed in one pure module.
Coverage labels: **n < 10 low · 10–49 moderate · 50+ strong** — a transparency
signal, never a claim of statistical confidence. Location differentials only
within the same role + level + currency.

## 11. Dataset

**The demonstration dataset is synthetic** and intended to demonstrate system
architecture, querying, analytics and workflows. It is **not** presented as
verified employee-reported compensation data.

Deterministic seed (`src/db/seed.ts`, fixed PRNG): **60 companies, 12 role
families, 68 roles, 10 canonical levels, 18 locations, 322 company-level
mappings, ~6,400 compensation records**. Company names, public ladder naming
conventions (Google L3–L9, Microsoft 59–67, Amazon SDE I–III, Meta E3–E7,
bank Analyst→MD, IT-services bands) and broad package archetypes are real;
the compensation figures are modeled, not collected. The generator applies
level × company tier × location factor × role premium (ML/EM premium, QA
discount) with independent variance on base, stock and bonus so distributions
are realistic enough for percentiles, comparisons and mix charts. Every record
is `unverified`; the UI says so on every surface.

## 12. Testing

- **Unit** (`tests/unit/`) — TC calculation, all three normalizers, dedupe key,
  percentiles, mix, differentials.
- **API** (`tests/api/`) — route handlers exercised directly: valid/invalid
  submissions, negative salary, missing bonus/stock, client-supplied totals
  ignored, duplicates (409), unknown entities, malformed query params,
  pagination, filtering, sorting, company analytics (vs-market rows, no
  sensitive fields), benchmark (ordering of percentiles, currency isolation,
  empty cohorts), compare (approximation note, 3-company cap), positioning.
- **E2E** (`tests/e2e/`) — Playwright flows: search → filter → company →
  compare → benchmark, and login → submit → validation → success → duplicate.

```bash
npm test                           # unit + API (82 tests; needs the seeded DB)
npx playwright install --with-deps chromium
npm run build && npm run start
npx playwright test                # E2E against localhost:3000
```

## 13. Setup

```bash
# 1. PostgreSQL (local or Neon)
createdb app_db

# 2. Environment
cp .env.example .env              # set DATABASE_URL

# 3. Dependencies
npm install

# 4. Schema + seed
npm run db:push
npm run db:seed

# 5. Run
npm run dev
```

Demo account: **demo@compscope.dev / demo1234**

## 14. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Server-side only — never `NEXT_PUBLIC_`. |

## 15. Deployment

- **Vercel** — import the repo; set `DATABASE_URL` to the Neon connection
  string. Build command: `npm run build`.
- **Neon** — create a project, run `npx drizzle-kit push` against it, then
  `npx tsx src/db/seed.ts` (point `DATABASE_URL` at the branch).
- No background workers or external services required.

## 16. Tradeoffs

- Two currencies (INR/USD); comparisons are always within one currency — no
  FX conversion (deliberate; FX introduces unstated assumptions).
- Canonical levels are a 10-rung ladder; richer mapping (lattice by country)
  is future work.
- Analytics compute percentiles in the service from numeric columns rather
  than `percentile_cont` in SQL — simpler to test, fine for cohort sizes here.
- Auth is purpose-built (scrypt + sessions) rather than a third-party IdP —
  fewer dependencies, fully auditable.

## 17. Future improvements

Richer level mappings · source verification workflow · confidence intervals ·
real salary ingestion integrations · anomaly detection · pre-aggregated
rollup tables for cohort queries · multilingual support · grounded AI
explanations over the structured analytics payload · compensation trajectory
analysis.

## 18. AI-assisted development disclosure

Implementation was accelerated by AI pair-programming; every architectural
decision, domain invariant, and test was authored and reviewed by the
candidate. All data is synthetic and labeled as such.
