"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils/format";

type Option = {
  id: string;
  name: string;
  slug?: string;
  recordCount?: number;
  country?: string;
  rank?: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch ${url} failed`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

/* --------------------------- Filter sidebar -------------------------- */

export function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [families, setFamilies] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<Option[]>("/api/companies"),
      fetchJson<Option[]>("/api/role-families"),
      fetchJson<Option[]>("/api/levels"),
      fetchJson<Option[]>("/api/locations"),
    ])
      .then(([c, f, l, loc]) => {
        setCompanies(c);
        setFamilies(f);
        setLevels(l);
        setLocations(loc);
      })
      .catch(() => undefined);
  }, []);

  const family = searchParams.get("roleFamily") ?? "";
  useEffect(() => {
    let cancelled = false;
    const load = family
      ? fetchJson<Option[]>(`/api/roles?roleFamily=${encodeURIComponent(family)}`).catch(() => [] as Option[])
      : Promise.resolve([] as Option[]);
    void load.then((list) => {
      if (!cancelled) setRoles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [family]);

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const onQ = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q: value || null }), 450);
  };

  const hasFilters = useMemo(
    () =>
      Array.from(searchParams.keys()).some(
        (k) => !["page", "sort", "limit"].includes(k),
      ),
    [searchParams],
  );

  const body = (
    <div className="space-y-5">
      <div>
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          type="search"
          placeholder="Company, role or level…"
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </div>

      <FilterGroup label="Company">
        <Select
          aria-label="Filter by company"
          value={searchParams.get("company") ?? ""}
          onChange={(e) => push({ company: e.target.value || null })}
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.slug ?? c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup label="Role family">
        <Select
          aria-label="Filter by role family"
          value={family}
          onChange={(e) => push({ roleFamily: e.target.value || null, role: null })}
        >
          <option value="">All role families</option>
          {families.map((f) => (
            <option key={f.id} value={f.slug ?? f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup label="Role">
        <Select
          aria-label="Filter by role"
          value={searchParams.get("role") ?? ""}
          onChange={(e) => push({ role: e.target.value || null })}
          disabled={!family}
        >
          <option value="">{family ? "All roles" : "Select a role family first"}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup label="Canonical level">
        <Select
          aria-label="Filter by canonical level"
          value={searchParams.get("canonicalLevel") ?? ""}
          onChange={(e) => push({ canonicalLevel: e.target.value || null })}
        >
          <option value="">All levels</option>
          {[...levels]
            .sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </Select>
      </FilterGroup>

      <FilterGroup label="Location">
        <Select
          aria-label="Filter by location"
          value={searchParams.get("location") ?? ""}
          onChange={(e) => push({ location: e.target.value || null })}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.slug ?? l.id}>
              {l.name}
              {l.country ? ` (${l.country})` : ""}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup label="Total compensation (min – max)">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum total compensation"
            type="number"
            min={0}
            placeholder="Min"
            defaultValue={searchParams.get("minTC") ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if ((searchParams.get("minTC") ?? "") !== v) push({ minTC: v || null });
            }}
          />
          <span className="text-stone-400" aria-hidden="true">–</span>
          <Input
            aria-label="Maximum total compensation"
            type="number"
            min={0}
            placeholder="Max"
            defaultValue={searchParams.get("maxTC") ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if ((searchParams.get("maxTC") ?? "") !== v) push({ maxTC: v || null });
            }}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="Years of experience (min – max)">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum years of experience"
            type="number"
            min={0}
            max={60}
            placeholder="Min"
            defaultValue={searchParams.get("minExperience") ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if ((searchParams.get("minExperience") ?? "") !== v) push({ minExperience: v || null });
            }}
          />
          <span className="text-stone-400" aria-hidden="true">–</span>
          <Input
            aria-label="Maximum years of experience"
            type="number"
            min={0}
            max={60}
            placeholder="Max"
            defaultValue={searchParams.get("maxExperience") ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if ((searchParams.get("maxExperience") ?? "") !== v) push({ maxExperience: v || null });
            }}
          />
        </div>
      </FilterGroup>

      {hasFilters && (
        <Button variant="secondary" size="sm" className="w-full" onClick={() => router.push(pathname)}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="mb-3 lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 3.5h11M3.5 7h7M5.5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {open ? "Hide filters" : "Show filters"}
        </Button>
      </div>
      <aside
        className={cn(
          "rounded-xl border border-stone-200 bg-white p-4 lg:sticky lg:top-[4.5rem] lg:w-72 lg:shrink-0",
          open ? "block" : "hidden lg:block",
        )}
      >
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-stone-500">Filters</h2>
        {body}
      </aside>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------------------- Sort control --------------------------- */

export function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") ?? "newest";

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-[13px] text-stone-500">
        Sort by
      </label>
      <Select
        id="sort"
        aria-label="Sort compensation records"
        className="w-auto"
        value={sort}
        onChange={(e) => {
          const params = new URLSearchParams(Array.from(searchParams.entries()));
          params.set("sort", e.target.value);
          params.delete("page");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
      >
        <option value="newest">Newest submission</option>
        <option value="tc_desc">Highest total compensation</option>
        <option value="tc_asc">Lowest total compensation</option>
        <option value="base_desc">Highest base salary</option>
        <option value="stock_desc">Highest stock</option>
        <option value="bonus_desc">Highest bonus</option>
      </Select>
    </div>
  );
}
