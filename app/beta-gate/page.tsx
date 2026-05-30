/**
 * Beta access gate.
 *
 * Shown when BETA_ACCESS_PASSWORD is set and the visitor hasn't presented a
 * valid cookie. A plain form POST (works without JS) hands the password to
 * /beta-gate/submit, which validates and sets the access cookie.
 *
 * If the gate isn't enabled, there's nothing to enter — send people home.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BetaGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!process.env.BETA_ACCESS_PASSWORD) redirect("/");

  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
          <span className="rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
            Private beta
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-border/60 bg-card/80">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl tracking-tight">RIEL.GG is in private beta</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the access password you were given to continue.
            </p>
          </CardHeader>
          <CardContent>
            <form action="/beta-gate/submit" method="POST" className="space-y-3">
              <input type="hidden" name="next" value={safeNext} />
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  name="password"
                  autoFocus
                  required
                  placeholder="Access password"
                  className="h-11 flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
              {error ? (
                <p className="text-[12px] text-[color:var(--brand-crimson)]">
                  That password didn&apos;t match. Try again.
                </p>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--brand-crimson)] text-sm font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                Enter beta
              </button>
            </form>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Don&apos;t have access? Email{" "}
              <span className="font-mono">hello@riel.gg</span> for a beta invite.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
