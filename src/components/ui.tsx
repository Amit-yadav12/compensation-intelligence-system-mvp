import Link from "next/link";
import { cn, formatMoney, QUALITY_COPY } from "@/lib/utils/format";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ------------------------------ Button ------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-500",
        variant === "dark" && "bg-stone-900 text-white hover:bg-stone-700",
        variant === "secondary" &&
          "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50",
        variant === "ghost" && "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900",
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------- Form controls --------------------------- */

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "focus-ring w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 disabled:bg-stone-100",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "focus-ring w-full appearance-none rounded-md border border-stone-300 bg-white bg-[length:16px] bg-[right_10px_center] bg-no-repeat px-3 py-2 pr-9 text-sm text-stone-900",
        props.className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' stroke='%2378716c' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-stone-700">
      {children}
      {hint && <span className="ml-1.5 font-normal text-stone-400">{hint}</span>}
    </label>
  );
}

/* ------------------------------ Card --------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-stone-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Badge -------------------------------- */

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-stone-100 text-stone-600",
  accent: "bg-indigo-50 text-indigo-700",
  positive: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  outline: "border border-stone-300 text-stone-600",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof BADGE_TONES; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function QualityBadge({ quality }: { quality: "low" | "moderate" | "strong" }) {
  const tone = quality === "strong" ? "positive" : quality === "moderate" ? "accent" : "warn";
  const copy = QUALITY_COPY[quality];
  return (
    <span title={copy.hint}>
      <Badge tone={tone}>{copy.label}</Badge>
    </span>
  );
}

/* ------------------------------- Stat -------------------------------- */

export function Stat({ label, value, sub, hint }: { label: string; value: ReactNode; sub?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-5 py-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-stone-900" title={hint}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[12px] text-stone-500">{sub}</p>}
    </div>
  );
}

/* -------------------------- Section header --------------------------- */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------------------------- Empty state ---------------------------- */

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" className="text-stone-300">
        <circle cx="16" cy="15" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m23 22 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="mt-3 text-[15px] font-medium text-stone-800">{title}</p>
      {body && <p className="mt-1 max-w-md text-[13px] leading-relaxed text-stone-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------------------- Error state ---------------------------- */

export function ErrorState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="text-[15px] font-medium text-red-800">{title}</p>
      {body && <p className="mt-1 text-[13px] text-red-600">{body}</p>}
    </div>
  );
}

/* ---------------------------- Money value ---------------------------- */

export function Money({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  return <span className={cn("tnum", className)}>{formatMoney(amount, currency)}</span>;
}

/* ----------------------------- Pagination ---------------------------- */

export function Pagination({
  page,
  totalPages,
  total,
  baseHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  baseHref: string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="py-3 text-center text-[13px] text-stone-500">
        {total} record{total === 1 ? "" : "s"}
      </p>
    );
  }
  const pageHref = (p: number) => {
    const url = new URL(baseHref, "http://placeholder");
    if (p === 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(p));
    return `${url.pathname}${url.search}`;
  };
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p++) pages.push(p);

  return (
    <nav className="flex items-center justify-between gap-3 pt-3" aria-label="Pagination">
      <p className="text-[13px] text-stone-500">
        Page <span className="tnum font-medium text-stone-700">{page}</span> of{" "}
        <span className="tnum">{totalPages}</span> · <span className="tnum">{total}</span> records
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous" />
        {pages.map((p) => (
          <Link
            key={p}
            href={pageHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "focus-ring hidden h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] tnum sm:flex",
              p === page ? "bg-stone-900 font-medium text-white" : "text-stone-600 hover:bg-stone-200/60",
            )}
          >
            {p}
          </Link>
        ))}
        <PageLink href={pageHref(page + 1)} disabled={page >= totalPages} label="Next" />
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled?: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="flex h-8 items-center rounded-md px-2.5 text-[13px] text-stone-400" aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      rel={label === "Next" ? "next" : "prev"}
      className="focus-ring flex h-8 items-center rounded-md px-2.5 text-[13px] text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
    >
      {label}
    </Link>
  );
}
