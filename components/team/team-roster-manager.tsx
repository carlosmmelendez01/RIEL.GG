"use client";

/**
 * Coach-side roster management.
 *
 * For each Roster on the team this shows:
 *   - Status badge (PENDING / APPROVED / REJECTED) + lock state
 *   - Member list with role badges, jersey #, in-game name
 *   - "Add player" inline form (looks up by email, validates server-side)
 *   - Per-row "Remove" button (gated server-side to non-locked rosters)
 *
 * Also renders a separate "Register for competition" card listing every
 * open competition this team is eligible for, with a one-click register
 * button that creates a new Roster (PENDING).
 */

import { useState, useTransition } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  Copy,
  Crown,
  Link2,
  Lock,
  Mail,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSchoolInvite,
  type CreateSchoolInviteResult,
} from "@/lib/invite/invite-actions";
import {
  addPlayerToRoster,
  registerTeamForCompetition,
  removePlayerFromRoster,
  type AddPlayerResult,
  type RegisterTeamResult,
} from "@/lib/team/roster-actions";
import type { CoachTeamDetail, OpenCompetitionRow } from "@/lib/coach/dashboard";
import { cn } from "@/lib/utils";

// --- Top-level ----------------------------------------------------------

export function TeamRosterManager({
  team,
  openCompetitions,
}: {
  team: CoachTeamDetail;
  openCompetitions: OpenCompetitionRow[];
}) {
  return (
    <div className="space-y-6">
      <RegisterCard team={team} openCompetitions={openCompetitions} />

      {team.rosters.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-balance text-lg font-semibold tracking-tight">
              No rosters yet
            </h3>
            <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
              Register this team for a competition above to spin up a roster, then add
              your players.
            </p>
          </CardContent>
        </Card>
      ) : (
        team.rosters.map((roster) => (
          <RosterCard key={roster.rosterId} team={team} roster={roster} />
        ))
      )}
    </div>
  );
}

// --- Register card ------------------------------------------------------

