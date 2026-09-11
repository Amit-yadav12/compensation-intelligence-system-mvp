import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { positionRecord, MIN_COHORT_FOR_RANK } from "@/lib/services/positioning.service";
import { PercentileRange, MixChart } from "@/components/charts";
import { Badge, Card, CardHeader, QualityBadge } from "@/components/ui";
import { calculateCompensationMix } from "@/lib/analytics/stats";
import { formatMoney, formatMoneyExact, formatPercent, formatDateFull, QUALITY_COPY } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const result = await positionRecord(id);
  if (!result) return { title: "Record not found" };
  const r = result.record;
  return { title: `${r.company.name} · ${r.role} · ${r.canonicalLevel.name} — Record` };
}

export default async function CompensationRecordPage({ params }: Params) {
  const { id } = await params;
  const result = await positionRecord(id);
  if (!result) notFound();

  const { record: r, cohort, stats, percentileRank, sampleSize, qualityLabel: quality, vsMedianPct, companyCohort } = result;
  const mix = calculateCompensationMix(r.baseSalary, r.annualBonus, r.annualStock);
  const cohortHref = `/compensation?role=${encodeURIComponent(r.roleId)}&canonicalLevel=${r.canonicalLevel.id}&location=${r.location.slug}&sort=tc_desc`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-stone-500">
        <Link href="/compensation" className="focus-ring rounded hover:text-stone-900">Compensation</Link>
        <span className="mx-2 text-stone-300">/</span>
        <Link href={`/companies/${r.company.slug}`} className="focus-ring rounded hover:text-stone-900">{r.company.name}</Link>
        <span className="mx-2 text-stone-300">/</span>
        <span className="text-stone-700">Record</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
            {r.role} at {r.company.name}
          </h1>
          <Badge tone="warn">unverified · demo data</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{r.canonicalLevel.name}</Badge>
          {r.companyLevel && <Badge tone="outline">{r.company.name} level: {r.companyLevel}</Badge>}
          <Badge tone="neutral">{r.location.city}, {r.location.country}</Badge>
          <Badge tone="neutral">{r.yearsExperience} yrs experience</Badge>
          <Badge tone="neutral">Reported {formatDateFull(r.reportedAt)}</Badge>
        </div>
      </header>

      {/* Breakdown */}
      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Total compensation</p>
          <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            {formatMoney(r.totalCompensation, r.currency)}
            <span className="ml-2 text-sm font-normal text-stone-400">{formatMoneyExact(r.totalCompensation, r.currency)}</span>
          </p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <th className="py-2">Component</th>
                <th className="py-2 text-right">Annual</th>
                <th className="py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Base salary", r.baseSalary, mix.baseRatio],
                ["Stock (annualized)", r.annualStock, mix.stockRatio],
                ["Bonus (annualized)", r.annualBonus, mix.bonusRatio],
              ].map(([label, value, ratio]) => (
                <tr key={String(label)} className="border-b border-stone-50 last:border-0">
                  <td className="py-2 text-stone-700">{label}</td>
                  <td className="tnum py-2 text-right font-medium text-stone-900">{formatMoneyExact(Number(value), r.currency)}</td>
                  <td className="tnum py-2 text-right text-stone-500">{formatPercent(Number(ratio), { signed: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px] text-stone-400">
            Total = base + bonus + stock, computed server-side. Source: {r.sourceType.replace("_", " ")}.
          </p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Compensation mix</p>
          <div className="mt-2">
            <MixChart baseRatio={mix.baseRatio} stockRatio={mix.stockRatio} bonusRatio={mix.bonusRatio} />
          </div>
        </Card>
      </div>

      {/* Positioning */}
      <Card className="mb-4">
        <CardHeader
          title="Position within cohort"
          subtitle={`Cohort: ${cohort.role} · ${cohort.canonicalLevel} · ${cohort.location} · all companies`}
          action={<QualityBadge quality={quality} />}
        />
        <div className="p-5">
          {percentileRank == null ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              Only {sampleSize} record{sampleSize === 1 ? "" : "s"} in this cohort — we need at least {MIN_COHORT_FOR_RANK} to
              compute a meaningful percentile rank.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Percentile rank" value={`P${percentileRank}`} sub={`of ${sampleSize} records`} />
                <Metric
                  label="vs cohort median"
                  value={formatPercent(vsMedianPct)}
                  sub={`median ${formatMoney(stats.median, r.currency)}`}
                  tone={vsMedianPct != null && vsMedianPct >= 0 ? "positive" : "negative"}
                />
                <Metric
                  label={`vs ${r.company.name} median`}
                  value={
                    companyCohort && companyCohort.median > 0
                      ? formatPercent((r.totalCompensation - companyCohort.median) / companyCohort.median)
                      : "—"
                  }
                  sub={companyCohort ? `n=${companyCohort.sampleSize} at ${r.company.name}` : "no company records"}
                />
              </div>
              <div className="mt-2">
                <PercentileRange
                  min={stats.min}
                  p25={stats.p25}
                  median={stats.median}
                  p75={stats.p75}
                  p90={stats.p90}
                  max={stats.max}
                  currency={r.currency}
                />
              </div>
            </>
          )}
          <p className="mt-4 text-[12px] leading-relaxed text-stone-400">
            <strong className="font-medium text-stone-500">Methodology.</strong> Empirical percentile rank of this record&apos;s
            total compensation within the cohort: (records below + ½ records equal) ÷ n. Canonical level mapping is
            approximate. {QUALITY_COPY[quality].hint}{" "}
            <Link href="/methodology" className="focus-ring rounded text-indigo-600 hover:text-indigo-500">Read the methodology →</Link>
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={cohortHref} className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          Browse this cohort →
        </Link>
        <Link href={`/companies/${r.company.slug}`} className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          {r.company.name} intelligence →
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`tnum mt-0.5 text-xl font-semibold tracking-tight ${tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-stone-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}
