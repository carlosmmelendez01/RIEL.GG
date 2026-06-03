"use client";

/**
 * Route-segment error boundary.
 *
 * Renders for any thrown error in app/* (other than layout / not-found).
 * Soft-recovers via `reset()` — never asks the user to log out, restart,
 * or refresh. The "Get help" button creates an emergency support thread
 * pre-filled with route + error reference so we can reach the user back.
 */

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

import { ReportIssueButton } from "@/components/support/report-issue-button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Fire-and-forget client log; server logs already captured the throw
    if (typeof window !== "undefined") {
      console.error("[route-error]", error.message, { digest: error.digest });
    }
  }, [error]);

  function tryAgain() {
    startTransition(() => reset());
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 p-3">
        <RefreshCw className="h-6 w-6 text-[color:var(--brand-crimson)]" />
      </div>

      <h1 className="mt-6 text-balance text-2xl font-semibold tracking-tight">
        Something stopped working.
      </h1>
      <p className="mt-2 max-w-md text-balance text-[14px] leading-relaxed text-muted-foreground">
        We&apos;ve already saved a report on our end. You don&apos;t need to log out or restart anything —
        try again or pick a different option below.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={tryAgain}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {pending ? "Retrying…" : "Try again"}
        </button>
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-card"
        >
          <Home className="h-3.5 w-3.5" />
          Go home
        </Link>
        <ReportIssueButton
          context={{
            route: typeof window !== "undefined" ? window.location.pathname : "/",
            errorDigest: error.digest ?? null,
          }}
        />
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Reference · {error.digest}
        </p>
      ) : null}
    </div>
  );
}
