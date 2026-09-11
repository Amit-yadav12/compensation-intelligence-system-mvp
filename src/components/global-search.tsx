"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GlobalSearch({
  placeholder,
  size = "lg",
  autoFocus = false,
}: {
  placeholder: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/compensation?q=${encodeURIComponent(query)}` : "/compensation");
  }

  return (
    <form onSubmit={submit} role="search" className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search company, role or level"
          className={`focus-ring w-full rounded-lg border border-stone-300 bg-white pl-10 pr-4 text-stone-900 shadow-sm placeholder:text-stone-400 ${
            size === "lg" ? "py-3 text-[15px]" : "py-2.5 text-sm"
          }`}
        />
      </div>
      <button
        type="submit"
        className={`focus-ring rounded-lg bg-stone-900 font-medium text-white transition-colors hover:bg-stone-700 ${
          size === "lg" ? "px-5 text-[15px]" : "px-4 text-sm"
        }`}
      >
        Search
      </button>
    </form>
  );
}
