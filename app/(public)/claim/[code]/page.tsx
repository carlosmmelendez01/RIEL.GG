/**
 * /claim/[code] — invite acceptance page.
 *
 * Walks the user through the four states an invite can be in from the
 * viewer's perspective:
 *
 *   1. Invite doesn't exist / wrong scope                 → invalid card
 *   2. Invite is expired / revoked / exhausted            → already-used card
 *   3. Invite is valid but viewer is signed-out           → sign-in prompt
 *   4. Invite is valid, viewer signed-in, email mismatch  → mismatch warning
 *   5. Invite is valid, viewer signed-in, email matches   → claim CTA
 *
 * The accept action lives in lib/invite/invite-actions.ts — this page only
 * displays state. The `<ClaimButton>` island handles the actual mutation.
 */

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  Mail,
  Sparkles,
} from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaimButton } from "@/components/invite/claim-button";
import { ClaimLeagueButton } from "@/components/invite/claim-league-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [invite, user] = await Promise.all([
    prisma.invite.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        scope: true,
        status: true,
        intendedEmail: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        rolesGranted: true,
        grantsOwnership: true,
        school: {
          select: {
            id: true,
            name: true,
            shortName: true,
            city: true,
            state: true,
          },
        },
        league: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    getCurrentUser(),
  ]);

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
          {user ? (
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-xl">
          {invite && invite.scope === "SCHOOL" && invite.school ? (
            <ResolveState
              invite={{ ...invite, scope: invite.scope, school: invite.school }}
              user={user}
            />
          ) : invite && invite.scope === "LEAGUE" && invite.league ? (
            <ResolveLeagueState
              invite={{ ...invite, scope: invite.scope, league: invite.league }}
              user={user}
            />
          ) : (
            <InvalidCard />
          )}
        </div>
      </main>
    </div>
  );
}

// --- State resolver -----------------------------------------------------

type ResolvedInvite = {
  id: string;
  code: string;
  scope: "SCHOOL" | "LEAGUE";
  status: "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";
  intendedEmail: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  rolesGranted: string[];
  grantsOwnership: boolean;
  school: {
    id: string;
    name: string;
    shortName: string | null;
    city: string | null;
    state: string | null;
  };
};

