/**
 * Deterministic insight engine.
 *
 * Every insight is derived from actual database values through the analytics
 * primitives in stats.ts. No LLM, no estimation, no fabrication:
 *   database → analytics engine → structured facts → insight text.
 *
 * If an AI explanation is ever added, it receives these same facts as a
 * structured payload and may only summarize them.
 */
import { calculatePercentiles, qualityLabel, pct, relativeDifference } from "./stats";
import type { Percentiles, QualityLabel, CompensationMix } from "./stats";

export type InsightTone = "info" | "warn" | "positive";

export type Insight = {
  kind:
    | "coverage"
    | "spread"
    | "mix"
    | "location"
    | "market"
    | "freshness"
    | "sample"
    | "equity";
  tone: InsightTone;
  title: string;
  body: string;
};

const fmtPct = (r: number) => `${r > 0 ? "+" : ""}${Math.round(r * 100)}%`;

/* ---------------------------- benchmark ------------------------------ */

export function buildBenchmarkInsights(args: {
  cohortLabel: string;
  stats: Percentiles;
  mix: CompensationMix;
  quality: QualityLabel;
  companyCount: number;
  locationDifferentials: Array<{
    city: string;
    median: number;
    relativePct: number;
    direction: string;
    n: number;
  }>;
}): Insight[] {
  const { stats, mix, quality, locationDifferentials, companyCount, cohortLabel } = args;
  const insights: Insight[] = [];

  if (stats.count === 0) {
    insights.push({
      kind: "coverage",
      tone: "info",
      title: "No records match this cohort yet",
      body: `We have no compensation records for ${cohortLabel}. Broaden the level, role or location, or submit a record.`,
    });
    return insights;
  }

  if (quality === "low") {
    insights.push({
      kind: "coverage",
      tone: "warn",
      title: `Low coverage — ${stats.count} record${stats.count === 1 ? "" : "s"}`,
      body: "This cohort has fewer than 10 records. Treat the percentiles as indicative, not conclusive.",
    });
  } else if (quality === "moderate") {
    insights.push({
      kind: "coverage",
      tone: "info",
      title: `Moderate coverage — ${stats.count} records`,
      body: "Percentiles are usable; 50+ records would give a stronger picture.",
    });
  } else {
    insights.push({
      kind: "coverage",
      tone: "positive",
      title: `Strong coverage — ${stats.count} records`,
      body: `Based on ${stats.count} records across ${companyCount} ${companyCount === 1 ? "company" : "companies"}.`,
    });
  }

  if (stats.p25 > 0 && stats.p90 / stats.p25 >= 1.5) {
    insights.push({
      kind: "spread",
      tone: "info",
      title: `Wide spread — P90 is ${(stats.p90 / stats.p25).toFixed(1)}× the P25`,
      body: `The middle 50% ranges from P25 to P75. Large spreads usually reflect company-to-company differences at the same level.`,
    });
  }

  if (mix.total > 0) {
    insights.push({
      kind: "mix",
      tone: "info",
      title: `Mix: ${pct(mix.baseRatio)}% base · ${pct(mix.stockRatio)}% stock · ${pct(mix.bonusRatio)}% bonus`,
      body: "Stock and bonus are annualized values. Compare mix, not just totals — two similar totals can have very different risk profiles.",
    });
  }

  const notable = [...locationDifferentials]
    .filter((d) => d.n >= 5 && d.direction !== "equal" && d.direction !== "unknown")
    .sort((a, b) => Math.abs(b.relativePct) - Math.abs(a.relativePct))
    .slice(0, 2);
  for (const d of notable) {
    insights.push({
      kind: "location",
      tone: d.direction === "lower" ? "info" : "positive",
      title: `${d.city}: ${fmtPct(d.relativePct)} vs the benchmark location`,
      body: `Same role and level (n=${d.n}). Location differentials are computed only within matched cohorts.`,
    });
  }

  return insights;
}

/* ----------------------------- compare ------------------------------- */

