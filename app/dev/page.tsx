/**
 * Demo sign-in launcher.
 *
 * Lists seeded accounts grouped by role and lets you sign in as any of them
 * with one click — no email needed. Uses the service-role key to apply a
 * known demo password and write a real session (see /dev/sign-in route).
 *
 * Gated by ENABLE_DEMO_AUTH (not NODE_ENV), so it works on a deployed beta
 * when the flag is on. Returns 404 when the flag is off.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

type DemoAccount = {
  id: string;
  fullName: string;
  email: string;
  subtitle: string;
  featured: boolean;
};

// Hero accounts for the demo — the league + school with the richest seeded
// data (most competitions, matches, and history). Surfacing these first
// keeps a live demo on the populated happy path.
const FEATURED_EMAILS = new Set([
  "cmelendez@riel.gg", // RIEL Esports League owner → rich /admin
  "rpatel@hse.k12.in.us", // Fishers manager → rich /dashboard (25 matches)
]);

export default async function DemoSignInIndex() {
  if (!env.ENABLE_DEMO_AUTH) notFound();

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
    include: {
      schoolMemberships: { include: { school: true } },
      leagueAdminships: { include: { league: true } },
    },
  });

  // Bucket each user by their most privileged role so the demo viewer can
  // pick the experience they want to see.
  const admins: DemoAccount[] = [];
  const managers: DemoAccount[] = [];
  const coaches: DemoAccount[] = [];
  const players: DemoAccount[] = [];

  for (const u of users) {
    const featured = FEATURED_EMAILS.has(u.email.toLowerCase());
    const la = u.leagueAdminships[0];
    if (la) {
      admins.push({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        subtitle: `${la.league.name} · ${la.role.toLowerCase()}`,
        featured,
      });
      continue;
    }
    // Highest school role wins
    const roleRank = { MANAGER: 3, COACH: 2, PLAYER: 1 } as const;
    const top = [...u.schoolMemberships].sort(
      (a, b) => (roleRank[b.role] ?? 0) - (roleRank[a.role] ?? 0),
    )[0];
    if (!top) continue;
    const acct: DemoAccount = {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      subtitle: `${top.school.shortName ?? top.school.name}${top.isOwner ? " · owner" : ""}`,
      featured,
    };
    if (top.role === "MANAGER") managers.push(acct);
    else if (top.role === "COACH") coaches.push(acct);
    else players.push(acct);
  }

  // Featured accounts float to the top of their group.
  const featuredFirst = (a: DemoAccount, b: DemoAccount) =>
    Number(b.featured) - Number(a.featured);
  admins.sort(featuredFirst);
  managers.sort(featuredFirst);
  coaches.sort(featuredFirst);
  players.sort(featuredFirst);

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
          <span className="rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
            Demo mode
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Try RIEL.GG
          </p>
          <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight">
            Pick a demo account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One click signs you in as a real seeded account — no email, no password. Start
            with a league admin to see the operator view, or a coach to see the school side.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 px-2.5 py-1 text-[12px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[color:var(--brand-gold)]" />
            New here? The <span className="font-semibold text-foreground">Recommended</span>{" "}
            accounts land on the richest data — start there.
          </p>
        </div>

        <RoleGroup
          icon={ShieldCheck}
          tone="gold"
          title="League admins"
          blurb="Run the league: review applications, approve rosters, generate schedules, resolve disputes."
          accounts={admins}
          lands="/admin"
        />
        <RoleGroup
          icon={Building2}
          tone="crimson"
          title="School managers"
          blurb="Own a school: invite coaches + players, create teams, register for competitions."
          accounts={managers}
          lands="/dashboard"
        />
        <RoleGroup
          icon={GraduationCap}
          tone="purple"
          title="Coaches"
          blurb="Run teams: manage rosters, report match scores, track standings."
          accounts={coaches}
          lands="/dashboard"
        />
        <RoleGroup
          icon={UserCircle2}
          tone="muted"
          title="Players"
          blurb="The player view: profile, upcoming matches, and team membership."
          accounts={players}
          lands="/me"
        />

        <Card className="mt-6 border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
            <div className="text-[12px] text-muted-foreground">
              <p className="font-semibold text-foreground">This is real data.</p>
              <p className="mt-1">
                Demo accounts act on the live database — applications you approve, rosters you
                build, and scores you report all persist. Real magic-link sign-in lives at{" "}
                <Link href="/login" className="underline hover:text-foreground">
                  /login
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

const TONE: Record<string, { ring: string; chip: string; icon: string }> = {
  gold: {
    ring: "border-[color:var(--brand-gold)]/30",
    chip: "bg-[color:var(--brand-gold)]/15 text-[color:var(--brand-gold)]",
    icon: "text-[color:var(--brand-gold)]",
  },
  crimson: {
    ring: "border-[color:var(--brand-crimson)]/30",
    chip: "bg-[color:var(--brand-crimson)]/15 text-[color:var(--brand-crimson)]",
    icon: "text-[color:var(--brand-crimson)]",
  },
  purple: {
    ring: "border-[color:var(--brand-purple)]/30",
    chip: "bg-[color:var(--brand-purple)]/15 text-[color:var(--brand-purple)]",
    icon: "text-[color:var(--brand-purple)]",
  },
  muted: {
    ring: "border-border/60",
    chip: "bg-muted text-muted-foreground",
    icon: "text-muted-foreground",
  },
};

function RoleGroup({
  icon: Icon,
  tone,
  title,
  blurb,
  accounts,
  lands,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONE | string;
  title: string;
  blurb: string;
  accounts: DemoAccount[];
  lands: string;
}) {
  if (accounts.length === 0) return null;
  const t = TONE[tone] ?? TONE.muted;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", t.icon)} />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          lands on {lands}
        </span>
      </div>
      <p className="mb-2 text-[12px] text-muted-foreground">{blurb}</p>
      <Card className={cn("bg-card/80", t.ring)}>
        <CardContent className="space-y-1 px-2 py-2">
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/dev/sign-in?email=${encodeURIComponent(a.email)}`}
              className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border/60 hover:bg-card"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold",
                  t.chip,
                )}
              >
                {deriveInitials(a.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {a.fullName}
                  {a.featured ? (
                    <span className="inline-flex items-center gap-0.5 rounded-[4px] border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1 py-0 text-[9px] font-bold uppercase tracking-wider text-[color:var(--brand-gold)]">
                      Recommended
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{a.email}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.subtitle}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function deriveInitials(fullName: string) {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}
