import Link from "next/link";
import type { Metadata } from "next";
import { listCompanies } from "@/lib/services/reference.service";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { CompanySearch } from "@/components/company-search";

export const metadata: Metadata = {
  title: "Companies",
  description: "Browse companies tracked by CompScope with record counts and links to level-based intelligence.",
};

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const companies = await listCompanies(q, 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Companies"
        description="Every company is a canonical entity. Raw names like “Google India Pvt. Ltd.” resolve through normalization and aliases before any aggregation."
      />
      <CompanySearch initial={q ?? ""} />

      <div className="mt-5">
        <p className="tnum mb-3 text-[13px] text-stone-500">
          {companies.length} compan{companies.length === 1 ? "y" : "ies"}
        </p>
        {companies.length === 0 ? (
          <EmptyState
            title="No companies match your search"
            body="Try a different spelling, or check the full list without a filter."
            action={
              <Link
                href="/companies"
                className="focus-ring rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
              >
                Clear search
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug}`} className="focus-ring rounded-xl">
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[15px] font-semibold tracking-tight text-stone-900">{c.name}</p>
                    <Badge tone={c.recordCount >= 50 ? "positive" : c.recordCount >= 10 ? "accent" : "warn"}>
                      n={c.recordCount}
                    </Badge>
                  </div>
                  {c.description && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stone-500">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-3 text-[13px] font-medium text-indigo-600">
                    Level-based intelligence →
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
