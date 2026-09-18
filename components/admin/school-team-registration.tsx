"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Gamepad2,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeagueSchoolTeamDetail } from "@/lib/league-admin/school-detail";
import { registerTeamForCompetitionAsLeagueAdmin } from "@/lib/team/roster-actions";

export function SchoolTeamRegistration({
  team,
  canRegisterForSchool,
}: {
  team: LeagueSchoolTeamDetail;
  canRegisterForSchool: boolean;
}) {
  const router = useRouter();
  const availableOptions = useMemo(
    () => team.registrationOptions.filter((option) => option.existingRoster === null),
    [team.registrationOptions],
  );
  const firstEligible = availableOptions.find((option) => option.eligible);
  const [competitionId, setCompetitionId] = useState(
    firstEligible?.competitionId ?? availableOptions[0]?.competitionId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = availableOptions.find(
    (option) => option.competitionId === competitionId,
  );
  const registrations = team.registrationOptions.filter(
    (option) => option.existingRoster !== null,
  );

  function register() {
    if (!selected?.eligible) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await registerTeamForCompetitionAsLeagueAdmin({
        teamId: team.id,
        competitionId: selected.competitionId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`${team.name} is registered and approved for ${selected.competitionName}.`);
      router.refresh();
    });
  }

  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{team.name}</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                {team.gameName}
              </span>
              <span aria-hidden>·</span>
              <span>{formatTier(team.skillTier)}</span>
            </p>
          </div>
          {team.archived ? (
            <StatusBadge tone="muted">Archived</StatusBadge>
          ) : (
            <StatusBadge tone="active">Active team</StatusBadge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            League registrations
          </p>
          {registrations.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-[12px] text-muted-foreground">
              Not registered in a matching competition yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {registrations.map((registration) => (
                <li
                  key={registration.competitionId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold">
                      {registration.competitionName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {registration.seasonName}
                      {registration.divisionName ? ` · ${registration.divisionName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {registration.existingRoster?.memberCount ?? 0}
                    </span>
                    <StatusBadge
                      tone={
                        registration.existingRoster?.status === "APPROVED"
                          ? "active"
                          : registration.existingRoster?.status === "REJECTED"
                            ? "danger"
                            : "pending"
                      }
                    >
                      {registration.existingRoster?.status.toLowerCase()}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[color:var(--brand-gold)]/25 bg-[color:var(--brand-gold)]/5 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold">Register on behalf of the school</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                League-admin registrations are approved immediately and recorded in the audit log.
                Coaches still control roster members.
              </p>
            </div>
          </div>

          {!canRegisterForSchool ? (
            <p className="mt-3 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
              Staff access is read-only here. A league Owner or Admin can register this team.
            </p>
          ) : team.archived ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Archived teams cannot be registered.
            </p>
          ) : availableOptions.length === 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              There are no other {team.gameName} {formatTier(team.skillTier)} competitions in this league.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <label
                htmlFor={`competition-${team.id}`}
                className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Competition
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  id={`competition-${team.id}`}
                  value={competitionId}
                  onChange={(event) => {
                    setCompetitionId(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={pending}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {availableOptions.map((option) => (
                    <option key={option.competitionId} value={option.competitionId}>
                      {option.competitionName} — {option.eligible ? "eligible" : "unavailable"}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={register}
                  disabled={pending || !selected?.eligible}
                  className="bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {pending ? "Registering…" : "Register & approve"}
                </Button>
              </div>
              {selected ? (
                <p
                  className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${
                    selected.eligible ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  }`}
                >
                  {selected.eligible ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  {selected.message}
                </p>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[color:var(--brand-crimson)]">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
              {success}
            </p>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "active" | "pending" | "danger" | "muted";
}) {
  const toneClass = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pending: "border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
    danger: "border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]",
    muted: "border-border/60 bg-muted text-muted-foreground",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${toneClass}`}
    >
      {children}
    </span>
  );
}

function formatTier(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
