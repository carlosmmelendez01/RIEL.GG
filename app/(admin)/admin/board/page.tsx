/**
 * Board (league-wide analytics) — NOT part of the MVP.
 *
 * The full forfeit/analytics dashboard is out of scope for the lean launch.
 * It's hidden from navigation and this route shows a clear notice instead.
 * The original implementation + loaders (lib/board/*) remain in the repo and
 * can be re-enabled after launch — see git history for the previous page.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireLeagueAdmin } from "@/lib/league-admin/dashboard";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/board");
  const ctx = await requireLeagueAdmin(user.id);
  if (!ctx) redirect("/dashboard");

  return (
    <>
      <AdminTopbar title="Board" eyebrow={ctx.league.name} />
      <main className="flex-1 px-6 py-12 md:px-8">
        <Card className="mx-auto max-w-lg border-dashed border-border/80 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Not in this release
            </p>
            <h1 className="text-balance text-xl font-semibold tracking-tight">
              League analytics isn&apos;t part of the MVP yet.
            </h1>
            <p className="max-w-sm text-balance text-[13px] leading-relaxed text-muted-foreground">
              The board view (forfeit trends, league-wide aggregates, exports) is on the
              post-launch roadmap. For now, standings and per-match results cover the
              numbers you need to run the season.
            </p>
            <Link
              href="/admin"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
