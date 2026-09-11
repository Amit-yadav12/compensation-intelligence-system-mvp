import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCompanyAnalytics } from "@/lib/services/analytics.service";
import { compensationQuerySchema } from "@/lib/validation/query";
import { queryCompensation } from "@/lib/services/compensation.service";
import { Badge, Card, CardHeader, EmptyState, QualityBadge, Stat } from "@/components/ui";
import { LevelMedianChart, MixChart } from "@/components/charts";
import { formatDate, formatMoney, formatPercent, relativeDays, QUALITY_COPY } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const analytics = await getCompanyAnalytics(slug);
  if (!analytics) return { title: "Company not found" };
  return {
    title: `${analytics.company.name} — Compensation Intelligence`,
    description: analytics.company.description ?? undefined,
  };
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;
  const analytics = await getCompanyAnalytics(slug);
  if (!analytics) notFound();

  const recent = await queryCompensation(
    compensationQuerySchema.parse({ company: slug, sort: "newest", limit: 8 }),
  );

  const a = analytics;
  const primaryCurrency = a.primaryCurrency ?? "INR";
  const levelChartData = a.byLevel.map((l) => ({ level: l.levelName.split(" · ")[0], median: l.median, count: l.count }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
            {a.company.name}
          </h1>
          <QualityBadge quality={a.quality} />
          <Badge tone="neutral">{a.recordCount} records</Badge>
        </div>
        {a.company.description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">{a.company.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-stone-500">
          <span>
            Latest report:{" "}
            <span className="font-medium text-stone-700">{a.latestReport ? relativeDays(a.latestReport) : "—"}</span>
          </span>
          <span>
            Last 90 days: <span className="tnum font-medium text-stone-700">{a.freshness.last90d}</span>
          </span>
          {a.company.website && (
            <a
              href={a.company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded font-medium text-indigo-600 hover:text-indigo-500"
            >
              Website ↗
            </a>
          )}
        </div>
      </header>

      {/* Snapshot per currency */}
      {a.snapshotByCurrency.length === 0 ? (
        <EmptyState
          title="No compensation records yet"
          body="We have no records for this company in the demo dataset. Submit one to seed the intelligence."
        />
      ) : (
        <>
          <section aria-label="Compensation snapshot" className="mb-8">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
              Compensation snapshot
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {a.snapshotByCurrency.map((s) => (
                <Card key={s.currency} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">
                      Median TC · {s.currency}
                    </p>
                    <Badge tone="outline">n={s.count}</Badge>
                  </div>
                  <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-stone-900">
                    {formatMoney(s.medianTC, s.currency)}
                  </p>
                  <dl className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-[13px]">
                    <SnapshotRow label="Median base" value={formatMoney(s.medianBase, s.currency)} />
                    <SnapshotRow label="Median stock" value={formatMoney(s.medianStock, s.currency)} />
                    <SnapshotRow label="Median bonus" value={formatMoney(s.medianBonus, s.currency)} />
                    <SnapshotRow label="P25 – P75" value={`${formatMoney(s.p25, s.currency)} – ${formatMoney(s.p75, s.currency)}`} />
                  </dl>
                </Card>
              ))}
            </div>
          </section>

          {/* Level + mix */}
          <div className="mb-8 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Compensation by level"
                subtitle="Median total compensation per canonical level. Lighter bars indicate fewer than 10 records."
              />
              <div className="p-5">
                {a.byLevel.length === 0 ? (
                  <EmptyState title="No level data" />
                ) : (
                  <LevelMedianChart data={levelChartData} currency={primaryCurrency} />
                )}
                <div className="scroll-thin mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        <Th>Level</Th>
                        <Th className="text-right">n</Th>
                        <Th className="text-right">P25</Th>
                        <Th className="text-right">Median</Th>
                        <Th className="text-right">P75</Th>
                        <Th className="text-right">P90</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.byLevel.map((l) => (
                        <tr key={l.canonicalLevelId} className="border-b border-stone-50 last:border-0">
                          <Td className="font-medium text-stone-800">{l.levelName}</Td>
                          <Td className="tnum text-right text-stone-500">{l.count}</Td>
                          <Td className="tnum text-right text-stone-600">{formatMoney(l.p25, primaryCurrency)}</Td>
                          <Td className="tnum text-right font-semibold text-stone-900">{formatMoney(l.median, primaryCurrency)}</Td>
                          <Td className="tnum text-right text-stone-600">{formatMoney(l.p75, primaryCurrency)}</Td>
                          <Td className="tnum text-right text-stone-600">{formatMoney(l.p90, primaryCurrency)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Compensation mix" subtitle="Average share of total compensation across all records." />
              <div className="p-5">
                <MixChart
                  baseRatio={a.mix.baseRatio}
                  stockRatio={a.mix.stockRatio}
                  bonusRatio={a.mix.bonusRatio}
                />
              </div>
            </Card>
          </div>

          {/* Company vs market */}
          {a.vsMarket.length > 0 && (
            <Card className="mb-8">
              <CardHeader
                title={`${a.company.name} vs market, by level`}
                subtitle={`Median total compensation at ${a.company.name} against all companies at the same canonical level in ${primaryCurrency}. Only levels with ≥3 records on both sides are shown.`}
              />
              <div className="scroll-thin overflow-x-auto p-5 pt-2">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <Th>Level</Th>
                      <Th className="text-right">{a.company.name} median</Th>
                      <Th className="text-right">n</Th>
                      <Th className="text-right">Market median</Th>
                      <Th className="text-right">market n</Th>
                      <Th className="text-right">Difference</Th>
                      <Th className="w-40">Position</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.vsMarket.map((v) => {
                      const pct = Math.round(v.relativePct * 100);
                      const width = Math.min(100, Math.abs(pct)) / 2; // half-track per side
                      return (
                        <tr key={v.canonicalLevelId} className="border-b border-stone-50 last:border-0">
                          <Td className="font-medium text-stone-800">{v.levelName}</Td>
                          <Td className="tnum text-right font-semibold text-stone-900">{formatMoney(v.companyMedian, primaryCurrency)}</Td>
                          <Td className="tnum text-right text-stone-500">{v.companyCount}</Td>
                          <Td className="tnum text-right text-stone-700">{formatMoney(v.marketMedian, primaryCurrency)}</Td>
                          <Td className="tnum text-right text-stone-500">{v.marketCount}</Td>
                          <Td className={`tnum text-right font-medium ${pct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {formatPercent(v.relativePct)}
                          </Td>
                          <Td>
                            <div className="relative h-2 w-full rounded bg-stone-100" aria-hidden="true">
                              <div className="absolute left-1/2 top-0 h-2 w-px bg-stone-300" />
                              <div
                                className={`absolute top-0 h-2 rounded ${pct >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
                                style={pct >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                              />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Locations + role families */}
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Compensation by location" subtitle="Median total compensation per location." />
              <div className="p-5">
                {a.byLocation.length === 0 ? (
                  <EmptyState title="No location data" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        <Th>Location</Th>
                        <Th className="text-right">n</Th>
                        <Th className="text-right">Median TC</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.byLocation.map((l) => (
                        <tr key={l.locationId} className="border-b border-stone-50 last:border-0">
                          <Td className="text-stone-800">
                            {l.city}
                            <span className="block text-[11px] text-stone-400">{l.country}</span>
                          </Td>
                          <Td className="tnum text-right text-stone-500">{l.count}</Td>
                          <Td className="tnum text-right font-medium text-stone-900">{formatMoney(l.median, l.currency)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Compensation by role family" subtitle="Role families with at least one record." />
              <div className="p-5">
                {a.byRoleFamily.length === 0 ? (
                  <EmptyState title="No role family data" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        <Th>Role family</Th>
                        <Th className="text-right">n</Th>
                        <Th className="text-right">Median TC</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.byRoleFamily.map((f) => (
                        <tr key={f.roleFamilyId} className="border-b border-stone-50 last:border-0">
                          <Td className="text-stone-800">{f.name}</Td>
                          <Td className="tnum text-right text-stone-500">{f.count}</Td>
                          <Td className="tnum text-right font-medium text-stone-900">
                            {formatMoney(f.median, primaryCurrency)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* Level mapping */}
          <Card className="mb-8">
            <CardHeader
              title="Level mapping"
              subtitle="How this company's levels map into canonical comparison groups. Mappings are approximate — different companies' internal levels are not literally identical."
            />
            <div className="scroll-thin overflow-x-auto p-5">
              {a.levelMapping.length === 0 ? (
                <EmptyState title="No configured level mapping" />
              ) : (
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <Th>Company level</Th>
                      <Th aria-label="Maps to" />
                      <Th>Canonical level (approx.)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.levelMapping.map((m) => (
                      <tr key={m.companyLevelName} className="border-b border-stone-50 last:border-0">
                        <Td>
                          <Badge tone="outline">{m.companyLevelName}</Badge>
                        </Td>
                        <Td className="text-stone-300">→</Td>
                        <Td className="font-medium text-stone-800">{m.canonicalLevelName}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Insights */}
          <section className="mb-8" aria-label="Insights">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
              Insights
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {a.insights.map((ins, i) => (
                <Card key={`${ins.kind}-${i}`} className="flex items-start gap-3 p-4">
                  <InsightIcon tone={ins.tone} />
                  <div>
                    <p className="text-sm font-medium text-stone-900">{ins.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">{ins.body}</p>
                  </div>
                </Card>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-stone-400">{QUALITY_COPY[a.quality].hint}</p>
          </section>

          {/* Recent records */}
          <section aria-label="Recent records">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
              Recent records
            </h2>
            <div className="scroll-thin overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    <Th className="pl-5">Role</Th>
                    <Th>Level</Th>
                    <Th>Location</Th>
                    <Th className="text-right">Base</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Bonus</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="pr-5 text-right">Reported</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.map((r) => (
                    <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                      <Td className="pl-5 font-medium text-stone-800">{r.role}</Td>
                      <Td>
                        <Badge tone="accent">{r.canonicalLevel.name}</Badge>
                      </Td>
                      <Td className="text-stone-600">{r.location.city}</Td>
                      <Td className="tnum text-right text-stone-600">{formatMoney(r.baseSalary, r.currency)}</Td>
                      <Td className="tnum text-right text-stone-600">{formatMoney(r.annualStock, r.currency)}</Td>
                      <Td className="tnum text-right text-stone-600">{formatMoney(r.annualBonus, r.currency)}</Td>
                      <Td className="tnum text-right font-semibold text-stone-900">{formatMoney(r.totalCompensation, r.currency)}</Td>
                      <Td className="pr-5 text-right text-[12px] text-stone-500">{formatDate(r.reportedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="tnum font-medium text-stone-800">{value}</dd>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}

function InsightIcon({ tone }: { tone: "info" | "warn" | "positive" }) {
  const color =
    tone === "warn" ? "text-amber-500" : tone === "positive" ? "text-emerald-600" : "text-indigo-500";
  return (
    <span className={`mt-0.5 ${color}`} aria-hidden="true">
      {tone === "warn" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 6.5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.8" fill="currentColor" />
        </svg>
      ) : tone === "positive" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="m5 8.2 2 2 4-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
          <path d="M8 7.5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
