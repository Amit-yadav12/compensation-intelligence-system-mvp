"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
  LabelList,
} from "recharts";
import { formatMoney } from "@/lib/utils/format";

const CHART_COLORS = {
  base: "#4f46e5",
  stock: "#0ea5e9",
  bonus: "#f59e0b",
  total: "#4f46e5",
  market: "#a8a29e",
  grid: "#eceae7",
  text: "#78716c",
};

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e7e5e4",
  background: "#ffffff",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

/* ------------------------ Level median bar chart ---------------------- */

export type LevelMedianDatum = {
  level: string;
  median: number;
  count: number;
};

export function LevelMedianChart({ data, currency }: { data: LevelMedianDatum[]; currency: string }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Median total compensation by level">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="level"
            tick={{ fontSize: 11, fill: CHART_COLORS.text }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_COLORS.text }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatMoney(v, currency)}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatMoney(Number(value), currency), "Median TC"]}
          />
          <Bar dataKey="median" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.level} fill={d.count < 10 ? "#c7d2fe" : CHART_COLORS.base} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------- Mix donut ------------------------------ */

export type MixDatum = { name: string; value: number; color: string };

export function MixChart({ baseRatio, stockRatio, bonusRatio }: { baseRatio: number; stockRatio: number; bonusRatio: number }) {
  const data: MixDatum[] = [
    { name: "Base", value: Math.round(baseRatio * 100), color: CHART_COLORS.base },
    { name: "Stock", value: Math.round(stockRatio * 100), color: CHART_COLORS.stock },
    { name: "Bonus", value: Math.round(bonusRatio * 100), color: CHART_COLORS.bonus },
  ];
  return (
    <div className="flex items-center gap-6">
      <div className="h-40 w-40 shrink-0" role="img" aria-label="Compensation mix: base, stock, bonus">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Share of TC"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-[13px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
            <span className="text-stone-600">{d.name}</span>
            <span className="tnum ml-auto font-medium text-stone-900">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------- Compare grouped bars ----------------------- */

export type CompareDatum = {
  name: string;
  median: number;
};

export function CompareBarsChart({
  data,
  marketMedian,
  currency,
}: {
  data: CompareDatum[];
  marketMedian: number;
  currency: string;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Median total compensation by company">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: CHART_COLORS.text }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART_COLORS.text }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatMoney(v, currency)}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatMoney(Number(value), currency), "Median TC"]}
          />
          {marketMedian > 0 && (
            <ReferenceLine
              y={marketMedian}
              stroke={CHART_COLORS.market}
              strokeDasharray="5 4"
              label={{ value: "Market", position: "insideTopRight", fontSize: 10, fill: CHART_COLORS.market }}
            />
          )}
          <Bar dataKey="median" radius={[4, 4, 0, 0]} maxBarSize={72}>
            {data.map((d) => (
              <Cell key={d.name} fill={CHART_COLORS.base} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------- Percentile range (custom SVG) ------------------ */

export function PercentileRange({
  min,
  p25,
  median,
  p75,
  p90,
  max,
  currency,
}: {
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  currency: string;
}) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = Math.max(1, hi - lo);
  const pctX = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="pt-8">
      <div className="relative h-3" role="img" aria-label={`Range ${formatMoney(min, currency)} to ${formatMoney(max, currency)}, median ${formatMoney(median, currency)}`}>
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-stone-200" />
        <div
          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-indigo-200"
          style={{ left: `${pctX(p25)}%`, right: `${100 - pctX(p75)}%` }}
        />
      </div>
      <div className="relative mt-2 h-16">
        {(
          [
            [min, "Min"],
            [p25, "P25"],
            [median, "Median"],
            [p75, "P75"],
            [p90, "P90"],
            [max, "Max"],
          ] as const
        ).map(([v, label]) => (
          <RangeMarker key={label} left={pctX(v)} value={v} label={label} currency={currency} />
        ))}
      </div>
    </div>
  );
}

function RangeMarker({ left, value, label, currency }: { left: number; value: number; label: string; currency: string }) {
  return (
    <div className="absolute -translate-x-1/2" style={{ left: `${left}%` }} title={`${label}: ${formatMoney(value, currency)}`}>
      <div className="mx-auto h-3.5 w-[2px] bg-stone-900/70" />
      <p className="tnum mt-1 whitespace-nowrap text-center text-[10px] text-stone-500">{label}</p>
      <p className="tnum whitespace-nowrap text-center text-[10px] font-medium text-stone-800">{formatMoney(value, currency)}</p>
    </div>
  );
}

/* ------------------------ Compare mix (stacked) ---------------------- */

export function CompareMixChart({
  data,
}: {
  data: Array<{ name: string; base: number; stock: number; bonus: number }>;
}) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Compensation mix by company">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: CHART_COLORS.text }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: CHART_COLORS.text }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Bar dataKey="base" stackId="mix" fill={CHART_COLORS.base} name="Base" />
          <Bar dataKey="stock" stackId="mix" fill={CHART_COLORS.stock} name="Stock" />
          <Bar dataKey="bonus" stackId="mix" fill={CHART_COLORS.bonus} name="Bonus" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="bonus"
              position="right"
              formatter={(v: unknown) => (typeof v === "number" && v >= 8 ? `${v}%` : "")}
              style={{ fontSize: 10, fill: "#78716c" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
