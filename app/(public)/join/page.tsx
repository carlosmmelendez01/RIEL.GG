/**
 * /join — invite-only notice.
 *
 * v1 is invite-only (single-league, Indiana Esports Network), so there's no
 * public self-application funnel. Schools are onboarded by the league admin,
 * who sends an invite link. The original 3-step `JoinWizard` component is kept
 * in the repo (unused) so public applications can be switched back on later.
 */

import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function JoinPage() {
  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="RIEL.GG home">
            <RielLockup height={30} />
          </Link>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="w-full max-w-md border-border/60 bg-card/80">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-magenta)]/30 bg-[color:var(--brand-magenta)]/10 text-[color:var(--brand-magenta)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Invite-only
            </p>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">
              RIEL.GG is invite-only right now.
            </h1>
            <p className="max-w-sm text-balance text-[13px] leading-relaxed text-muted-foreground">
              We&apos;re onboarding schools to the Indiana Esports Network directly. Reach out
              to the league office and they&apos;ll send your school an invite link to get set
              up.
            </p>

            <a
              href="mailto:hello@riel.gg?subject=Indiana%20Esports%20Network%20%E2%80%94%20school%20access"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-2 w-full bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              <Mail className="mr-2 h-4 w-4" />
              Request access
            </a>
            <Link
              href="/login"
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Already have an invite? Sign in
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