export function buildComparisonInsights(args: {
  cohortLabel: string;
  entries: Array<{
    name: string;
    slug: string;
    stats: Percentiles;
    mix: CompensationMix;
  }>;
  marketMedian: number;
  marketCount: number;
}): Insight[] {
  const { entries, marketMedian, marketCount, cohortLabel } = args;
  const insights: Insight[] = [];
  const withData = entries.filter((e) => e.stats.count > 0);

  if (withData.length === 0) {
    insights.push({
      kind: "coverage",
      tone: "info",
      title: "No data for this comparison",
      body: `None of the selected companies have records for ${cohortLabel}. Adjust the cohort.`,
    });
    return insights;
  }

  const leader = [...withData].sort((a, b) => b.stats.median - a.stats.median)[0];
  if (leader && marketMedian > 0) {
    const delta = relativeDifference(leader.stats.median, marketMedian);
    insights.push({
      kind: "market",
      tone: "positive",
      title: `${leader.name} leads the cohort on median total compensation`,
      body: `${leader.name} pays ${fmtPct(delta)} versus the ${cohortLabel} market median (n=${marketCount} across all companies).`,
    });
  }

  if (withData.length > 1) {
    const laggard = [...withData].sort((a, b) => a.stats.median - b.stats.median)[0];
    if (leader && laggard && leader.slug !== laggard.slug) {
      insights.push({
        kind: "market",
        tone: "info",
        title: `${(leader.stats.median / Math.max(1, laggard.stats.median)).toFixed(2)}× gap between highest and lowest`,
        body: `${leader.name} median vs ${laggard.name} median for the same cohort. Check the mix — the gap may be equity-driven.`,
      });
    }
  }

  const equityLeader = [...withData].sort((a, b) => b.mix.stockRatio - a.mix.stockRatio)[0];
  if (equityLeader && equityLeader.mix.stockRatio >= 0.2) {
    insights.push({
      kind: "equity",
      tone: "info",
      title: `${equityLeader.name} is the most equity-heavy`,
      body: `Stock is ${pct(equityLeader.mix.stockRatio)}% of total comp. Equity values are annualized and subject to vesting and price risk.`,
    });
  }

  for (const e of withData) {
    const q = qualityLabel(e.stats.count);
    if (q === "low") {
      insights.push({
        kind: "sample",
        tone: "warn",
        title: `${e.name}: low coverage (n=${e.stats.count})`,
        body: "Fewer than 10 records — its numbers may move as more data arrives.",
      });
    }
  }

  return insights;
}

/* ------------------------------ company ------------------------------ */

export function buildCompanyInsights(args: {
  companyName: string;
  overall: Percentiles;
  mix: CompensationMix;
  quality: QualityLabel;
  levelMedians: Array<{ levelName: string; rank: number; median: number; count: number }>;
  freshness: { latest: Date | null; last90d: number };
  vsMarket?: Array<{
    levelName: string;
    companyMedian: number;
    companyCount: number;
    marketMedian: number;
    marketCount: number;
    relativePct: number;
  }>;
}): Insight[] {
  const { overall, mix, levelMedians, freshness, companyName, vsMarket = [] } = args;
  const insights: Insight[] = [];

  if (overall.count === 0) return insights;

  // Company vs market — weighted by the company's record count per level.
  const weighted = vsMarket.reduce(
    (acc, v) => ({ sum: acc.sum + v.relativePct * v.companyCount, n: acc.n + v.companyCount }),
    { sum: 0, n: 0 },
  );
  if (weighted.n >= 3) {
    const avg = weighted.sum / weighted.n;
    const abs = Math.abs(Math.round(avg * 100));
    insights.push({
      kind: "market",
      tone: avg >= 0.03 ? "positive" : avg <= -0.03 ? "warn" : "info",
      title:
        abs < 3
          ? `${companyName} pays roughly at market median`
          : `${companyName} pays ${abs}% ${avg > 0 ? "above" : "below"} the level-matched market median`,
      body: `Compared level-by-level against all companies in the same currency (${vsMarket.length} level${vsMarket.length === 1 ? "" : "s"} with ≥3 records on both sides), weighted by ${companyName}'s record count.`,
    });
  }

  if (overall.count > 0) {
    const q = qualityLabel(overall.count);
    insights.push({
      kind: "coverage",
      tone: q === "low" ? "warn" : q === "moderate" ? "info" : "positive",
      title: `${overall.count} records · ${q} coverage`,
      body:
        q === "low"
          ? "Small sample — numbers may shift as more reports arrive."
          : "Coverage label is a transparency indicator, not a formal statistical confidence claim.",
    });
  }

  const sorted = [...levelMedians].sort((a, b) => a.rank - b.rank);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first && last && first.median > 0 && last.rank > first.rank) {
    insights.push({
      kind: "spread",
      tone: "info",
      title: `${last.levelName} earns ${(last.median / first.median).toFixed(1)}× the ${first.levelName} median`,
      body: "Level progression at this company, based on median total compensation per canonical level.",
    });
  }

  if (mix.total > 0) {
    const dominant =
      mix.baseRatio >= 0.75
        ? "Base-heavy"
        : mix.stockRatio >= 0.3
          ? "Equity-heavy"
          : mix.bonusRatio >= 0.2
            ? "Bonus-heavy"
            : "Balanced";
    insights.push({
      kind: "mix",
      tone: "info",
      title: `${dominant} package structure`,
      body: `Across all records: ${pct(mix.baseRatio)}% base, ${pct(mix.stockRatio)}% stock, ${pct(mix.bonusRatio)}% bonus.`,
    });
  }

  if (freshness.latest) {
    const daysAgo = Math.round((Date.now() - freshness.latest.getTime()) / 86_400_000);
    insights.push({
      kind: "freshness",
      tone: daysAgo <= 90 ? "positive" : "info",
      title:
        daysAgo === 0
          ? "Latest report is today"
          : `Latest report: ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
      body: `${freshness.last90d} record${freshness.last90d === 1 ? "" : "s"} in the last 90 days.`,
    });
  }

  return insights;
}

export { calculatePercentiles };
