import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/session";
import {
  listCompanies,
  listRoleFamilies,
  listLocations,
  listCompanyLevels,
} from "@/lib/services/reference.service";
import { SubmitForm } from "@/components/submit-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Submit Compensation",
  description:
    "Server-validated, deduplicated compensation submissions. Total compensation is computed server-side.",
};

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/submit");

  const [companies, families, locations, companyLevels] = await Promise.all([
    listCompanies(undefined, 100),
    listRoleFamilies(),
    listLocations(),
    listCompanyLevels(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Submit compensation"
        description="Your submission is validated server-side, resolved to canonical entities (company, role, level, location), deduplicated, and stored with base, bonus and stock kept separate. Total compensation is always computed on the server."
      />
      <SubmitForm
        companies={companies.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        families={families.map((f) => ({ id: f.id, name: f.name, slug: f.slug }))}
        locations={locations.map((l) => ({
          id: l.id,
          city: l.city,
          country: l.country,
          slug: l.slug,
          currency: l.currency,
        }))}
        companyLevels={companyLevels}
        userName={user.name}
      />
    </div>
  );
}
