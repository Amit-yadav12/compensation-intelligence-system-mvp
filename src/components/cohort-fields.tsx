"use client";

import { useEffect, useState } from "react";
import { Input, Label, Select } from "@/components/ui";

export type CohortValues = {
  roleFamily: string;
  role: string;
  canonicalLevel: string;
  location: string;
  minExperience: string;
  maxExperience: string;
};

export const EMPTY_COHORT: CohortValues = {
  roleFamily: "",
  role: "",
  canonicalLevel: "",
  location: "",
  minExperience: "",
  maxExperience: "",
};

type Option = { id: string; name: string; slug?: string; rank?: number; country?: string };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return ((await res.json()) as { data: T }).data;
}

/**
 * Shared cohort selector fields. A cohort is the unit of valid comparison:
 * role family + role + canonical level + location (+ optional experience band).
 */
export function CohortFields({
  value,
  onChange,
  idPrefix = "",
}: {
  value: CohortValues;
  onChange: (v: CohortValues) => void;
  idPrefix?: string;
}) {
  const [families, setFamilies] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);

  useEffect(() => {
    Promise.all([
      fetchJson<Option[]>("/api/role-families"),
      fetchJson<Option[]>("/api/levels"),
      fetchJson<Option[]>("/api/locations"),
    ])
      .then(([f, l, loc]) => {
        setFamilies(f);
        setLevels(l);
        setLocations(loc);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const family = value.roleFamily;
    const load = family
      ? fetchJson<Option[]>(`/api/roles?roleFamily=${encodeURIComponent(family)}`).catch(() => [] as Option[])
      : Promise.resolve([] as Option[]);
    void load.then((list) => {
      if (!cancelled) setRoles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [value.roleFamily]);

  const set = (patch: Partial<CohortValues>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}roleFamily`}>Role family *</Label>
        <Select
          id={`${idPrefix}roleFamily`}
          value={value.roleFamily}
          onChange={(e) => set({ roleFamily: e.target.value, role: "" })}
        >
          <option value="">Select role family</option>
          {families.map((f) => (
            <option key={f.id} value={f.slug ?? f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}role`}>Role *</Label>
        <Select
          id={`${idPrefix}role`}
          value={value.role}
          onChange={(e) => set({ role: e.target.value })}
          disabled={!value.roleFamily}
        >
          <option value="">{value.roleFamily ? "Select role" : "Select a family first"}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}level`}>Canonical level *</Label>
        <Select
          id={`${idPrefix}level`}
          value={value.canonicalLevel}
          onChange={(e) => set({ canonicalLevel: e.target.value })}
        >
          <option value="">Select level</option>
          {[...levels]
            .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}location`}>Location *</Label>
        <Select
          id={`${idPrefix}location`}
          value={value.location}
          onChange={(e) => set({ location: e.target.value })}
        >
          <option value="">Select location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.slug ?? l.id}>
              {l.name}
              {l.country ? ` (${l.country})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}minExp`} hint="optional">
          Min experience (years)
        </Label>
        <Input
          id={`${idPrefix}minExp`}
          type="number"
          min={0}
          max={60}
          value={value.minExperience}
          onChange={(e) => set({ minExperience: e.target.value })}
          placeholder="e.g. 4"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}maxExp`} hint="optional">
          Max experience (years)
        </Label>
        <Input
          id={`${idPrefix}maxExp`}
          type="number"
          min={0}
          max={60}
          value={value.maxExperience}
          onChange={(e) => set({ maxExperience: e.target.value })}
          placeholder="e.g. 6"
        />
      </div>
    </div>
  );
}
