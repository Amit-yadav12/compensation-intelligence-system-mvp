import type { Metadata } from "next";
import { Suspense } from "react";
import { cohortSchema } from "@/lib/validation/query";
import { benchmarkCohort } from "@/lib/services/benchmark.service";
import { BenchmarkForm } from "@/components/benchmark-form";
import { PercentileRange, MixChart } from "@/components/charts";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  QualityBadge,
} from "@/components/ui";
import { formatMoney } from "@/lib/utils/format";
import type { BenchmarkResponse } from "@/lib/services/benchmark.service";

export const metadata: Metadata = {
  title: "Benchmark",
  description:
    "P25, median, P75 and P90 compensation for any role × level × location cohort, with coverage labels and location differentials.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v;
  }

  const parsed = cohortSchema.safeParse(flat);
  let result: BenchmarkResponse | null = null;
  let formError: string | null = null;
  if (parsed.success) {
    try {
      result = await benchmarkCohort(parsed.data);
    } catch (err) {
      formError = err instanceof Error ? err.message : "Benchmark failed.";
    }
  } else {
    const first = parsed.error.issues[0];
    formError = first ? `${first.path.join(".")}: ${first.message}` : null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Compensation benchmark"
        description="Pick a cohort — role, canonical level and location — and get the full distribution: min, P25, median, P75, P90, max, plus compensation mix and location differentials."
      />

      <Suspense fallback={<div className="skeleton h-64 w-full" />}>
        <BenchmarkForm />
      </Suspense>

      {formError && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          {formError}
        </div>
      )}

      {result && <BenchmarkResults result={result} />}
    </div>
  );
}

function BenchmarkResults({ result }: { result: BenchmarkResponse }) {
  const { cohort, stats, mix, qualityLabel: quality, companies, locationDifferentials, insights } = result;

  return (
    <div className="mt-8 animate-rise">
      {/* Cohort summary */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="dark">{cohort.role}</Badge>
        <Badge tone="accent">{cohort.canonicalLevel}</Badge>
        <Badge tone="neutral">{cohort.location}</Badge>
        <Badge tone="outline">{cohort.currency}</Badge>
        {(cohort.experienceBand.min != null || cohort.experienceBand.max != null) && (
          <Badge tone="neutral">
            {cohort.experienceBand.min ?? 0}–{cohort.experienceBand.max ?? 60} yrs
          </Badge>
        )}
      </div>

      {stats.count === 0 ? (
        <EmptyState
          title="No records match this cohort"
          body="Broaden the level or location, or submit a compensation record for this cohort."
        />
      ) : (
        <>
          {/* Distribution */}
          <Card className="mb-4">
            <CardHeader
              title="Total compensation distribution"
              subtitle="All values in the cohort currency. Percentiles computed with linear interpolation."
              action={<QualityBadge quality={quality} />}
            />
            <div className="p-5">
              <PercentileRange
                min={stats.min}
                p25={stats.p25}
                median={stats.median}
                p75={stats.p75}
                p90={stats.p90}
                max={stats.max}
                currency={cohort.currency}
              />
            </div>
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Median total comp.</p>
              <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-stone-900">
                {formatMoney(stats.median, cohort.currency)}
              </p>
              <p className="tnum mt-1 text-[13px] text-stone-500">
                n = {stats.count} · mean {formatMoney(stats.mean, cohort.currency)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Quartiles</p>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                <Row label="P25" value={formatMoney(stats.p25, cohort.currency)} />
                <Row label="P75" value={formatMoney(stats.p75, cohort.currency)} />
                <Row label="P90" value={formatMoney(stats.p90, cohort.currency)} />
              </dl>
            </Card>
            <Card className="p-5">
              <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Compensation mix</p>
              <div className="mt-2">
                <MixChart
                  baseRatio={mix.baseRatio}
                  stockRatio={mix.stockRatio}
                  bonusRatio={mix.bonusRatio}
                />
              </div>
            </Card>
          </div>

          {/* Leaderboard */}
          {companies.length > 0 && (
            <Card className="mb-4">
              <CardHeader
                title="Companies in this cohort"
                subtitle="Median total compensation per company. Companies with fewer than 3 records are excluded from this table."
              />
              <div className="scroll-thin overflow-x-auto p-5 pt-2">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <Th>Company</Th>
                      <Th className="text-right">n</Th>
                      <Th className="text-right">Median TC</Th>
                      <Th className="text-right">vs cohort median</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => {
                      const delta = stats.median > 0 ? (c.median - stats.median) / stats.median : 0;
                      return (
                        <tr key={c.slug} className="border-b border-stone-50 last:border-0">
                          <Td>
                            <a
                              href={`/companies/${c.slug}`}
                              className="focus-ring rounded font-medium text-stone-900 hover:text-indigo-700"
                            >
                              {c.name}
                            </a>
                          </Td>
                          <Td className="tnum text-right text-stone-500">{c.count}</Td>
                          <Td className="tnum text-right font-medium text-stone-900">
                            {formatMoney(c.median, cohort.currency)}
                          </Td>
                          <Td
                            className={`tnum text-right font-medium ${
                              delta >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {Math.round(delta * 100)}%
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Location differentials */}
          {locationDifferentials.length > 0 && (
            <Card className="mb-4">
              <CardHeader
                title="Location differentials"
                subtitle="Same role and level, other locations in the same currency. Never compared across different cohorts."
              />
              <div className="scroll-thin overflow-x-auto p-5 pt-2">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <Th>Location</Th>
                      <Th className="text-right">n</Th>
                      <Th className="text-right">Median TC</Th>
                      <Th className="text-right">vs {cohort.location}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationDifferentials.map((d) => (
                      <tr key={d.slug} className="border-b border-stone-50 last:border-0">
                        <Td className="text-stone-800">{d.city}</Td>
                        <Td className="tnum text-right text-stone-500">{d.n}</Td>
                        <Td className="tnum text-right font-medium text-stone-900">
                          {formatMoney(d.median, cohort.currency)}
                        </Td>
                        <Td
                          className={`tnum text-right font-medium ${
                            d.relativePct >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {d.relativePct >= 0 ? "+" : ""}
                          {Math.round(d.relativePct * 100)}%
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <section aria-label="Insights">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
                Insights
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {insights.map((ins, i) => (
                  <Card key={`${ins.kind}-${i}`} className="flex items-start gap-3 p-4">
                    <span
                      className={`mt-0.5 ${
                        ins.tone === "warn"
                          ? "text-amber-500"
                          : ins.tone === "positive"
                            ? "text-emerald-600"
                            : "text-indigo-500"
                      }`}
                      aria-hidden="true"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-medium text-stone-900">{ins.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">{ins.body}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="tnum font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
