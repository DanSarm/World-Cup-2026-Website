"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="card max-w-md mx-auto text-center space-y-4 py-8">
      <p className="text-2xl" aria-hidden>
        ⚽
      </p>
      <h1 className="text-lg font-bold text-ink">Could not load this page</h1>
      <p className="text-sm text-ink-muted">
        Try refreshing. If you added the app to your Home Screen, remove it and
        open the site in Safari once, then add it again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="btn-primary px-6 py-2.5 text-sm font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