function RegisterCard({
  team,
  openCompetitions,
}: {
  team: CoachTeamDetail;
  openCompetitions: OpenCompetitionRow[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [result, setResult] = useState<RegisterTeamResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!selected) return;
    setResult(null);
    startTransition(async () => {
      const r = await registerTeamForCompetition({
        teamId: team.id,
        competitionId: selected,
      });
      setResult(r);
      if (r.ok) setSelected("");
    });
  }

  return (
    <Card className="border-[color:var(--brand-gold)]/30 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--brand-gold)]">
          Registration
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4 text-[color:var(--brand-gold)]" />
          Register for a competition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {openCompetitions.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-background/40 p-3 text-[12px] text-muted-foreground">
            No open competitions match this team&apos;s game + tier right now. New competitions
            will show up here when a league admin creates them.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {openCompetitions.map((c) => (
                <label
                  key={c.competitionId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-background/40 p-3 transition-colors hover:bg-card",
                    selected === c.competitionId
                      ? "border-[color:var(--brand-gold)]"
                      : "border-border/60",
                  )}
                >
                  <input
                    type="radio"
                    name="competition"
                    value={c.competitionId}
                    checked={selected === c.competitionId}
                    onChange={() => setSelected(c.competitionId)}
                    className="mt-1 accent-[color:var(--brand-gold)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.game} · {c.tier.toLowerCase()} · {c.registeredCount} team
                      {c.registeredCount === 1 ? "" : "s"} registered
                      {c.registrationClosesAt
                        ? ` · closes ${c.registrationClosesAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {result && !result.ok ? (
              <Banner kind="error">{result.error}</Banner>
            ) : null}

            {result?.ok ? (
              <Banner kind="success">
                Registered. A league admin will review your roster shortly.
              </Banner>
            ) : null}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !selected}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-gold)] px-3 py-2 text-[12px] font-semibold text-black transition-colors hover:bg-[color:var(--brand-gold)]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {pending ? "Submitting…" : "Register team"}
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Roster card --------------------------------------------------------

function RosterCard({
  team,
  roster,
}: {
  team: CoachTeamDetail;
  roster: CoachTeamDetail["rosters"][number];
}) {
  const statusBadge = (() => {
    switch (roster.status) {
      case "APPROVED":
        return { label: "Approved", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
      case "PENDING":
        return { label: "Pending review", cls: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]" };
      case "REJECTED":
        return { label: "Rejected", cls: "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]" };
    }
  })();

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {roster.game}
        </p>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          <span className="truncate">{roster.competitionName}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              statusBadge.cls,
            )}
          >
            {statusBadge.label}
          </span>
          {roster.editLocked ? (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          ) : null}
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {roster.members.length} player{roster.members.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MemberList roster={roster} />
        {!roster.editLocked ? (
          <AddPlayerForm rosterId={roster.rosterId} schoolId={team.schoolId} />
        ) : (
          <p className="rounded-md border border-border/60 bg-background/40 p-2.5 text-[11px] text-muted-foreground">
            <Lock className="mr-1 inline h-3 w-3" />
            Roster locked — contact a league admin to make changes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Member list --------------------------------------------------------

function MemberList({
  roster,
}: {
  roster: CoachTeamDetail["rosters"][number];
}) {
  if (roster.members.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-4 text-center text-[12px] text-muted-foreground">
        No players yet. Add one below.
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {roster.members.map((m) => (
        <MemberRow key={m.membershipId} member={m} locked={roster.editLocked} />
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  locked,
}: {
  member: CoachTeamDetail["rosters"][number]["members"][number];
  locked: boolean;
}) {
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isLead = member.role === "CAPTAIN" || member.role === "COACH" || member.role === "MANAGER";

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const r = await removePlayerFromRoster({ membershipId: member.membershipId });
      if (r.ok) setRemoved(true);
      else setError(r.error);
    });
  }

  if (removed) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12px] text-muted-foreground">
        <X className="h-3 w-3" />
        Removed {member.name}. Refreshing…
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-card">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[10px] font-semibold text-white">
        {member.name
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase() ?? "")
          .join("") || "??"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {member.name}
          {isLead ? (
            <Crown className="ml-1 inline h-3 w-3 text-[color:var(--brand-gold)]" />
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {member.role.toLowerCase()}
          {member.inGameName ? (
            <>
              {" · "}
              <span className="font-mono text-foreground/80">{member.inGameName}</span>
            </>
          ) : null}
          {!member.isStarter ? <span className="ml-1">(sub)</span> : null}
        </p>
      </div>
      {member.jerseyNumber !== null ? (
        <span className="font-mono text-[12px] font-bold tabular-nums text-muted-foreground">
          #{member.jerseyNumber}
        </span>
      ) : null}
      {!locked ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[color:var(--brand-crimson)]/10 hover:text-[color:var(--brand-crimson)] disabled:opacity-50"
          aria-label={`Remove ${member.name}`}
          title={`Remove ${member.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {error ? (
        <span className="text-[11px] text-[color:var(--brand-crimson)]">{error}</span>
      ) : null}
    </li>
  );
}

// --- Add player form ----------------------------------------------------

function AddPlayerForm({
  rosterId,
  schoolId,
}: {
  rosterId: string;
  schoolId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PLAYER" | "CAPTAIN" | "COACH" | "MANAGER">("PLAYER");
  const [jersey, setJersey] = useState("");
  const [ign, setIgn] = useState("");
  const [result, setResult] = useState<AddPlayerResult | null>(null);
  const [invite, setInvite] = useState<CreateSchoolInviteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [invitePending, startInviteTransition] = useTransition();

  function handleSubmit() {
    setResult(null);
    setInvite(null);
    const j = jersey.trim() ? parseInt(jersey, 10) : undefined;
    startTransition(async () => {
      const r = await addPlayerToRoster({
        rosterId,
        userEmail: email.trim(),
        role,
        jerseyNumber: Number.isNaN(j) ? undefined : j,
        inGameName: ign.trim() || undefined,
        isStarter: true,
      });
      setResult(r);
      if (r.ok) {
        setEmail("");
        setJersey("");
        setIgn("");
      }
    });
  }

  function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setInvite(null);
    startInviteTransition(async () => {
      // We invite at the PLAYER tier here regardless of the role picker
      // because the form's intent is "get this person into the school so
      // they can be rostered." Promoting them happens after they claim.
      const r = await createSchoolInvite({
        schoolId,
        role: "PLAYER",
        intendedEmail: trimmed,
        maxUses: 1,
        expiresDays: 30,
        grantsOwnership: false,
      });
      setInvite(r);
    });
  }

  // Detect the "no account exists" path so we can offer the invite fallback.
  // The server returns a plain string error today; sniff it rather than
  // adding a new error code field that ripples through callers.
  const showInviteFallback =
    !!result && !result.ok && /no account found/i.test(result.error);

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <UserPlus className="h-3 w-3" />
        Add player
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="player@school.edu"
          className="h-8 rounded-md border border-border bg-background px-2 text-[12px] focus:border-[color:var(--brand-crimson)] focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="h-8 rounded-md border border-border bg-background px-2 text-[12px] focus:border-[color:var(--brand-crimson)] focus:outline-none"
        >
          <option value="PLAYER">Player</option>
          <option value="CAPTAIN">Captain</option>
          <option value="COACH">Coach</option>
          <option value="MANAGER">Manager</option>
        </select>
        <input
          type="number"
          min={0}
          max={999}
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          placeholder="#"
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-center text-[12px] tabular-nums focus:border-[color:var(--brand-crimson)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !email.trim()}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-[color:var(--brand-crimson)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <input
        type="text"
        value={ign}
        onChange={(e) => setIgn(e.target.value)}
        placeholder="In-game name (optional)"
        className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-[12px] focus:border-[color:var(--brand-crimson)] focus:outline-none"
      />

      {result && !result.ok ? (
        <div className="mt-2 space-y-2">
          <p className="flex items-start gap-1.5 text-[11px] text-[color:var(--brand-crimson)]">
            <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
            {result.error}
          </p>

          {showInviteFallback ? (
            invite?.ok ? (
              <InviteCreatedLink
                url={invite.url}
                email={invite.intendedEmail ?? email.trim()}
              />
            ) : (
              <button
                type="button"
                onClick={handleInvite}
                disabled={invitePending}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[11px] font-semibold text-[color:var(--brand-gold)] transition-colors hover:bg-[color:var(--brand-gold)]/15 disabled:opacity-50"
              >
                <Mail className="h-3 w-3" />
                {invitePending
                  ? "Creating invite…"
                  : `Invite ${email.trim()} to the school`}
              </button>
            )
          ) : null}

          {invite && !invite.ok ? (
            <p className="flex items-start gap-1.5 text-[11px] text-[color:var(--brand-crimson)]">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {invite.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {result?.ok ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-500">
          <CheckCircle2 className="h-3 w-3" />
          Player added.
        </p>
      ) : null}
    </div>
  );
}

function InviteCreatedLink({
  url,
  email,
}: {
  url: string;
  email: string;
}) {
  const [copied, setCopied] = useState(false);
  const absolute =
    typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  function copy() {
    navigator.clipboard.writeText(absolute).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="space-y-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px]">
      <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Invite for <span className="font-mono">{email}</span> ready. They claim it,
        then come back here to add them to the roster.
      </p>
      <div className="flex items-center gap-1.5 rounded border border-border/60 bg-background p-1">
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <input
          readOnly
          value={absolute}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 truncate bg-transparent font-mono text-[10px] focus:outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded border border-border/60 bg-card px-1.5 py-0.5 text-[10px] font-semibold hover:bg-background"
        >
          <Copy className="h-2.5 w-2.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// --- Shared bits --------------------------------------------------------

function Banner({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-2.5 text-[12px]",
        kind === "error"
          ? "border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      {kind === "error" ? (
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      )}
      <p>{children}</p>
    </div>
  );
}
