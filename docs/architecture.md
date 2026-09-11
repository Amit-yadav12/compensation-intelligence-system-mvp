# CompScope — Architecture

## System overview

CompScope is a modular monolith: a single Next.js (App Router) application that
contains the UI, route handlers, domain services and analytics engine, backed by
one PostgreSQL database. The design goal is a system that answers:

> *“What is the compensation for this role at this level, in this location, and how
> does it compare with other companies at a comparable level?”*

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  Server Components (data)  ·  Client Components (interactivity)│
└───────────────┬──────────────────────────────────────────────┘
                │ fetch / server imports
┌───────────────▼──────────────────────────────────────────────┐
│ Next.js App Router                                           │
│  /compensation /companies/[slug] /compare /benchmark /submit │
├──────────────────────────────────────────────────────────────┤
│ Route Handlers (src/app/api/**)                              │
│  thin: parse → validate → call service → serialize           │
├──────────────────────────────────────────────────────────────┤
│ Validation (Zod)            Error model ({error:{code,msg}})  │
├──────────────────────────────────────────────────────────────┤
│ Domain services (src/lib/services)                           │
│  compensation · company · benchmark · comparison · analytics │
│  reference · cohort                                           │
├──────────────────────────────────────────────────────────────┤
│ Normalization (src/lib/normalization)   Analytics (src/lib)  │
│  company · location · level             stats · insights     │
│  domain/compensation (TC invariant)                          │
├──────────────────────────────────────────────────────────────┤
│ Drizzle ORM (typed SQL)                                      │
├──────────────────────────────────────────────────────────────┤
│ PostgreSQL (constraints, unique indexes, checks)             │
└──────────────────────────────────────────────────────────────┘
```

## Data flow (submission)

```
UI form
 → POST /api/compensation
 → Zod validation (compensationSubmissionSchema)
 → requireUser() (session cookie → sessions table)
 → compensation.service.createCompensation:
     resolveCompany("Google India Pvt. Ltd.") → normalization + alias → Company
     resolveRoleFamily / resolveRole (role must belong to family)
     resolveCompanyLevel(companyId, "L5") → CompanyLevel + CanonicalLevel
     resolveLocation("Bangalore") → Bengaluru
     currency check vs location currency
     calculateTotalCompensation(base, bonus, stock)   // server-side
     generateDedupeKey(...)
 → INSERT (dedupe_key UNIQUE backstops races; 23505 → 409 DUPLICATE_COMPENSATION)
 → DTO response (never the raw Prisma/Drizzle row)
```

## Data flow (query)

```
URL searchParams → Zod parse (malformed → VALIDATION_ERROR or safe defaults)
 → compensation.service.queryCompensation:
     dynamic WHERE (equality on indexed FKs + range on TC/experience)
     joins only to display entities (many-to-one, no fan-out)
     count(*) + data page in two queries
     ORDER BY sort column · LIMIT/OFFSET pagination
 → DTO { data: ExplorerRow[], pagination }
```

## Frontend architecture

- **Server Components** own data fetching: dashboard, explorer, company page,
  benchmark. They import services directly (no HTTP self-call) and read
  `searchParams` for URL-driven state.
- **Client Components** own interactivity: filter sidebar, sort control,
  compare workbench, forms. They never fetch “all records and filter in React”.
- **URL is the state** for explorer/benchmark: filters live in query params →
  shareable, refresh-safe, back/forward-friendly.
- **UI states**: every data surface has loading (skeletons / `loading.tsx`),
  empty (`EmptyState`), error (`error.tsx` / `ErrorState`).

## Database architecture

Normalized into: `users`, `sessions`, `companies`, `company_aliases`,
`role_families`, `roles`, `canonical_levels`, `company_levels`, `locations`,
`compensation`. Key constraints:

- `compensation.dedupe_key` UNIQUE — race-safe duplicate protection
- `compensation` CHECK: non-negative components, `total = base + bonus + stock`
- UNIQUE on company normalized name/slug, alias normalized text, role (family, name),
  company level (company, name), location normalized name/slug, level rank
- Indexes on every FK used as an equality filter, plus composites
  `(company_id, canonical_level_id)` and `(location_id, canonical_level_id)` for
  the two hottest aggregate shapes; `(total_compensation)` and `(reported_at)`
  for sort paths.

## Normalization

Three deterministic pipelines (pure functions, unit-tested):

- **Company**: trim → lowercase → punctuation → whitespace → legal-suffix
  removal (Pvt Ltd, Inc, LLC, Technologies…) → `CompanyAlias` lookup →
  canonical `Company`. Fuzzy matching is never used as truth.
- **Location**: same text hygiene + alias map (Bangalore→Bengaluru,
  Gurgaon→Delhi NCR, SF→Bay Area, NYC→New York). City/state/country are
  separate columns; currency is attached to the location.
- **Level**: exact match against `company_levels` (company-specific) which
  carries the configured canonical mapping. Mappings are explicit data, never
  inferred by a model, and labeled *approximate* in the UI.

## Intelligence surfaces

| Surface | Service | What it answers |
| --- | --- | --- |
| `/benchmark` | `benchmark.service` | Distribution (min…max), mix, leaderboard, location differentials for a cohort |
| `/compare` | `comparison.service` | 2–3 companies inside one cohort vs the cohort market median |
| `/companies/[slug]` | `analytics.service` | Snapshot, by level, mix, by location/role family, **vs market per level**, freshness, mapping |
| `/compensation/[id]` | `positioning.service` | Empirical percentile rank of one record in its cohort (n ≥ 5) |
| `/methodology` | — | Every formula and limitation, in prose |

## Analytics

One pure module (`lib/analytics/stats.ts`) defines quantile semantics (linear
interpolation), coverage labels (n<10 low / 10–49 moderate / 50+ strong),
mix ratios, location differentials. Every surface — benchmark, comparison,
company page — calls these primitives, so numbers agree everywhere.
Insights (`lib/analytics/insights.ts`) are deterministic rules over those
values. An AI layer, if ever added, receives the structured facts and may only
summarize them — it never computes statistics.

## Authentication

Scrypt password hashing (per-user salt), random session tokens in an
httpOnly/SameSite=Lax cookie, server-side `sessions` table with expiry.
`requireUser()` guards both the `/submit` page (redirect) and the POST API
(401). Same error for unknown email and wrong password (no enumeration).

## Deployment

- **Vercel**: standard Next.js deploy; `DATABASE_URL` points at Neon.
- **Neon**: PostgreSQL 16+. Run `npx drizzle-kit push` (or migrations) and
  `npx tsx src/db/seed.ts` once per environment.
- No background workers, queues or caches — the modular monolith scales with
  the app (connection pooling via Neon/PgBouncer is enough for this workload).
