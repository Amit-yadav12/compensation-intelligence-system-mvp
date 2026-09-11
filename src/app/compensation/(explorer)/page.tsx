import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { compensationQuerySchema } from "@/lib/validation/query";
import { queryCompensation, type ExplorerRow } from "@/lib/services/compensation.service";
import { FilterSidebar, SortControl } from "@/components/compensation-explorer";
import { ActiveFilters } from "@/components/active-filters";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Compensation Explorer",
  description:
    "Search, filter and benchmark compensation records across companies, roles, levels and locations.",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CompensationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v;
  }

  // Malformed query params degrade gracefully to defaults instead of crashing.
  const parsed = compensationQuerySchema.safeParse(flat);
  const query = parsed.success
    ? parsed.data
    : compensationQuerySchema.parse({});
  const queryWarning = parsed.success ? null : "Some filters were invalid and were reset.";

  const { data, pagination } = await queryCompensation(query);

  const baseHref = `/compensation?${new URLSearchParams(
    Object.entries(flat).filter(([k]) => k !== "page"),
  ).toString()}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Compensation Explorer"
        description="Server-side search, filtering and sorting across every record. Levels are normalized across companies — Google L4, Microsoft 62 and Amazon SDE II map into the same comparison groups."
      />

      {queryWarning && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          {queryWarning}
        </div>
      )}

      <div className="flex gap-6">
        <Suspense
          fallback={
            <div className="hidden h-96 w-72 animate-pulse rounded-xl border border-stone-200 bg-white lg:block" />
          }
        >
          <FilterSidebar />
        </Suspense>

        <section className="min-w-0 flex-1" aria-label="Compensation results">
          <Suspense fallback={null}>
            <ActiveFilters />
          </Suspense>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="tnum text-[13px] text-stone-500">
              {pagination.total.toLocaleString("en-IN")} record{pagination.total === 1 ? "" : "s"}
            </p>
            <Suspense fallback={null}>
              <SortControl />
            </Suspense>
          </div>

          {data.length === 0 ? (
            <EmptyState
              title="No compensation records match"
              body="Try broadening the level, clearing a filter, or searching a different company or location."
              action={
                <Link
                  href="/compensation"
                  className="focus-ring rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Clear all filters
                </Link>
              }
            />
          ) : (
            <>
              <CompensationTable rows={data} />
              <CompensationCards rows={data} />
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                baseHref={baseHref}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ Table -------------------------------- */

function CompensationTable({ rows }: { rows: ExplorerRow[] }) {
  return (
    <div className="scroll-thin hidden overflow-x-auto rounded-xl border border-stone-200 bg-white lg:block">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <Th className="pl-5">Company</Th>
            <Th>Role</Th>
            <Th>Level</Th>
            <Th>Location</Th>
            <Th className="text-right">Base</Th>
            <Th className="text-right">Stock</Th>
            <Th className="text-right">Bonus</Th>
            <Th className="text-right">Total comp.</Th>
            <Th className="pr-5 text-right">Reported</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group border-b border-stone-100 last:border-0 hover:bg-stone-50/70">
              <Td className="pl-5">
                <Link
                  href={`/companies/${r.company.slug}`}
                  className="focus-ring rounded font-medium text-stone-900 hover:text-indigo-700"
                >
                  {r.company.name}
                </Link>
              </Td>
              <Td>
                <span className="text-stone-800">{r.role}</span>
                <span className="block text-[11px] text-stone-400">{r.roleFamily}</span>
              </Td>
              <Td>
                <Badge tone="accent">{r.canonicalLevel.name}</Badge>
                {r.companyLevel && (
                  <span className="mt-1 block text-[11px] text-stone-400">{r.companyLevel}</span>
                )}
              </Td>
              <Td>
                <span className="text-stone-700">{r.location.city}</span>
                <span className="block text-[11px] text-stone-400">{r.location.country}</span>
              </Td>
              <Td className="tnum text-right text-stone-700">{formatMoney(r.baseSalary, r.currency)}</Td>
              <Td className="tnum text-right text-stone-700">{formatMoney(r.annualStock, r.currency)}</Td>
              <Td className="tnum text-right text-stone-700">{formatMoney(r.annualBonus, r.currency)}</Td>
              <Td className="tnum pr-0 text-right font-semibold text-stone-900">
                <Link
                  href={`/compensation/${r.id}`}
                  className="focus-ring rounded hover:text-indigo-700 hover:underline"
                  title="View record and percentile position"
                >
                  {formatMoney(r.totalCompensation, r.currency)}
                </Link>
              </Td>
              <Td className="pr-5 text-right text-[12px] text-stone-500">{formatDate(r.reportedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-3 ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3.5 align-top ${className}`}>{children}</td>;
}


/* --------------------------- Mobile cards ---------------------------- */

function CompensationCards({ rows }: { rows: ExplorerRow[] }) {
  return (
    <div className="space-y-3 lg:hidden">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                href={`/companies/${r.company.slug}`}
                className="focus-ring rounded text-[15px] font-semibold text-stone-900"
              >
                {r.company.name}
              </Link>
              <p className="mt-0.5 text-[13px] text-stone-600">{r.role}</p>
            </div>
            <div className="text-right">
              <Link href={`/compensation/${r.id}`} className="focus-ring tnum block rounded text-[15px] font-semibold text-stone-900">
                {formatMoney(r.totalCompensation, r.currency)}
              </Link>
              <p className="text-[11px] text-stone-400">total comp. · details →</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{r.canonicalLevel.name}</Badge>
            {r.companyLevel && <Badge tone="outline">{r.companyLevel}</Badge>}
            <Badge tone="neutral">
              {r.location.city}, {r.location.country}
            </Badge>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-stone-400">Base</dt>
              <dd className="tnum text-[13px] font-medium text-stone-800">{formatMoney(r.baseSalary, r.currency)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-stone-400">Stock</dt>
              <dd className="tnum text-[13px] font-medium text-stone-800">{formatMoney(r.annualStock, r.currency)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-stone-400">Bonus</dt>
              <dd className="tnum text-[13px] font-medium text-stone-800">{formatMoney(r.annualBonus, r.currency)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-right text-[11px] text-stone-400">Reported {formatDate(r.reportedAt)}</p>
        </div>
      ))}
    </div>
  );
}
