# Architecture Decision Records

## ADR-001 — Why PostgreSQL

**Context.** We need transactional integrity, unique constraints (dedupe keys,
canonical identities), check constraints (money invariants), and rich
aggregation (percentiles, group-bys) over relational data.

**Decision.** PostgreSQL as the single system of record.

**Alternatives.** MongoDB (weaker integrity — dedupe would be application-level
and racy), Elasticsearch (overkill — full-text search is a secondary feature
provided by ILIKE/subqueries), Redis (no relational constraints).

**Reason.** The product’s correctness IS its constraints: duplicate protection,
non-negative money, `total = base + bonus + stock`. All are declarative in
Postgres. Grouped analytics and window functions are first-class.

**Tradeoff.** Requires a managed service (Neon) instead of a free JSON store —
worth it for data integrity.

## ADR-002 — Why Drizzle ORM (the assignment specified Prisma)

**Context.** The brief names Prisma; the target environment provisions
PostgreSQL with Drizzle ORM and a typed schema pipeline (`drizzle-kit push`).

**Decision.** Use Drizzle ORM with the same conceptual schema the brief
requires: normalized tables, migrations via `drizzle-kit`, explicit indexes,
typed query builder.

**Alternatives.** Prisma (not provisioned; would fight the environment), raw
`pg` (loses type safety), Kysely (also fine, but not the environment default).

**Reason.** Both Prisma and Drizzle are migration-first, typed relational ORMs.
The domain model, invariants and index design are identical; only the schema DSL
and query builder differ. Drizzle keeps us on SQL (no N+1 surprises, predictable
aggregates) and deploys cleanly on Vercel + Neon.

**Tradeoff.** Less “magic” than Prisma (no generated client) — but that means
fewer hidden queries and easier reasoning, which suits an analytics-heavy app.

## ADR-003 — Why a modular monolith

**Context.** The product needs four workflows (explorer, company intelligence,
comparison, submission) plus auth and analytics.

**Decision.** One Next.js app with clean module boundaries: `api → services →
normalization/analytics → db`. No microservices, no event bus, no Redis.

**Alternatives.** Separate API + frontend, serverless function per entity,
event-sourced ingestion pipeline.

**Reason.** At this scale the dominant cost is complexity, not throughput.
A monolith shares one connection pool, one schema, one deploy. Module
boundaries (services never import route handlers; normalization has no I/O
dependencies except one resolver function) keep the code testable.

**Tradeoff.** Service boundaries are conventions, not enforced by runtime
isolation — acceptable for a team that can hold the whole system in their head.

## ADR-004 — Why server-side total-compensation calculation

**Context.** Clients could send `totalCompensation` alongside components.

**Decision.** The server ignores any client total and computes
`total = base + bonus + stock` in one place
(`lib/domain/compensation.ts`), with a database CHECK constraint enforcing the
same invariant.

**Alternatives.** Trust client totals (tamper-prone, breaks analytics), compute
in the database only (harder to test in isolation).

**Reason.** One invariant, one implementation, tested at unit/API level and
re-enforced by the database. A test literally submits `total: 999999999` and
asserts the stored value differs.

**Tradeoff.** None meaningful — the client gets the computed value back.

## ADR-005 — Why company aliases

**Context.** “Google”, “Google India Pvt. Ltd.”, “Alphabet” must be one company.
Raw text is dirty and unbounded.

**Decision.** A `company_aliases` table (data, not code) plus a deterministic
normalization pipeline that strips legal suffixes and punctuation before alias
lookup.

**Alternatives.** Fuzzy matching (non-deterministic, wrong merges), a giant
regex in code (brittle, unmaintainable).

**Reason.** Identity resolution must be deterministic and auditable: every merge
is a row you can inspect, and adding an alias requires no deploy. Fuzzy matching
stays available as a *suggestion* mechanism in the future — never as truth.

**Tradeoff.** New variants not covered by the pipeline return
COMPANY_NOT_FOUND (a clear, honest error) instead of a silent wrong merge.

## ADR-006 — Why canonical level and company level are separate tables

**Context.** Google L4, Microsoft 62 and Amazon SDE II are not literally
identical, but comparison requires a shared grouping.

**Decision.** `company_levels` (what the company calls the level) maps to
`canonical_levels` (C1–C10 comparison groups) via explicit data. The UI always
shows both and labels the mapping *approximate*.

**Alternatives.** A single “level” text column (mixing seniorities — the core
sin of title-only salary sites), ML-inferred equivalence (opaque, untestable).

**Reason.** This is the product thesis: *levels matter more than titles*. The
separation keeps mappings honest, refinable (remap one company without touching
others) and explainable in an interview.

**Tradeoff.** Mappings require curation per company — accepted, because wrong
mappings are worse than missing ones.

## ADR-007 — Why deterministic analytics precede AI

**Context.** LLMs are tempting for “salary insights”.

**Decision.** All numbers come from SQL → one pure stats module → deterministic
insight rules. An AI feature (if added) receives a structured factual payload
(`googleMedianTC`, `googleStockShare`, sample sizes…) and may only summarize it.

**Alternatives.** Ask an LLM to estimate salaries from world knowledge.

**Reason.** Data integrity is the product. An LLM that invents a median
compensation destroys trust faster than any feature adds it. Deterministic
analytics is testable, versionable, and honest about its inputs (sample size is
always shown).

**Tradeoff.** Insights read more mechanical than LLM prose — a deliberate,
documented tradeoff for trust.
