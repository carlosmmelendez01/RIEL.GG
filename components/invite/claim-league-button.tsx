"use client";

/**
 * Claim-league button — fires `acceptLeagueInvite` and on success forwards the
 * new owner into the league admin dashboard. Sibling of <ClaimButton> (schools).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Sparkles } from "lucide-react";

import {
  acceptLeagueInvite,
  type AcceptLeagueInviteResult,
} from "@/lib/invite/invite-actions";
import { cn } from "@/lib/utils";

export function ClaimLeagueButton({
  code,
  leagueName,
}: {
  code: string;
  leagueName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AcceptLeagueInviteResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await acceptLeagueInvite({ code });
      setResult(r);
      if (r.ok) {
        setTimeout(() => router.push("/admin"), 700);
      }
    });
  }

  return (
    <div className="space-y-3">
      {result?.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[13px]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold">
              You&apos;re now the {result.role.toLowerCase()} of {result.leagueName}.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Taking you to your league dashboard…
            </p>
          </div>
        </div>
      ) : null}

      {result && !result.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[13px] text-[color:var(--brand-crimson)]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{result.error}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending || result?.ok}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--brand-crimson)] px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50 glow-crimson-sm",
        )}
      >
        <Sparkles className="h-4 w-4" />
        {pending
          ? "Claiming…"
          : result?.ok
            ? "Claimed!"
            : `Claim ${leagueName}`}
      </button>
    </div>
  );
}
