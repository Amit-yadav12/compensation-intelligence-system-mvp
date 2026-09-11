# Interview Notes — Explainable Decisions

Concise answers for the most likely architecture questions about CompScope.

**Why PostgreSQL?** The product's correctness is its constraints: duplicate
protection (`dedupe_key` UNIQUE), non-negative money, and
`total = base + bonus + stock` are declarative CHECK/UNIQUE constraints —
race-safe in a way application code can never be. We also need grouped
aggregates and percentile queries, which are first-class in SQL.

**Why Drizzle (the brief said Prisma)?** The environment provisions Drizzle;
both are typed, migration-first relational ORMs. The schema concepts are
identical. Drizzle keeps us on real SQL, so aggregates and index usage are
predictable — important for an analytics-heavy app.

**Why Next.js Route Handlers?** One deployment for UI and API. Server
Components fetch through the same service layer the handlers use, so there is
one business-logic path. Handlers stay thin: parse → validate → service → DTO.

**Why a modular monolith?** The dominant cost at this scale is complexity. One
app, one schema, one connection pool, one deploy. Module boundaries keep it
testable: normalization is pure, stats is pure, services orchestrate I/O.
Microservices would add network failure modes we don't need.

**Why separate CompanyAlias?** Company identity must be deterministic and
auditable. “Google India Pvt. Ltd.” resolves through a pure normalization
pipeline into a controlled alias vocabulary — every merge is a data row, not a
fuzzy guess. Fuzzy matching can suggest, but never define identity.

**Why CanonicalLevel and CompanyLevel separately?** Because Google L4 ≠ Microsoft
62 literally — they're *comparable*, not equal. Keeping both lets us show the
company's own level AND the comparison group, label the mapping approximate,
and refine mappings per company without touching others. This is the product
thesis: levels matter more than titles.

**Why calculate TC on the server?** A client-supplied total is tamper-prone and
infects every aggregate. One function (`calculateTotalCompensation`) computes
it, a unit test suite pins it, and a Postgres CHECK constraint re-enforces it.
We even test submitting `total: 999999999` and assert it's ignored.

**Why database-backed deduplication?** Application checks race: two concurrent
submissions both pass the check and both insert. The unique index on a
deterministic `dedupe_key` (company + role + level + location + components +
experience + month) is the only race-safe authority. We surface SQLSTATE 23505
as a clean 409 DUPLICATE_COMPENSATION.

**Why server-side pagination?** Fetching thousands of rows to filter in React is
slow, leaks the whole dataset, and breaks URL-shareable state. The explorer
pushes WHERE/ORDER BY/LIMIT/OFFSET into PostgreSQL via Drizzle — two queries
(data + count), indexed, and the entire filter state lives in the URL.

**Why deterministic analytics before AI?** Every number must be traceable to
SQL. Percentiles, mix ratios and differentials live in one pure, tested module;
insights are deterministic rules over those values. An AI layer can summarize a
structured factual payload — it never estimates a salary.

**Why synthetic data?** The dataset demonstrates the system (querying,
normalization, analytics, dedupe) without fabricating claims of verified
employee data. Every record is labeled `unverified`, and the UI says so.

**Why these indexes?** Only query patterns get indexes: FKs used as equality
filters (`company_id`, `location_id`, `canonical_level_id`, `role_id`,
`role_family_id`), sort columns (`total_compensation`, `reported_at`), and two
composites matching the hottest aggregate shapes — company pages
`(company_id, canonical_level_id)` and cohort benchmarks
`(location_id, canonical_level_id)`. Identity lookups reuse unique indexes.

**Why URL-driven filters?** Shareable links, refresh persistence, back/forward
support, easier debugging, and testability — the E2E suite asserts URLs like
`/compensation?company=google&level=l4&location=bengaluru`.

**Why scrypt + DB sessions instead of a heavy auth framework?** Credential auth
needs four things: password hashing, random session tokens, an httpOnly cookie,
and a sessions table with expiry. Adding a dependency would add surface without
adding security. Same error for unknown email and wrong password prevents
enumeration; SameSite=Lax covers CSRF for POST.

**What would you do differently at scale?** Move percentile computation into
SQL (`percentile_cont`) or pre-aggregated rollup tables for cohort queries, add
read replicas, and queue the alias-suggestion pipeline. None of these change
the architecture — they're optimizations inside the same monolith.

**Why Zod?** Runtime validation at the trust boundary with inferred TypeScript
types — one schema is both the validator and the type. Coercion handles query
strings; `.refine` handles cross-field rules (minTC ≤ maxTC); unknown keys
(like a client `totalCompensation`) are stripped by default.

**Why not Elasticsearch?** Search is a secondary feature over ~10⁴ rows with a
small controlled vocabulary; `ILIKE` plus an alias subquery on indexed columns
answers it in milliseconds. Elasticsearch would add a second source of truth,
sync lag and ops burden for no user-visible gain.

**Why not an AI-first architecture?** Every displayed number must be traceable
to a SQL query and a pure function. An LLM cannot provide that guarantee; it can
only *summarize* facts we already computed. So the architecture is analytics-
first with an optional, grounded explanation layer — never the reverse.

**How is "company vs market" computed honestly?** Per canonical level, in the
company's primary currency, only when both the company and the market have ≥3
records at that level; the headline insight is weighted by the company's
record count. It is never a single company-wide median against a single
market-wide median (which would mix levels — the exact failure mode the product
exists to avoid).

**How does percentile positioning avoid false precision?** Empirical rank
(below + ½ equal) ÷ n, shown only when the cohort has ≥5 records, always with
the coverage label and the sample size next to it, and with the methodology
stated on the page itself.
