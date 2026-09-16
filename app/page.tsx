/**
 * Home / entry.
 *
 * Signed-in users route to their workspace; everyone else gets a clean sign-in
 * landing with a path into the school application flow.
 *
 * The marketing site components (Hero, FeaturedLeagues, etc.) are kept in the
 * repo, just no longer routed here.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { ArcLightLockup } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrimaryLanding } from "@/lib/auth/landing";
import { demoAuthEnabled } from "@/lib/auth/demo";
import { cn } from "@/lib/utils";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(await getPrimaryLanding(user.id, user.email));

  const demoOn = demoAuthEnabled();

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <ArcLightLockup height={30} />
          <ThemeToggle variant="subtle" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-magenta)]/30 bg-[color:var(--brand-magenta)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-magenta)]">
            <ShieldCheck className="h-3 w-3" />
            Indiana Esports Network
          </span>

          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Scholastic esports, organized and illuminated.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-balance text-[14px] leading-relaxed text-muted-foreground">
            Run competitions, schedules, rosters, and playoffs in one place.
            Sign in with your school email or apply your school to an active league.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full max-w-xs bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>

            {demoOn ? (
              <Link
                href="/dev"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full max-w-xs border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/8 text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/15",
                )}
              >
                Try a demo account
              </Link>
            ) : null}
          </div>

          <p className="mt-8 text-[12px] text-muted-foreground">
            Need access?{" "}
            <Link href="/join" className="font-medium text-foreground hover:underline">
              Apply your school
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border/60 px-6 py-5 text-center text-[11px] text-muted-foreground">
        ArcLight · Built for the Indiana Esports Network
      </footer>
    </div>
  );
}
