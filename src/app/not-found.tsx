import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <EmptyState
        title="Page not found"
        body="The company, record or page you're looking for doesn't exist in CompScope. It may have been mistyped or removed."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/compensation" className="focus-ring rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
              Explore compensation
            </Link>
            <Link href="/companies" className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
              Browse companies
            </Link>
          </div>
        }
      />
    </div>
  );
}
