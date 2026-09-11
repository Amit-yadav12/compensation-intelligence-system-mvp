import Link from "next/link";
import {
  globalMetrics,
  topCompanies,
  listRoleFamilies,
} from "@/lib/services/reference.service";
import { GlobalSearch } from "@/components/global-search";
import { Badge, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [metrics, companies, families] = await Promise.all([
    globalMetrics(),
    topCompanies(8),
    listRoleFamilies(),
  ]);
  const topFamilies = [...families].sort((a, b) => b.recordCount - a.recordCount).slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-stone-200 bg-[#f4f3f1]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <Badge tone="accent" className="mb-5">
            Level-aware compensation intelligence
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            Understand your compensation market.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-stone-600 sm:text-base">
            CompScope turns fragmented compensation records into comparable market intelligence —
            normalized by company, role, level and location, with base, bonus, stock and total
            compensation kept separate.
          </p>
          <div className="mt-7">
            <GlobalSearch placeholder="Search company, role or level… e.g. Google, SDE II, Bengaluru" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <Link href="/benchmark" className="focus-ring rounded font-medium text-indigo-600 hover:text-indigo-500">
              Or run a cohort benchmark →
            </Link>
            <Link href="/compare?company=google&company=microsoft&company=amazon&roleFamily=software-engineering&role=role_software-engineer&canonicalLevel=c4&location=bengaluru" className="focus-ring rounded font-medium text-stone-600 hover:text-stone-900">
              Try: Google vs Microsoft vs Amazon, C4 Bengaluru →
            </Link>
          </div>

          <dl className="mt-8 grid max-w-3xl gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-stone-500">What</dt>
              <dd className="mt-1 leading-relaxed text-stone-600">Compensation intelligence — percentiles, mix and comparisons, not a salary list.</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-stone-500">Who it&apos;s for</dt>
              <dd className="mt-1 leading-relaxed text-stone-600">Professionals evaluating an offer, a raise, or a move between companies.</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-stone-500">How</dt>
              <dd className="mt-1 leading-relaxed text-stone-600">Fix the cohort — company, role, canonical level, location — then compare within it.</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-stone-400">
            Demo dataset — synthetic records for demonstration only, not verified employee data.{" "}
            <Link href="/methodology" className="focus-ring rounded underline hover:text-stone-600">Methodology</Link>
          </p>

          {/* Database-backed metrics */}
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4">
            <Metric value={metrics.companies.toLocaleString("en-IN")} label="Companies tracked" />
            <Metric value={metrics.records.toLocaleString("en-IN")} label="Compensation records" />
            <Metric value={metrics.roles.toLocaleString("en-IN")} label="Roles" />
            <Metric value={metrics.locations.toLocaleString("en-IN")} label="Locations" />
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Popular companies */}
        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900">Popular companies</h2>
              <p className="mt-0.5 text-[13px] text-stone-500">Most records in the demo dataset</p>
            </div>
            <Link href="/companies" className="focus-ring rounded-md text-[13px] font-medium text-indigo-600 hover:text-indigo-500">
              View all companies →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug}`} className="focus-ring rounded-xl">
                <Card className="h-full p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold tracking-tight text-stone-900">{c.name}</p>
                    <span className="tnum shrink-0 text-[11px] text-stone-400">n={c.totalCount}</span>
                  </div>
                  <p className="tnum mt-2 text-lg font-semibold text-indigo-700">
                    {formatMoney(Number(c.medianTc), c.currency)}
                    <span className="ml-1.5 text-[11px] font-normal text-stone-400">median TC</span>
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Role families + CTAs */}
        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-stone-900">Explore by role family</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topFamilies.map((f) => (
                <Link
                  key={f.id}
                  href={`/compensation?roleFamily=${f.slug}`}
                  className="focus-ring flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-stone-300 hover:bg-stone-50"
                >
                  <span className="text-sm font-medium text-stone-800">{f.name}</span>
                  <span className="tnum text-[12px] text-stone-400">{f.recordCount} records</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">Analysis tools</h2>
            <Link href="/compare" className="focus-ring rounded-xl">
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <p className="text-[15px] font-semibold tracking-tight text-stone-900">Compare companies →</p>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
                  Side-by-side 2–3 company comparison within a matched cohort — role, level and
                  location fixed.
                </p>
              </Card>
            </Link>
            <Link href="/benchmark" className="focus-ring rounded-xl">
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <p className="text-[15px] font-semibold tracking-tight text-stone-900">Run a benchmark →</p>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
                  P25, median, P75 and P90 for any role × level × location cohort, with coverage
                  labels and location differentials.
                </p>
              </Card>
            </Link>
            <Link href="/submit" className="focus-ring rounded-xl">
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <p className="text-[15px] font-semibold tracking-tight text-stone-900">Submit compensation →</p>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
                  Server-validated, deduplicated submissions. Sign in to contribute.
                </p>
              </Card>
            </Link>
          </section>
        </div>

        {/* How it works */}
        <section className="mt-14 border-t border-stone-200 pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">How CompScope works</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Normalize",
                body: "Company text, locations and levels resolve to canonical entities through deterministic normalization — “Google India Pvt. Ltd.” → Google; “Bangalore” → Bengaluru; “SDE II” → a configured canonical level.",
              },
              {
                step: "02",
                title: "Aggregate",
                body: "Total compensation is computed server-side (base + bonus + stock), deduplicated with a database-enforced key, and aggregated into percentiles with transparent coverage labels.",
              },
              {
                step: "03",
                title: "Compare",
                body: "Cohorts fix role, canonical level and location so comparisons stay valid — never a Bengaluru L5 against a Seattle SDE II.",
              },
            ].map((s) => (
              <Card key={s.step} className="p-5">
                <p className="tnum text-[12px] font-semibold tracking-widest text-indigo-600">{s.step}</p>
                <p className="mt-2 text-[15px] font-semibold tracking-tight text-stone-900">{s.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">{s.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Freshness */}
        <p className="mt-12 text-[13px] text-stone-400">
          All numbers computed live from PostgreSQL · latest report{" "}
          {metrics.latestReportAt ? formatDate(metrics.latestReportAt) : "—"}
        </p>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <dt className="order-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="tnum mt-0.5 text-xl font-semibold tracking-tight text-stone-900">{value}</dd>
    </div>
  );
}
