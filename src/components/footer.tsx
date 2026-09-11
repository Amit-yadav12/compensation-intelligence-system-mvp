import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-stone-200 bg-[#f4f3f1]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <p className="text-[15px] font-semibold tracking-tight text-stone-900">CompScope</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">
              Level-aware compensation intelligence. Normalize company, role, level and location —
              then compare base, bonus, stock and total compensation.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm" aria-label="Footer">
            <Link href="/compensation" className="focus-ring rounded text-stone-600 hover:text-stone-900">Compensation</Link>
            <Link href="/companies" className="focus-ring rounded text-stone-600 hover:text-stone-900">Companies</Link>
            <Link href="/compare" className="focus-ring rounded text-stone-600 hover:text-stone-900">Compare</Link>
            <Link href="/benchmark" className="focus-ring rounded text-stone-600 hover:text-stone-900">Benchmark</Link>
            <Link href="/methodology" className="focus-ring rounded text-stone-600 hover:text-stone-900">Methodology</Link>
            <Link href="/submit" className="focus-ring rounded text-stone-600 hover:text-stone-900">Submit data</Link>
            <Link href="/login" className="focus-ring rounded text-stone-600 hover:text-stone-900">Log in</Link>
          </nav>
        </div>
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-amber-900">
            <strong>Demo dataset notice.</strong> The compensation records in this demonstration are
            synthetic, generated to showcase the system&apos;s architecture, querying, analytics and
            workflows. They are not presented as verified employee-reported data.
          </p>
        </div>
        <p className="mt-6 text-xs text-stone-400">
          CompScope · Levels matter more than job titles.
        </p>
      </div>
    </footer>
  );
}
