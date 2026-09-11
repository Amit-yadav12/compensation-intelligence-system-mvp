import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageHeader, Badge } from "@/components/ui";
import { globalMetrics } from "@/lib/services/reference.service";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How CompScope computes total compensation, normalizes companies, locations and levels, and builds benchmarks — including limitations.",
};

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "total", title: "Total compensation" },
  { id: "levels", title: "Level normalization" },
  { id: "companies", title: "Company normalization" },
  { id: "locations", title: "Location normalization" },
  { id: "cohorts", title: "Cohorts & benchmarks" },
  { id: "percentiles", title: "Percentiles" },
  { id: "coverage", title: "Coverage indicator" },
  { id: "mix", title: "Compensation mix" },
  { id: "differentials", title: "Location differentials" },
  { id: "dedupe", title: "Duplicate protection" },
  { id: "limitations", title: "Data limitations" },
];

export default async function MethodologyPage() {
  const metrics = await globalMetrics();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Methodology"
        description="Every number in CompScope is computed from records in PostgreSQL through deterministic, unit-tested functions. This page explains exactly how — and where the method has limits."
      />

      <div className="grid gap-8 lg:grid-cols-4">
        <nav aria-label="Methodology sections" className="lg:sticky lg:top-[4.5rem] lg:self-start">
          <ol className="space-y-1 text-[13px]">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="focus-ring flex gap-2 rounded px-2 py-1 text-stone-600 hover:bg-stone-200/60 hover:text-stone-900">
                  <span className="tnum w-5 text-stone-400">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-4 lg:col-span-3">
          <Section id="total" title="Total compensation">
            <Formula>totalCompensation = baseSalary + annualBonus + annualStock</Formula>
            <p>
              Computed <strong>server-side only</strong>. Any total supplied by a client is discarded and
              recomputed. Missing bonus or stock is treated as <strong>0</strong>. Negative components are
              rejected at validation. A PostgreSQL <code>CHECK</code> constraint re-enforces the same
              equation, so the invariant holds even if application code is bypassed.
            </p>
            <p>
              Stock and bonus are <em>annualized</em> figures as reported. We do not model vesting
              schedules, cliffs, refreshers or stock-price movement.
            </p>
          </Section>

          <Section id="levels" title="Level normalization">
            <p>
              Each record stores two distinct things: the <strong>company-specific level</strong> (what
              the employer calls it — Google L4, Microsoft 62, Amazon SDE II) and a{" "}
              <strong>canonical level</strong> (C1 Entry → C10 Director) used only for comparison.
            </p>
            <p>
              Mappings are <strong>explicit, configured data</strong> in the <code>company_levels</code>{" "}
              table — never inferred by a model. They are <Badge tone="warn">approximate</Badge>: two
              companies mapped to the same canonical level have comparable scope, not identical internal
              ladders. Each company page shows its full mapping so you can judge for yourself.
            </p>
          </Section>

          <Section id="companies" title="Company normalization">
            <p>Raw company text is never treated as identity. Resolution pipeline:</p>
            <Formula>
              trim → lowercase → strip punctuation → collapse whitespace → remove legal / contextual
              suffixes (Pvt Ltd, Inc, LLC, India, Technologies…) → alias lookup → canonical company
            </Formula>
            <p>
              &ldquo;Google&rdquo;, &ldquo;GOOGLE&rdquo;, &ldquo;Google LLC&rdquo;, &ldquo;Google India Private Limited&rdquo; and
              &ldquo;&nbsp;Google India Pvt. Ltd.&nbsp;&rdquo; all resolve to the same canonical entity. Known brand
              variants (&ldquo;Alphabet&rdquo;, &ldquo;Facebook&rdquo;, &ldquo;TCS&rdquo;) live in a <code>company_aliases</code> table.
              Fuzzy matching is deliberately <strong>not</strong> used as a source of truth — an unknown
              company returns a clear error rather than a silent wrong merge.
            </p>
          </Section>

          <Section id="locations" title="Location normalization">
            <p>
              Common variants resolve consistently (Bangalore → Bengaluru, Bombay → Mumbai,
              Gurgaon / Gurugram / Noida → Delhi NCR, SF / Bay Area → San Francisco Bay Area, NYC → New York).
              City, state and country are stored separately, and every location carries its currency.
              <strong> Values are never converted between currencies</strong> — INR and USD cohorts are
              always reported separately.
            </p>
          </Section>

          <Section id="cohorts" title="Cohorts & benchmarks">
            <p>
              A <strong>cohort</strong> is the unit of valid comparison: role family + role + canonical
              level + location, optionally narrowed by an experience band. Benchmarks, comparisons,
              percentile positioning and location differentials are all computed strictly within a
              cohort. We never compare a Bengaluru C5 against a Seattle C4.
            </p>
            <p>
              The <Link href="/benchmark" className="text-indigo-600 hover:text-indigo-500">benchmark</Link>{" "}
              reports min, P25, median, P75, P90, max, sample size, compensation mix and a per-company
              leaderboard (companies with ≥3 records). The{" "}
              <Link href="/compare" className="text-indigo-600 hover:text-indigo-500">comparison</Link> shows
              2–3 companies side by side within one cohort, with the cohort-wide market median as reference.
            </p>
          </Section>

          <Section id="percentiles" title="Percentiles">
            <p>
              Quantiles use <strong>linear interpolation</strong> between order statistics (the same
              default as NumPy). For a record&apos;s own <em>percentile rank</em> inside a cohort we use the
              empirical rank:
            </p>
            <Formula>rank = (records below + ½ × records equal) ÷ n</Formula>
            <p>Ranks are shown only when the cohort has at least 5 records.</p>
          </Section>

          <Section id="coverage" title="Coverage indicator">
            <div className="grid gap-2 sm:grid-cols-3">
              <Cov tone="warn" label="Low coverage" range="n < 10" hint="Indicative only. Numbers can move a lot with a few more records." />
              <Cov tone="accent" label="Moderate coverage" range="10 – 49" hint="Usable; percentiles are reasonably stable." />
              <Cov tone="positive" label="Strong coverage" range="50+" hint="Solid signal for the cohort." />
            </div>
            <p>
              This is a <strong>transparency indicator</strong>, not a statistical confidence interval.
              It tells you how much data sits behind a number; it does not claim a margin of error.
            </p>
          </Section>

          <Section id="mix" title="Compensation mix">
            <Formula>baseRatio = base ÷ total · stockRatio = stock ÷ total · bonusRatio = bonus ÷ total</Formula>
            <p>
              For groups we sum components first and take ratios second (a record-weighted mix). If total
              is 0, all ratios are reported as 0 rather than undefined.
            </p>
          </Section>

          <Section id="differentials" title="Location differentials">
            <Formula>differential = (median<sub>other</sub> − median<sub>reference</sub>) ÷ median<sub>reference</sub></Formula>
            <p>
              Computed only for the <strong>same role and canonical level</strong>, in the{" "}
              <strong>same currency</strong>, with at least 3 records per location. If either median is 0
              the differential is reported as unknown rather than as a percentage.
            </p>
          </Section>

          <Section id="dedupe" title="Duplicate protection">
            <p>
              Each record gets a deterministic key over company, role, company level, location, base,
              bonus, stock, years of experience and the reporting <em>month</em>. The key has a{" "}
              <strong>database UNIQUE constraint</strong> — the only race-safe authority. Re-submitting the
              same fact (double-click, retry, second tab) returns <code>409 DUPLICATE_COMPENSATION</code>{" "}
              instead of a second row.
            </p>
          </Section>

          <Section id="limitations" title="Data limitations">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="font-medium">The demonstration dataset is synthetic.</p>
              <p className="mt-1 text-[13px] leading-relaxed">
                Records were generated deterministically to exercise the system&apos;s normalization,
                querying, analytics and workflows. Company names and ladder conventions are real; the
                compensation figures are modeled, not collected, and every record is labeled{" "}
                <code>unverified</code>. Nothing here is presented as verified employee-reported data.
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>Self-reported data (real or synthetic) skews toward people who choose to report.</li>
              <li>Canonical level mappings are curated approximations and will be refined over time.</li>
              <li>No FX conversion — cross-currency comparison is intentionally unsupported.</li>
              <li>Stock values ignore vesting mechanics and price volatility.</li>
              <li>Small cohorts are shown with a Low coverage label rather than hidden, so you can judge them.</li>
            </ul>
            <p className="text-[13px] text-stone-500">
              Current dataset: {metrics.companies} companies · {metrics.records.toLocaleString("en-IN")} records ·{" "}
              {metrics.roles} roles · {metrics.locations} locations · latest report{" "}
              {metrics.latestReportAt ? formatDate(metrics.latestReportAt) : "—"}.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="scroll-mt-20 p-6" >
      <h2 id={id} className="text-[17px] font-semibold tracking-tight text-stone-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-600 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-stone-800 [&_strong]:text-stone-800">
        {children}
      </div>
    </Card>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="tnum rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-stone-800">
      {children}
    </p>
  );
}

function Cov({ tone, label, range, hint }: { tone: "warn" | "accent" | "positive"; label: string; range: string; hint: string }) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <Badge tone={tone}>{label}</Badge>
      <p className="tnum mt-2 text-sm font-semibold text-stone-900">{range}</p>
      <p className="mt-0.5 text-[12px] text-stone-500">{hint}</p>
    </div>
  );
}
