# Competitor Analysis — Compensation Intelligence Products

Research date: 2026-01. Sources: public product surfaces of Levels.fyi, 6figr, AmbitionBox, Glassdoor.

## What we studied

For each product we extracted: major user workflows, information architecture, compensation dimensions, leveling approach, company pages, filtering behavior, comparison behavior, visualization patterns, contribution workflows, strengths, weaknesses, and UX patterns worth adopting (or explicitly avoiding).

## Levels.fyi

- **Core workflow:** pick a level/company/role → see distribution → compare offers. Strong level-centric model (L3/L4/L5, 62/63/64, SDE II, E4/E5…).
- **IA:** role → company → level → location facets; salary, bonus, stock broken out; "total compensation" as the headline number.
- **Leveling:** the strongest part of the product. Levels are the primary unit of comparison. Company-specific levels are kept and mapped to rough bands.
- **Company pages:** aggregates per company with distributions, recent data, breakdown by level/location.
- **Filtering:** role + location + company + level; facets are explicit and URL-shareable.
- **Comparison:** side-by-side offer comparison; charts show comp distribution.
- **Viz:** box/histogram-style distributions, scatter of individual points.
- **Contribution:** structured form with salary, bonus, stock, level, years, location.
- **Strengths:** level-aware, transparent components, good charts, contribution flywheel.
- **Weaknesses:** verification is weak; company-level mapping is approximate; some cohorts are tiny but presented with false precision.
- **Adopt:** level-first comparison, component split (base/stock/bonus), distribution charts, structured contribution.
- **Avoid:** presenting tiny samples with strong certainty; opaque normalization.

## 6figr

- **Core workflow:** search title/company → salary report (min/max/median) → company reports → comparisons.
- **IA:** keyword search → report pages; aggregates (min, max, median) per role.
- **Leveling:** mostly title-based; level separation is weaker than Levels.fyi.
- **Company pages:** company salary pages with title-level aggregates.
- **Filtering:** title, company, location, experience.
- **Comparison:** company vs company and role vs role.
- **Viz:** bar charts, range charts, percentile bands.
- **Contribution:** anonymous salary submission.
- **Strengths:** clean reports, good SEO structure, percentile framing.
- **Weaknesses:** title ≠ level; "Software Engineer" mixes junior and senior; methodology opacity; heavy SEO templating with little data.
- **Adopt:** percentile framing (P25/P50/P75/P90), clean report pages, salary ranges.
- **Avoid:** mixing levels inside a single title aggregate without disclosure; thin SEO pages.

## AmbitionBox

- **Core workflow:** browse company → reviews + salaries → interview questions. India-centric.
- **IA:** company hub → reviews / salaries / interviews / benefits.
- **Leveling:** none meaningful — title + years of experience only.
- **Company pages:** rich (reviews, ratings, salaries), but salary aggregates are title-level.
- **Filtering:** department, location, experience.
- **Viz:** simple bars and tables.
- **Contribution:** review + salary forms.
- **Strengths:** deep company content, India market coverage, strong review corpus.
- **Weaknesses:** no level model; title inflation makes aggregates noisy; monetization walls hurt UX.
- **Adopt:** India-market location coverage, rich company context, experience bands.
- **Avoid:** mixing all seniorities in one number; paywalls on core data.

## Glassdoor

- **Core workflow:** search job/company → salary estimates → reviews → jobs.
- **IA:** job-centric, employer branding, "market estimates" ML-generated.
- **Leveling:** none; title + location.
- **Company pages:** broad (reviews, salaries, interviews, benefits, photos).
- **Viz:** range/histogram charts; ML estimates labeled as estimates.
- **Strengths:** massive dataset, brand trust, good range visualization.
- **Weaknesses:** title-level mixing, estimates not derived from visible data, heavy monetization walls, content sprawl.
- **Adopt:** labeled estimates, ranges not points, big dataset behavior.
- **Avoid:** opaque ML estimates presented without inputs; walled core flows.

## Comparison table

| Feature | Levels.fyi | 6figr | AmbitionBox | Glassdoor | CompScope | Build? |
| ------- | ---------- | ----- | ----------- | --------- | --------- | ------ |
| Level-aware comparison | Yes | Weak | No | No | **Yes — canonical + company-level model** | ✅ |
| Base / stock / bonus split | Yes | Partial | Partial | Partial | **Yes — always split** | ✅ |
| Percentile reporting (P25–P90) | Partial | Yes | No | Partial | **Yes — P25/P50/P75/P90 + min/max** | ✅ |
| Sample-size transparency | Partial | Weak | Weak | Weak | **Yes — coverage label per cohort** | ✅ |
| Company level → canonical mapping | Yes (implicit) | No | No | No | **Yes — explicit, labeled approximate** | ✅ |
| Company normalization (aliases) | Implicit | Implicit | Implicit | Implicit | **Yes — alias table + deterministic normalization** | ✅ |
| Location variants (Bangalore/Bengaluru) | Implicit | Implicit | Implicit | Implicit | **Yes — location alias resolution** | ✅ |
| Server-side filtering & pagination | Yes | Yes | Yes | Yes | **Yes — all in PostgreSQL** | ✅ |
| URL-driven filters | Yes | Partial | Partial | Partial | **Yes — full state in query params** | ✅ |
| 2–3 company comparison | Yes | Yes | No | Partial | **Yes — cohort-scoped** | ✅ |
| Deterministic insights | No | No | No | No | **Yes — rule-based, derived from DB values** | ✅ |
| Structured contribution form | Yes | Yes | Yes | Yes | **Yes — server-validated, deduped** | ✅ |
| Verification claims | "Verified" tag (weak) | No | No | "Estimate" labels | **No — demo data labeled synthetic** | ✅ |
| Compensation mix (base/stock/bonus %) | Partial | No | No | No | **Yes — explicit mix engine** | ✅ |
| Location differential | Implicit | No | No | No | **Yes — within-cohort only** | ✅ |
| Auth-gated submission | Yes | Yes | Yes | Yes | **Yes — credential auth + session** | ✅ |
| Paywalls on core data | No | No | Yes | Yes | **No** | ❌ |
| ML/opaque estimates | No | Yes (salary report) | No | Yes (market est.) | **No — deterministic only (AI optional, grounded)** | ❌ |

## Cross-cutting conclusions

1. **Levels are the single biggest missing axis in 3 of 4 competitors.** CompScope's canonical-level model is the differentiator — not a nicer table.
2. **Every product struggles with "company name hygiene" and "location hygiene"** but none expose it as a first-class model. CompScope makes normalization explicit (CompanyAlias, Location alias map).
3. **Percentiles beat averages.** All products that show ranges feel more trustworthy. CompScope always reports P25/P50/P75/P90 + sample size + coverage label.
4. **Tiny cohorts with false precision erode trust.** CompScope gates language by coverage label and never hides n.
5. **Contribution must be structured and deduped** — otherwise the corpus degrades. CompScope enforces server-side validation, canonical resolution, deterministic dedupe keys, and DB-level unique constraints.
6. **Opaque AI estimates are a trust liability.** CompScope computes deterministic analytics first; AI only summarizes a factual payload (optional).
7. **Paywalls on core data poison the UX loop.** CompScope keeps all intelligence free.