function ResolveState({
  invite,
  user,
}: {
  invite: ResolvedInvite;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  const now = new Date();
  const expired =
    invite.status === "EXPIRED" ||
    (invite.expiresAt !== null && invite.expiresAt < now);
  const exhausted =
    invite.status === "EXHAUSTED" || invite.usedCount >= invite.maxUses;
  const revoked = invite.status === "REVOKED";

  if (revoked) return <TerminalCard kind="revoked" school={invite.school} />;
  if (exhausted) return <TerminalCard kind="exhausted" school={invite.school} />;
  if (expired) return <TerminalCard kind="expired" school={invite.school} />;

  if (!user) {
    return <SignedOutCard code={invite.code} invite={invite} />;
  }

  if (
    invite.intendedEmail &&
    invite.intendedEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return <EmailMismatchCard invite={invite} viewerEmail={user.email} />;
  }

  return <ReadyToClaimCard invite={invite} />;
}

// --- League state resolver ---------------------------------------------

type ResolvedLeagueInvite = {
  id: string;
  code: string;
  scope: "SCHOOL" | "LEAGUE";
  status: "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";
  intendedEmail: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  rolesGranted: string[];
  grantsOwnership: boolean;
  league: { id: string; name: string; slug: string };
};

function ResolveLeagueState({
  invite,
  user,
}: {
  invite: ResolvedLeagueInvite;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  const now = new Date();
  const expired =
    invite.status === "EXPIRED" ||
    (invite.expiresAt !== null && invite.expiresAt < now);
  const exhausted =
    invite.status === "EXHAUSTED" || invite.usedCount >= invite.maxUses;
  const revoked = invite.status === "REVOKED";

  if (revoked) return <TerminalCard kind="revoked" school={{ name: invite.league.name }} />;
  if (exhausted) return <TerminalCard kind="exhausted" school={{ name: invite.league.name }} />;
  if (expired) return <TerminalCard kind="expired" school={{ name: invite.league.name }} />;

  if (!user) {
    return <LeagueSignedOutCard code={invite.code} invite={invite} />;
  }

  if (
    invite.intendedEmail &&
    invite.intendedEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return <LeagueEmailMismatchCard invite={invite} viewerEmail={user.email} />;
  }

  return <LeagueReadyToClaimCard invite={invite} />;
}

function LeagueSignedOutCard({
  code,
  invite,
}: {
  code: string;
  invite: { league: { name: string }; intendedEmail: string | null };
}) {
  const next = `/claim/${encodeURIComponent(code)}`;
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
          League invite
        </p>
        <CardTitle className="text-2xl tracking-tight">
          {invite.league.name} is waiting for you.
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to take ownership. We&apos;ll bring you straight back here after.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {invite.intendedEmail ? (
          <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3 text-[12px]">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
            <div>
              <p className="font-semibold">
                Use <span className="font-mono">{invite.intendedEmail}</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                This invite is locked to that address. Sign in with another and we&apos;ll
                ask you to switch.
              </p>
            </div>
          </div>
        ) : null}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
          )}
        >
          <Mail className="mr-2 h-4 w-4" />
          Sign in with magic link
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function LeagueEmailMismatchCard({
  invite,
  viewerEmail,
}: {
  invite: { intendedEmail: string | null; league: { name: string }; code: string };
  viewerEmail: string;
}) {
  return (
    <Card className="border-[color:var(--brand-crimson)]/40 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
          Wrong account
        </p>
        <CardTitle className="text-2xl tracking-tight">
          Sign in with the invited email.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        <p className="text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-mono text-foreground">{viewerEmail}</span>, but this
          invite for <span className="font-semibold text-foreground">{invite.league.name}</span>{" "}
          is locked to{" "}
          <span className="font-mono text-foreground">{invite.intendedEmail}</span>.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/claim/${invite.code}`)}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Sign in as a different user
          </Link>
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Skip — go to dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LeagueReadyToClaimCard({
  invite,
}: {
  invite: {
    code: string;
    league: { name: string; slug: string };
    grantsOwnership: boolean;
    expiresAt: Date | null;
  };
}) {
  return (
    <Card className="border-emerald-500/40 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
          Ready to claim
        </p>
        <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          {invite.league.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You&apos;re about to become the {invite.grantsOwnership ? "owner" : "admin"} of this
          league on RIEL.GG.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-[13px]">
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
          <DetailRow icon={Building2} label="League">
            <span className="font-medium">{invite.league.name}</span>
            <span className="text-muted-foreground"> · /{invite.league.slug}</span>
          </DetailRow>
          <DetailRow icon={CheckCircle2} label="Role">
            <span>{invite.grantsOwnership ? "Owner" : "Admin"}</span>
          </DetailRow>
          {invite.expiresAt ? (
            <DetailRow icon={Clock} label="Expires">
              {invite.expiresAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </DetailRow>
          ) : null}
        </div>

        <ClaimLeagueButton code={invite.code} leagueName={invite.league.name} />

        <p className="text-[11px] text-muted-foreground">
          After claiming you can approve schools, create competitions, generate
          schedules, and run your seasons from the admin dashboard.
        </p>
      </CardContent>
    </Card>
  );
}

// --- Cards --------------------------------------------------------------

function InvalidCard() {
  return (
    <Card className="border-dashed border-border/80 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <CircleAlert className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Invalid link
        </p>
        <h1 className="max-w-md text-balance text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that invite.
        </h1>
        <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
          The link may be mistyped or the invite may have been revoked. Ask the league
          admin who sent it to issue a new one.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 inline-flex")}
        >
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}

function TerminalCard({
  kind,
  school,
}: {
  kind: "expired" | "exhausted" | "revoked";
  school: { name: string };
}) {
  const copy = {
    expired: {
      title: "This invite has expired.",
      body: "Invites are valid for 30 days. Ask the league admin to issue a fresh one.",
    },
    exhausted: {
      title: "This invite has already been used.",
      body: `Someone has already claimed ownership of ${school.name}. If that wasn't you, contact the league admin.`,
    },
    revoked: {
      title: "This invite was revoked.",
      body: "The league admin pulled this invite. Reach out to them for a new link.",
    },
  }[kind];

  return (
    <Card className="border-dashed border-border/80 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]">
          <Clock className="h-5 w-5" />
        </div>
        <h1 className="max-w-md text-balance text-2xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
          {copy.body}
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 inline-flex")}
        >
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}

function SignedOutCard({
  code,
  invite,
}: {
  code: string;
  invite: { school: { name: string }; intendedEmail: string | null };
}) {
  const next = `/claim/${encodeURIComponent(code)}`;
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
          School invite
        </p>
        <CardTitle className="text-2xl tracking-tight">
          {invite.school.name} is waiting for you.
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to claim ownership. We&apos;ll bring you straight back here after.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {invite.intendedEmail ? (
          <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 p-3 text-[12px]">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
            <div>
              <p className="font-semibold">
                Use{" "}
                <span className="font-mono">{invite.intendedEmail}</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                This invite is locked to that address. Sign in with another and we&apos;ll
                ask you to switch.
              </p>
            </div>
          </div>
        ) : null}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
          )}
        >
          <Mail className="mr-2 h-4 w-4" />
          Sign in with magic link
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function EmailMismatchCard({
  invite,
  viewerEmail,
}: {
  invite: { intendedEmail: string | null; school: { name: string }; code: string };
  viewerEmail: string;
}) {
  return (
    <Card className="border-[color:var(--brand-crimson)]/40 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-crimson)]">
          Wrong account
        </p>
        <CardTitle className="text-2xl tracking-tight">
          Sign in with the invited email.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        <p className="text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-mono text-foreground">{viewerEmail}</span>, but this
          invite for <span className="font-semibold text-foreground">{invite.school.name}</span>{" "}
          is locked to{" "}
          <span className="font-mono text-foreground">{invite.intendedEmail}</span>.
        </p>
        <p className="text-muted-foreground">
          Sign out and use the invited address — or ask the league admin to reissue
          the invite to your current email.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Link
            href={`/login?next=${encodeURIComponent(`/claim/${invite.code}`)}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Sign in as a different user
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Skip — go to dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadyToClaimCard({
  invite,
}: {
  invite: {
    code: string;
    school: { name: string; shortName: string | null; city: string | null; state: string | null };
    rolesGranted: string[];
    grantsOwnership: boolean;
    expiresAt: Date | null;
  };
}) {
  const role =
    invite.rolesGranted.find((r) => ["MANAGER", "COACH", "PLAYER"].includes(r)) ?? "MEMBER";
  return (
    <Card className="border-emerald-500/40 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
          Ready to claim
        </p>
        <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          {invite.school.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You&apos;re about to become the {role.toLowerCase()}
          {invite.grantsOwnership ? " — and owner" : ""} of this school on RIEL.GG.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-[13px]">
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
          <DetailRow icon={Building2} label="School">
            <span className="font-medium">{invite.school.name}</span>
            {invite.school.shortName && invite.school.shortName !== invite.school.name ? (
              <span className="text-muted-foreground"> · {invite.school.shortName}</span>
            ) : null}
          </DetailRow>
          {invite.school.city ? (
            <DetailRow icon={Sparkles} label="Location">
              {invite.school.city}
              {invite.school.state ? `, ${invite.school.state}` : ""}
            </DetailRow>
          ) : null}
          <DetailRow icon={CheckCircle2} label="Role">
            <span className="capitalize">{role.toLowerCase()}</span>
            {invite.grantsOwnership ? <span className="text-[11px] text-muted-foreground"> · owner</span> : null}
          </DetailRow>
          {invite.expiresAt ? (
            <DetailRow icon={Clock} label="Expires">
              {invite.expiresAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </DetailRow>
          ) : null}
        </div>

        <ClaimButton code={invite.code} schoolName={invite.school.name} />

        <p className="text-[11px] text-muted-foreground">
          After claiming you can invite assistant coaches, create teams, and register
          for competitions from your dashboard.
        </p>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Sparkles;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
