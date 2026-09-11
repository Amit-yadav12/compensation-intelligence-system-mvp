"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CohortFields, type CohortValues } from "@/components/cohort-fields";
import { CompareBarsChart, CompareMixChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  QualityBadge,
} from "@/components/ui";
import { formatMoney } from "@/lib/utils/format";

type CompanyOption = { id: string; name: string; slug: string; recordCount: number };
type CompareCompany = {
  slug: string;
  name: string;
  sampleSize: number;
  stats: { count: number; min: number; p25: number; median: number; p75: number; p90: number; max: number; mean: number };
  mix: { baseRatio: number; stockRatio: number; bonusRatio: number; total: number };
  components: { medianBase: number; medianStock: number; medianBonus: number };
  qualityLabel: "low" | "moderate" | "strong";
};
type Insight = { kind: string; tone: "info" | "warn" | "positive"; title: string; body: string };
type CompareResponse = {
  cohort: {
    roleFamily: string;
    role: string;
    canonicalLevel: string;
    levelApproximationNote: string | null;
    location: string;
    currency: string;
  };
  market: { median: number; count: number };
  companies: CompareCompany[];
  insights: Insight[];
  generatedAt: string;
};

const MAX_COMPANIES = 3;
const MIN_COMPANIES = 2;

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cohort, setCohort] = useState<CohortValues>({
    roleFamily: "",
    role: "",
    canonicalLevel: "",
    location: "",
    minExperience: "",
    maxExperience: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [hasRun, setHasRun] = useState(false);
  // When the page is opened from a shared URL with a full cohort, run once automatically.
  const autoRunPending = useRef(false);

  useEffect(() => {
    fetch("/api/companies?limit=100")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: { data: CompanyOption[] }) => setCompanies(j.data))
      .catch(() => setCompanies([]));
  }, []);

  // Restore shareable URL state once on mount.
  useEffect(() => {
    const companiesParam = searchParams.getAll("company");
    if (companiesParam.length >= MIN_COMPANIES) {
      autoRunPending.current = Boolean(
        searchParams.get("roleFamily") && searchParams.get("role") && searchParams.get("canonicalLevel") && searchParams.get("location"),
      );
      setSelected(companiesParam.slice(0, MAX_COMPANIES));
      setCohort({
        roleFamily: searchParams.get("roleFamily") ?? "",
        role: searchParams.get("role") ?? "",
        canonicalLevel: searchParams.get("canonicalLevel") ?? "",
        location: searchParams.get("location") ?? "",
        minExperience: searchParams.get("minExperience") ?? "",
        maxExperience: searchParams.get("maxExperience") ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const list = companies.filter((c) => c.recordCount > 0);
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [companies, companySearch]);

  const canRun =
    selected.length >= MIN_COMPANIES &&
    cohort.roleFamily &&
    cohort.role &&
    cohort.canonicalLevel &&
    cohort.location &&
    !loading;

  const run = useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    for (const s of selected) params.append("company", s);
    params.set("roleFamily", cohort.roleFamily);
    params.set("role", cohort.role);
    params.set("canonicalLevel", cohort.canonicalLevel);
    params.set("location", cohort.location);
    if (cohort.minExperience) params.set("minExperience", cohort.minExperience);
    if (cohort.maxExperience) params.set("maxExperience", cohort.maxExperience);

    // Make the comparison shareable without a round trip.
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);

    try {
      const res = await fetch(`/api/compare?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Comparison failed.");
        setResult(null);
      } else {
        setResult(json.data as CompareResponse);
        setHasRun(true);
      }
    } catch {
      setError("Network error while comparing.");
    } finally {
      setLoading(false);
    }
  }, [canRun, selected, cohort]);

  useEffect(() => {
    if (autoRunPending.current && canRun) {
      autoRunPending.current = false;
      void run();
    }
  }, [canRun, run]);

  const toggleCompany = (slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COMPANIES) {
        // Replace the oldest selection — friendlier than blocking.
        return [...prev.slice(1), slug];
      }
      return [...prev, slug];
    });
  };

  const cohortReady = cohort.roleFamily && cohort.role && cohort.canonicalLevel && cohort.location;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Smart comparison"
        description="Compare 2–3 companies within one matched cohort. Same role family, role, canonical level and location — so the comparison is valid."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Config */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Companies"
              subtitle={`${selected.length}/${MAX_COMPANIES} selected — pick at least ${MIN_COMPANIES}`}
            />
            <div className="p-4">
              <input
                type="search"
                aria-label="Filter companies"
                placeholder="Filter companies…"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="focus-ring mb-3 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400"
              />
              <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
                {filteredCompanies.map((c) => {
                  const active = selected.includes(c.slug);
                  const disabled = !active && selected.length >= MAX_COMPANIES;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCompany(c.slug)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={`focus-ring flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-stone-900 font-medium text-white"
                          : disabled
                            ? "text-stone-300"
                            : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className={`tnum text-[11px] ${active ? "text-stone-300" : "text-stone-400"}`}>
                        n={c.recordCount}
                      </span>
                    </button>
                  );
                })}
                {filteredCompanies.length === 0 && (
                  <p className="py-3 text-center text-[13px] text-stone-400">No companies found</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cohort" subtitle="All companies are compared on this exact cohort." />
            <div className="p-4">
              <CohortFields value={cohort} onChange={setCohort} idPrefix="cmp-" />
            </div>
          </Card>

          <Button onClick={run} disabled={!canRun} className="w-full">
            {loading ? "Comparing…" : `Compare ${selected.length || ""} compan${selected.length === 1 ? "y" : "ies"}`}
          </Button>
          {!cohortReady && (
            <p className="text-center text-[12px] text-stone-400">Select a full cohort to compare.</p>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {error && <ErrorState title="Comparison failed" body={error} />}
          {!hasRun && !loading && !error && (
            <EmptyState
              title="Build your comparison"
              body="Pick 2–3 companies and define the cohort. Every metric comes from actual database records for that exact cohort."
            />
          )}
          {loading && (
            <div className="space-y-3">
              <div className="skeleton h-40 w-full" />
              <div className="skeleton h-64 w-full" />
              <div className="skeleton h-56 w-full" />
            </div>
          )}
          {!loading && result && <CompareResults result={result} />}
        </div>
      </div>
    </div>
  );
}

function CompareResults({ result }: { result: CompareResponse }) {
  const { cohort, companies, market, insights } = result;
  const withData = companies.filter((c) => c.sampleSize > 0);

  return (
    <div className="animate-rise space-y-4">
      {/* Cohort header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="dark">{cohort.role}</Badge>
        <Badge tone="accent">{cohort.canonicalLevel}</Badge>
        <Badge tone="neutral">{cohort.location}</Badge>
        <Badge tone="outline">{cohort.currency}</Badge>
      </div>
      {cohort.levelApproximationNote && (
        <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-[12px] leading-relaxed text-indigo-800">
          {cohort.levelApproximationNote}
        </p>
      )}

      {withData.length === 0 ? (
        <EmptyState
          title="No records for this cohort"
          body="None of the selected companies have records at this role, level and location. Adjust the cohort."
        />
      ) : (
        <>
          {/* Metrics table */}
          <Card>
            <CardHeader
              title="Side-by-side"
              subtitle={`Median components within the cohort · market median across all ${market.count} matching records`}
            />
            <div className="scroll-thin overflow-x-auto p-5 pt-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    <Th>Metric</Th>
                    {companies.map((c) => (
                      <Th key={c.slug} className="text-right">
                        {c.name}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="Base salary"
                    companies={companies}
                    render={(c) => formatMoney(c.components.medianBase, cohort.currency)}
                    emptyHint="n/a"
                  />
                  <MetricRow
                    label="Stock (annualized)"
                    companies={companies}
                    render={(c) => formatMoney(c.components.medianStock, cohort.currency)}
                    emptyHint="—"
                  />
                  <MetricRow
                    label="Bonus (annualized)"
                    companies={companies}
                    render={(c) => formatMoney(c.components.medianBonus, cohort.currency)}
                    emptyHint="—"
                  />
                  <tr className="border-b border-stone-100">
                    <Td className="font-semibold text-stone-900">Total compensation</Td>
                    {companies.map((c) => (
                      <Td key={c.slug} className="tnum text-right text-[15px] font-semibold text-stone-900">
                        {c.sampleSize > 0 ? formatMoney(c.stats.median, cohort.currency) : "—"}
                      </Td>
                    ))}
                  </tr>
                  <MetricRow
                    label="P25 – P75"
                    companies={companies}
                    render={(c) =>
                      `${formatMoney(c.stats.p25, cohort.currency)} – ${formatMoney(c.stats.p75, cohort.currency)}`
                    }
                    emptyHint="—"
                    muted
                  />
                  <tr className="border-b border-stone-100">
                    <Td className="text-stone-600">Sample size</Td>
                    {companies.map((c) => (
                      <Td key={c.slug} className="tnum text-right">
                        <span className="inline-flex items-center gap-2">
                          <QualityBadge quality={c.qualityLabel} />
                          <span className="text-stone-500">n={c.sampleSize}</span>
                        </span>
                      </Td>
                    ))}
                  </tr>
                  <tr>
                    <Td className="text-stone-600">
                      Market median
                      <span className="block text-[11px] text-stone-400">all companies in this cohort</span>
                    </Td>
                    {companies.map((c) => (
                      <Td key={c.slug} className="tnum text-right text-stone-500">
                        {market.count > 0 ? formatMoney(market.median, cohort.currency) : "—"}
                      </Td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Charts */}
          <Card>
            <CardHeader title="Median total compensation" subtitle="Dashed line = market median for the cohort." />
            <div className="p-5">
              <CompareBarsChart
                data={withData.map((c) => ({ name: c.name, median: c.stats.median }))}
                marketMedian={market.median}
                currency={cohort.currency}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Compensation mix" subtitle="Share of total compensation by component." />
            <div className="p-5">
              <CompareMixChart
                data={withData.map((c) => ({
                  name: c.name,
                  base: Math.round(c.mix.baseRatio * 100),
                  stock: Math.round(c.mix.stockRatio * 100),
                  bonus: Math.round(c.mix.bonusRatio * 100),
                }))}
              />
            </div>
          </Card>

          {/* Insights */}
          {insights.length > 0 && (
            <section aria-label="Insights">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
                Insights
              </h2>
              <div className="grid gap-3">
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

function MetricRow({
  label,
  companies,
  render,
  emptyHint,
  muted,
}: {
  label: string;
  companies: CompareCompany[];
  render: (c: CompareCompany) => string;
  emptyHint: string;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-stone-100">
      <Td className={muted ? "text-stone-500" : "text-stone-600"}>{label}</Td>
      {companies.map((c) => (
        <Td key={c.slug} className={`tnum text-right ${muted ? "text-stone-500" : "text-stone-800"}`}>
          {c.sampleSize > 0 ? render(c) : emptyHint}
        </Td>
      ))}
    </tr>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
