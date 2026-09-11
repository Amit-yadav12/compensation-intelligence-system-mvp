/**
 * Display formatting — currency, dates, quality labels.
 *
 * Product-wide money representation:
 *   INR → lakh/crore compact ("₹42.0L", "₹1.25Cr"), exact below ₹1L
 *   USD → compact K/M ("$195K", "$1.20M"), exact below $1K
 * Every compensation figure in the UI goes through formatMoney so numbers
 * look identical on the explorer, company page, compare and benchmark.
 */

export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (currency === "INR") {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
    return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
  }
  if (currency === "USD") {
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  }
  return `${sign}${currency} ${Math.round(abs).toLocaleString()}`;
}

/** Exact, non-compact currency (used in detail views): ₹42,00,000 / $195,000. */
export function formatMoneyExact(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** Signed percentage from a ratio: 0.274 → "+27%", -0.05 → "-5%". */
export function formatPercent(ratio: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
  if (ratio == null || Number.isNaN(ratio) || !Number.isFinite(ratio)) return "—";
  const { signed = true, digits = 0 } = opts;
  const value = (ratio * 100).toFixed(digits);
  const sign = signed && ratio > 0 ? "+" : "";
  return `${sign}${value}%`;
}

/** Compact integer: 6374 → "6,374"; 1250000 → "1.25M". */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

export function formatDate(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export function formatDateFull(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function relativeDays(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(months / 12)} year${months >= 24 ? "s" : ""} ago`;
}

export const QUALITY_COPY: Record<"low" | "moderate" | "strong", { label: string; hint: string }> = {
  low: { label: "Low coverage", hint: "Fewer than 10 records — indicative only." },
  moderate: { label: "Moderate coverage", hint: "10–49 records — usable, will improve." },
  strong: { label: "Strong coverage", hint: "50+ records — solid signal." },
};

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
