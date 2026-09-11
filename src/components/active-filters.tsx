"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LABELS: Record<string, string> = {
  q: "Search",
  company: "Company",
  roleFamily: "Role family",
  role: "Role",
  canonicalLevel: "Level",
  companyLevel: "Company level",
  location: "Location",
  minTC: "Min TC",
  maxTC: "Max TC",
  minExperience: "Min exp",
  maxExperience: "Max exp",
};

/**
 * Active filter chips — each chip removes exactly one URL param. Rendered
 * from the URL (the single source of truth), so it never drifts from the
 * sidebar or the server-rendered results.
 */
export function ActiveFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = Array.from(searchParams.entries()).filter(([k, v]) => LABELS[k] && v !== "");
  if (active.length === 0) return null;

  const hrefWithout = (key: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete(key);
    params.delete("page");
    if (key === "roleFamily") params.delete("role");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {active.map(([key, value]) => (
        <Link
          key={key}
          href={hrefWithout(key)}
          className="focus-ring group inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white py-1 pl-2.5 pr-1.5 text-[12px] text-stone-700 hover:border-stone-400"
          aria-label={`Remove filter ${LABELS[key]}: ${value}`}
        >
          <span className="text-stone-400">{LABELS[key]}</span>
          <span className="font-medium">{value}</span>
          <span className="rounded bg-stone-100 px-1 text-stone-500 group-hover:bg-stone-200" aria-hidden="true">×</span>
        </Link>
      ))}
      <Link href={pathname} className="focus-ring ml-1 rounded text-[12px] font-medium text-indigo-600 hover:text-indigo-500">
        Clear all
      </Link>
    </div>
  );
}
