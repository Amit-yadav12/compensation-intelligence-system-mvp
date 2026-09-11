"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/format";
import type { SessionUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/compensation", label: "Compensation" },
  { href: "/companies", label: "Companies" },
  { href: "/compare", label: "Compare" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/methodology", label: "Methodology" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 focus-ring rounded-md" aria-label="CompScope home">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="24" height="24" rx="6" className="fill-stone-900" />
        <rect x="6" y="14" width="3.4" height="6" rx="1" className="fill-indigo-300" />
        <rect x="11.3" y="10" width="3.4" height="10" rx="1" className="fill-indigo-400" />
        <rect x="16.6" y="6" width="3.4" height="14" rx="1" className="fill-indigo-500" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight text-stone-900">CompScope</span>
    </Link>
  );
}

export function Nav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#fafaf9]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-stone-900 font-medium text-white"
                    : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[160px] truncate text-sm text-stone-600">{user.name}</span>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="focus-ring rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-100 disabled:opacity-50"
              >
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="focus-ring rounded-md px-3 py-1.5 text-sm text-stone-600 transition-colors hover:text-stone-900"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="focus-ring rounded-md bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
              >
                Sign up
              </Link>
            </div>
          )}
          <Link
            href="/submit"
            className="focus-ring hidden rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 md:block"
          >
            Submit compensation
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 text-stone-700 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {open ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div id="mobile-nav" className="border-t border-stone-200 bg-[#fafaf9] px-4 pb-4 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-md px-3 py-2.5 text-[15px]",
                  isActive(item.href)
                    ? "bg-stone-900 font-medium text-white"
                    : "text-stone-700 hover:bg-stone-200/60",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md bg-indigo-600 px-3 py-2.5 text-center text-[15px] font-medium text-white"
            >
              Submit compensation
            </Link>
            <div className="mt-2 border-t border-stone-200 pt-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="focus-ring w-full rounded-md px-3 py-2.5 text-left text-[15px] text-stone-700 hover:bg-stone-200/60"
                >
                  Sign out ({user.name})
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border border-stone-300 px-3 py-2.5 text-center text-[15px] text-stone-700"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md bg-stone-900 px-3 py-2.5 text-center text-[15px] font-medium text-white"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
