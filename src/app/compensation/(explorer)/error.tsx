"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

export default function CompensationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[compensation] page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <ErrorState
        title="We couldn't load compensation records"
        body="An unexpected error occurred while querying the database. Please try again."
      />
      <button
        type="button"
        onClick={reset}
        className="focus-ring mt-4 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        Try again
      </button>
    </div>
  );
}
