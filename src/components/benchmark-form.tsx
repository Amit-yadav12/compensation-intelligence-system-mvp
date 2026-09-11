"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CohortFields, type CohortValues } from "@/components/cohort-fields";
import { Button, Card } from "@/components/ui";

/**
 * Benchmark form — URL-driven. The form writes cohort params to the URL; the
 * server component reads them, validates and computes the benchmark. This
 * keeps state shareable, refresh-safe and back-button-friendly.
 */
export function BenchmarkForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState<CohortValues>({
    roleFamily: searchParams.get("roleFamily") ?? "",
    role: searchParams.get("role") ?? "",
    canonicalLevel: searchParams.get("canonicalLevel") ?? "",
    location: searchParams.get("location") ?? "",
    minExperience: searchParams.get("minExperience") ?? "",
    maxExperience: searchParams.get("maxExperience") ?? "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (value.roleFamily) params.set("roleFamily", value.roleFamily);
    if (value.role) params.set("role", value.role);
    if (value.canonicalLevel) params.set("canonicalLevel", value.canonicalLevel);
    if (value.location) params.set("location", value.location);
    if (value.minExperience) params.set("minExperience", value.minExperience);
    if (value.maxExperience) params.set("maxExperience", value.maxExperience);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasCohort = value.roleFamily && value.role && value.canonicalLevel && value.location;

  return (
    <Card className="p-5">
      <form onSubmit={submit}>
        <CohortFields value={value} onChange={setValue} idPrefix="bm-" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-stone-400">
            A benchmark is only meaningful for a tightly defined cohort.
          </p>
          <Button type="submit" disabled={!hasCohort}>
            Run benchmark
          </Button>
        </div>
      </form>
    </Card>
  );
}
