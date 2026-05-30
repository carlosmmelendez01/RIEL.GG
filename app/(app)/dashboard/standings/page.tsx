/**
 * Standings view.
 *
 * Cross-school by nature (you can't see your rank without seeing rivals),
 * but the SET of standings tables is scoped — only competitions the coach's
 * school participates in show up. A coach at a school with zero teams sees
 * the "register your teams first" empty state instead of a wall of mock
 * tables for games their school doesn't even compete in.
 */

import { redirect } from "next/navigation";
import { Crown, Flame } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadCoachStandingsTables, type StandingsTable } from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

export default async function StandingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/standings");

  const data = await loadCoachStandingsTables(user.id);
  if (!data) {
    return (
      <>
        <Topbar title="Standings" eyebrow="Coach view" />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-school" />
        </main>
      </>
    );
  }

  if (data.tables.length === 0) {
    return (
      <>
        <Topbar title="Standings" eyebrow={data.schoolName} />
        <main className="flex-1 px-6 py-12 md:px-8">
          <DashboardEmptyState kind="no-teams" schoolName={data.schoolName} />
        </main>
      </>
    );
  }

  const defaultGame = data.tables[0].game;

  return (
    <>
      <Topbar
        title="Standings"
        eyebrow={`${data.schoolName} · ${data.tables.length} competition${data.tables.length === 1 ? "" : "s"}`}
      />

      <main className="flex-1 px-6 py-6 md:px-8">
        <Tabs defaultValue={defaultGame} className="w-full">
          <TabsList className="mb-6 flex flex-wrap">
            {data.tables.map((t) => (
              <TabsTrigger key={t.competitionId} value={t.game}>
                {t.game}
              </TabsTrigger>
            ))}
          </TabsList>

          {data.tables.map((t) => (
            <TabsContent key={t.competitionId} value={t.game}>
              <StandingsTableView table={t} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </>
  );
}

function StandingsTableView({ table }: { table: StandingsTable }) {
  if (table.rows.length === 0) {
    return <DashboardEmptyState kind="no-standings" />;
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {table.game}
        </p>
        <CardTitle className="text-base">{table.competitionName}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Team</th>
              <th className="px-3 py-2 text-right font-medium">W</th>
              <th className="px-3 py-2 text-right font-medium">L</th>
              <th className="px-3 py-2 text-right font-medium">PCT</th>
              <th className="px-3 py-2 text-right font-medium">STREAK</th>
              <th className="px-4 py-2 text-right font-medium">PTS</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const totalGames = row.wins + row.losses;
              const winPct = totalGames > 0 ? row.wins / totalGames : 0;
              return (
                <tr
                  key={row.rosterId}
                  className={cn(
                    "border-b border-border/30 transition-colors hover:bg-card",
                    row.isOwnTeam && "bg-[color:var(--brand-crimson)]/8",
                  )}
                >
                  <td className="px-4 py-3 text-left">
                    {row.rank === 1 ? (
                      <Crown className="h-4 w-4 text-[color:var(--brand-gold)]" />
                    ) : (
                      <span className="font-mono tabular-nums text-muted-foreground">{row.rank}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold text-white">
                        {row.schoolShort
                          .replace(/[^A-Za-z]/g, "")
                          .slice(0, 3)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className={cn("text-[13px]", row.isOwnTeam ? "font-semibold" : "")}>
                          {row.teamName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {row.schoolShort}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{row.wins}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {row.losses}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {(winPct * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.streak >= 3 ? (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-[color:var(--brand-gold)]">
                        <Flame className="h-3 w-3" />W{row.streak}
                      </span>
                    ) : row.streak > 0 ? (
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">
                        W{row.streak}
                      </span>
                    ) : row.streak < 0 ? (
                      <span className="font-mono text-[color:var(--brand-crimson)]">
                        L{Math.abs(row.streak)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
