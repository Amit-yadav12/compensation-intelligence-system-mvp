"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input, Button } from "@/components/ui";

export function CompanySearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname);
  }

  return (
    <form onSubmit={submit} role="search" className="flex max-w-md gap-2">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search companies… e.g. Google, Flipkart"
        aria-label="Search companies"
      />
      <Button variant="dark" type="submit">
        Search
      </Button>
    </form>
  );
}
