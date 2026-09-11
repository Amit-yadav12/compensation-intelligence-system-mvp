"use client";

import { Children, cloneElement, isValidElement, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { formatMoney, formatDateFull } from "@/lib/utils/format";
import { calculateTotalCompensation } from "@/lib/domain/compensation";

type Props = {
  companies: Array<{ id: string; name: string; slug: string }>;
  families: Array<{ id: string; name: string; slug: string }>;
  locations: Array<{ id: string; city: string; country: string; slug: string; currency: string }>;
  companyLevels: Array<{
    companyId: string;
    companyLevelName: string;
    canonicalLevelName: string;
    rank: number;
  }>;
  userName: string;
};

type FormState = {
  company: string;
  roleFamily: string;
  role: string;
  companyLevel: string;
  location: string;
  baseSalary: string;
  annualBonus: string;
  annualStock: string;
  currency: string;
  yearsExperience: string;
  yearsAtCompany: string;
  employmentType: string;
  sourceType: string;
  sourceReference: string;
  notes: string;
  reportedAt: string;
};

const EMPTY: FormState = {
  company: "",
  roleFamily: "",
  role: "",
  companyLevel: "",
  location: "",
  baseSalary: "",
  annualBonus: "",
  annualStock: "",
  currency: "INR",
  yearsExperience: "",
  yearsAtCompany: "",
  employmentType: "full_time",
  sourceType: "self_reported",
  sourceReference: "",
  notes: "",
  reportedAt: new Date().toISOString().slice(0, 10),
};

type Success = {
  id: string;
  company: string;
  role: string;
  canonicalLevel: string;
  companyLevel: string;
  location: string;
  baseSalary: number;
  annualBonus: number;
  annualStock: number;
  totalCompensation: number;
  currency: string;
  note: string;
};

export function SubmitForm({ companies, families, locations, companyLevels, userName }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const matchedCompany = useMemo(
    () => companies.find((c) => c.name.toLowerCase() === form.company.trim().toLowerCase()),
    [companies, form.company],
  );
  const matchedLocation = useMemo(
    () =>
      locations.find((l) => l.city.toLowerCase() === form.location.trim().toLowerCase()),
    [locations, form.location],
  );
  const levelsForCompany = useMemo(
    () =>
      matchedCompany
        ? companyLevels
            .filter((l) => l.companyId === matchedCompany.id)
            .sort((a, b) => a.rank - b.rank)
        : [],
    [companyLevels, matchedCompany],
  );

  async function onFamilyChange(slug: string) {
    set({ roleFamily: slug, role: "" });
    if (!slug) {
      setRoles([]);
      return;
    }
    try {
      const res = await fetch(`/api/roles?roleFamily=${encodeURIComponent(slug)}`);
      const json = await res.json();
      setRoles(json.data ?? []);
    } catch {
      setRoles([]);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.company.trim()) e.company = "Company is required.";
    if (!form.roleFamily) e.roleFamily = "Role family is required.";
    if (!form.role) e.role = "Role is required.";
    if (!form.companyLevel.trim()) e.companyLevel = "Company level is required.";
    if (!form.location.trim()) e.location = "Location is required.";
    const base = Number(form.baseSalary);
    if (form.baseSalary === "" || Number.isNaN(base) || base < 0)
      e.baseSalary = "Base salary must be a non-negative number.";
    if (form.annualBonus !== "" && (Number.isNaN(Number(form.annualBonus)) || Number(form.annualBonus) < 0))
      e.annualBonus = "Bonus must be non-negative.";
    if (form.annualStock !== "" && (Number.isNaN(Number(form.annualStock)) || Number(form.annualStock) < 0))
      e.annualStock = "Stock must be non-negative.";
    const ye = Number(form.yearsExperience);
    if (form.yearsExperience === "" || Number.isNaN(ye) || ye < 0 || ye > 60)
      e.yearsExperience = "Enter 0–60 years.";
    if (form.yearsAtCompany !== "") {
      const yac = Number(form.yearsAtCompany);
      if (Number.isNaN(yac) || yac < 0 || yac > ye)
        e.yearsAtCompany = "Cannot exceed total experience.";
    }
    if (form.reportedAt) {
      const d = new Date(form.reportedAt);
      if (d.getTime() > Date.now()) e.reportedAt = "Cannot be in the future.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!validate()) {
      setBanner({ kind: "error", text: "Please fix the highlighted fields." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/compensation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baseSalary: Number(form.baseSalary),
          annualBonus: form.annualBonus === "" ? undefined : Number(form.annualBonus),
          annualStock: form.annualStock === "" ? undefined : Number(form.annualStock),
          yearsExperience: Number(form.yearsExperience),
          yearsAtCompany: form.yearsAtCompany === "" ? undefined : Number(form.yearsAtCompany),
          sourceReference: form.sourceReference || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSuccess(json.data as Success);
        setBanner({ kind: "success", text: "Record accepted." });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const code = json?.error?.code ?? "INTERNAL_ERROR";
        const message = json?.error?.message ?? "Submission failed.";
        setBanner({
          kind: "error",
          text:
            code === "DUPLICATE_COMPENSATION"
              ? `Duplicate record — ${message} Your submission was not saved twice.`
              : message,
        });
      }
    } catch {
      setBanner({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m3 8.5 3 3 7-7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-[15px] font-semibold text-stone-900">Record accepted</p>
            <p className="text-[13px] text-stone-500">
              Total compensation was computed and verified server-side.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm sm:grid-cols-2">
          <SuccessRow label="Company" value={success.company} />
          <SuccessRow label="Role" value={success.role} />
          <SuccessRow label="Canonical level" value={success.canonicalLevel} />
          <SuccessRow label="Company level" value={success.companyLevel} />
          <SuccessRow label="Location" value={success.location} />
          <SuccessRow label="Reported" value={formatDateFull(new Date().toISOString())} />
        </dl>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <th className="py-2">Base</th>
              <th className="py-2">Bonus</th>
              <th className="py-2">Stock</th>
              <th className="py-2 text-right">Total comp.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="tnum py-2 text-stone-700">{formatMoney(success.baseSalary, success.currency)}</td>
              <td className="tnum py-2 text-stone-700">{formatMoney(success.annualBonus, success.currency)}</td>
              <td className="tnum py-2 text-stone-700">{formatMoney(success.annualStock, success.currency)}</td>
              <td className="tnum py-2 text-right text-[15px] font-semibold text-stone-900">
                {formatMoney(success.totalCompensation, success.currency)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone="warn">unverified · demo data</Badge>
          <p className="text-[12px] text-stone-400">{success.note}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="dark" onClick={() => { setSuccess(null); setForm(EMPTY); setBanner(null); }}>
            Submit another record
          </Button>
          <Link
            href={`/companies/${companies.find((c) => c.name === success.company)?.slug ?? ""}`}
            className="focus-ring inline-flex items-center rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:border-stone-400 hover:bg-stone-50"
          >
            View company →
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[13px] text-stone-500">
          Submitting as <span className="font-medium text-stone-800">{userName}</span>
        </p>
        <Badge tone="outline">server-validated</Badge>
      </div>

      {banner && (
        <div
          role="alert"
          className={`mb-4 rounded-lg border px-4 py-2.5 text-[13px] ${
            banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {banner.text}
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Identity</legend>
          <p className="mb-3 text-[12px] leading-relaxed text-stone-500">Which company and where.</p>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company *" error={errors.company}>
            <Input
              list="company-options"
              value={form.company}
              onChange={(e) => set({ company: e.target.value })}
              placeholder="e.g. Google"
            />
            <datalist id="company-options">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {matchedCompany && (
              <p className="mt-1 text-[12px] text-stone-400">
                Resolves to canonical company “{matchedCompany.name}”.
              </p>
            )}
          </Field>
          <Field label="Location *" error={errors.location}>
            <Input
              list="location-options"
              value={form.location}
              onChange={(e) => {
                const loc = locations.find((l) => l.city.toLowerCase() === e.target.value.toLowerCase());
                set({ location: e.target.value, ...(loc ? { currency: loc.currency } : {}) });
              }}
              placeholder="e.g. Bengaluru (Bangalore works too)"
            />
            <datalist id="location-options">
              {locations.map((l) => (
                <option key={l.id} value={l.city} />
              ))}
            </datalist>
            {matchedLocation && (
              <p className="mt-1 text-[12px] text-stone-400">
                {matchedLocation.city}, {matchedLocation.country} · currency {matchedLocation.currency}
              </p>
            )}
          </Field>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Role</legend>
          <p className="mb-3 text-[12px] leading-relaxed text-stone-500">Role family first, then the specific role.</p>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role family *" error={errors.roleFamily}>
            <Select value={form.roleFamily} onChange={(e) => onFamilyChange(e.target.value)}>
              <option value="">Select role family</option>
              {families.map((f) => (
                <option key={f.id} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role *" error={errors.role}>
            <Select value={form.role} onChange={(e) => set({ role: e.target.value })} disabled={!form.roleFamily}>
              <option value="">{form.roleFamily ? "Select role" : "Select a family first"}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Level</legend>
          <p className="mb-3 text-[12px] leading-relaxed text-stone-500">Enter the level your company uses — we map it to a canonical comparison level (approximate).</p>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Company-specific level *"
            error={errors.companyLevel}
            hint="what YOUR company calls it, e.g. L4 / 62 / SDE II"
          >
            <Input
              list="level-options"
              value={form.companyLevel}
              onChange={(e) => set({ companyLevel: e.target.value })}
              placeholder="e.g. L4"
            />
            <datalist id="level-options">
              {levelsForCompany.map((l) => (
                <option key={l.companyLevelName} value={l.companyLevelName} />
              ))}
            </datalist>
            {levelsForCompany.length > 0 && form.companyLevel && (
              <p className="mt-1 text-[12px] text-stone-400">
                Maps to canonical level{" "}
                <span className="font-medium text-stone-600">
                  {
                    levelsForCompany.find(
                      (l) => l.companyLevelName.toLowerCase() === form.companyLevel.trim().toLowerCase(),
                    )?.canonicalLevelName ?? "— (unknown level)"
                  }
                </span>
                . Mappings are approximate.
              </p>
            )}
          </Field>
          <Field label="Canonical level" hint="resolved automatically">
            <Input
              value={
                levelsForCompany.find(
                  (l) => l.companyLevelName.toLowerCase() === form.companyLevel.trim().toLowerCase(),
                )?.canonicalLevelName ?? ""
              }
              disabled
              placeholder="Enter company level to resolve"
            />
          </Field>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Experience</legend>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Years of experience *" error={errors.yearsExperience}>
            <Input
              type="number"
              min={0}
              max={60}
              value={form.yearsExperience}
              onChange={(e) => set({ yearsExperience: e.target.value })}
            />
          </Field>
          <Field label="Years at company" error={errors.yearsAtCompany} hint="blank if unknown">
            <Input
              type="number"
              min={0}
              max={60}
              value={form.yearsAtCompany}
              onChange={(e) => set({ yearsAtCompany: e.target.value })}
            />
          </Field>
          <Field label="Employment type">
            <Select value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </Select>
          </Field>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Compensation</legend>
          <p className="mb-3 text-[12px] leading-relaxed text-stone-500">Annual figures. Missing bonus or stock is treated as 0. Total compensation is computed on the server as base + bonus + stock.</p>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base salary *" error={errors.baseSalary} hint="annual, in whole currency units">
            <Input
              type="number"
              min={0}
              value={form.baseSalary}
              onChange={(e) => set({ baseSalary: e.target.value })}
              placeholder={form.currency === "INR" ? "e.g. 3700000" : "e.g. 195000"}
            />
          </Field>
          <Field label="Currency *">
            <Select value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </Select>
          </Field>
          <Field label="Annual bonus" error={errors.annualBonus} hint="blank = 0">
            <Input
              type="number"
              min={0}
              value={form.annualBonus}
              onChange={(e) => set({ annualBonus: e.target.value })}
            />
          </Field>
          <Field label="Annual stock" error={errors.annualStock} hint="annualized, blank = 0">
            <Input
              type="number"
              min={0}
              value={form.annualStock}
              onChange={(e) => set({ annualStock: e.target.value })}
            />
          </Field>
          </div>
          <TcPreview base={form.baseSalary} bonus={form.annualBonus} stock={form.annualStock} currency={form.currency} />
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Source</legend>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source type">
            <Select value={form.sourceType} onChange={(e) => set({ sourceType: e.target.value })}>
              <option value="self_reported">Self reported</option>
              <option value="offer_letter">Offer letter</option>
              <option value="pay_slip">Pay slip</option>
              <option value="anonymous_survey">Anonymous survey</option>
            </Select>
          </Field>
          <Field label="Reporting date *" error={errors.reportedAt}>
            <Input
              type="date"
              value={form.reportedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set({ reportedAt: e.target.value })}
            />
          </Field>
          <Field label="Source reference" hint="optional">
            <Input
              value={form.sourceReference}
              onChange={(e) => set({ sourceReference: e.target.value })}
              placeholder="e.g. offer letter ref (no personal data)"
            />
          </Field>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1.5 text-[13px] font-semibold text-stone-800">Additional information</legend>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Optional context — team, negotiation details, etc."
            className="focus-ring w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400"
          />
        </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <p className="max-w-md text-[12px] leading-relaxed text-stone-400">
            Total compensation is computed server-side as base + bonus + stock. Submissions are
            deduplicated automatically and labeled unverified demo data.
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Validating…" : "Submit compensation"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  // Associate the label with the first form control child so screen readers
  // announce it and errors are linked via aria-describedby.
  const id = useId();
  const errorId = `${id}-error`;
  const childArray = Children.toArray(children);
  const controlIndex = childArray.findIndex(
    (child) => isValidElement(child) && (child.type === Input || child.type === Select),
  );
  const bound = childArray.map((child, index) =>
    index === controlIndex && isValidElement(child)
      ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? errorId : undefined,
        })
      : child,
  );
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {bound}
      {error && (
        <p id={errorId} className="mt-1 text-[12px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SuccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}

/** Live preview using the same domain function the server uses — never a separate formula. */
function TcPreview({ base, bonus, stock, currency }: { base: string; bonus: string; stock: string; currency: string }) {
  const b = Number(base);
  if (base === "" || Number.isNaN(b) || b < 0) return null;
  const total = calculateTotalCompensation(b, bonus === "" ? undefined : Number(bonus), stock === "" ? undefined : Number(stock));
  return (
    <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-[13px] text-stone-600" aria-live="polite">
      Expected total compensation:{" "}
      <span className="tnum font-semibold text-stone-900">{formatMoney(total, currency)}</span>
      <span className="ml-1.5 text-[12px] text-stone-400">(the server recomputes this on submit)</span>
    </p>
  );
}
