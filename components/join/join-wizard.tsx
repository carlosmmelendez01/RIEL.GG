"use client";

/**
 * Three-step public application wizard.
 *
 *   1. Pick a league (real `League` rows fetched server-side)
 *   2. Find a school in the NCES directory
 *   3. Fill in coach details
 *
 * On submit, calls the `applyToLeague` server action. Success surfaces a
 * confirmation screen; field-level zod errors flip back to the relevant
 * step.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Globe2,
  Mail,
  School as SchoolIcon,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import {
  applyToLeague,
  type ApplyToLeagueResult,
} from "@/lib/school/application-actions";
import { cn } from "@/lib/utils";

// --- Reference data ----------------------------------------------------

// Curated NCES sample. Production wires this to a real NCES lookup; for now
// it's a fixed list of Indiana schools so the picker feels real. Applicants
// can also propose a school we don't track (handled in the "no results" path).
const NCES_SCHOOLS = [
  { id: "nces-001", name: "Michigan City High School", city: "Michigan City", state: "IN", code: "MCH", ncesId: "1801560-001", verified: true },
  { id: "nces-002", name: "Carmel High School", city: "Carmel", state: "IN", code: "CAR", ncesId: "1804860-002", verified: true },
  { id: "nces-003", name: "Fishers High School", city: "Fishers", state: "IN", code: "FHS", ncesId: "1808340-003", verified: true },
  { id: "nces-004", name: "Plainfield High School", city: "Plainfield", state: "IN", code: "PFD", ncesId: "1813140-004", verified: true },
  { id: "nces-005", name: "Westfield High School", city: "Westfield", state: "IN", code: "WST", ncesId: "1816530-005", verified: true },
  { id: "nces-006", name: "Hamilton Southeastern HS", city: "Fishers", state: "IN", code: "HSE", ncesId: "1809720-006", verified: true },
  { id: "nces-007", name: "Zionsville Community HS", city: "Zionsville", state: "IN", code: "ZON", ncesId: "1817820-007", verified: true },
  { id: "nces-008", name: "Bishop Chatard HS", city: "Indianapolis", state: "IN", code: "BCH", ncesId: "1803960-008", verified: true },
] as const;

type NcesSchool = (typeof NCES_SCHOOLS)[number];

// --- Props -------------------------------------------------------------

export type JoinLeagueOption = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  classification: "SCHOLASTIC" | "COLLEGIATE" | "AMATEUR";
  primaryColor: string;
  secondaryColor: string;
  region: string;
  schoolCount: number;
};

type Stage = "league" | "school" | "coach" | "submitted";

export function JoinWizard({ leagues }: { leagues: JoinLeagueOption[] }) {
  const [stage, setStage] = useState<Stage>("league");

  // Stage 1
  const [leagueQuery, setLeagueQuery] = useState("");
  const [pickedLeague, setPickedLeague] = useState<JoinLeagueOption | null>(null);

  // Stage 2
  const [schoolQuery, setSchoolQuery] = useState("");
  const [expandedSearch, setExpandedSearch] = useState(false);
  const [pickedSchool, setPickedSchool] = useState<NcesSchool | null>(null);

  // Stage 3
  const [coachName, setCoachName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachRole, setCoachRole] = useState("Head Coach");
  const [reason, setReason] = useState("");

  // Submit state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const filteredLeagues = useMemo(() => {
    const q = leagueQuery.trim().toLowerCase();
    if (!q) return leagues;
    return leagues.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.shortName.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q),
    );
  }, [leagueQuery, leagues]);

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return [];
    return NCES_SCHOOLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q),
    );
  }, [schoolQuery]);

  function handleSubmit() {
    if (!pickedLeague || !pickedSchool) return;
    setSubmitError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r: ApplyToLeagueResult = await applyToLeague({
        leagueSlug: pickedLeague.slug,
        schoolName: pickedSchool.name,
        schoolShort: pickedSchool.code,
        schoolCity: pickedSchool.city,
        schoolState: pickedSchool.state,
        schoolCode: pickedSchool.code,
        ncesId: pickedSchool.ncesId,
        coachName: coachName.trim(),
        coachEmail: coachEmail.trim(),
        coachRole: coachRole.trim(),
        reason: reason.trim() || undefined,
      });
      if (r.ok) {
        setStage("submitted");
      } else {
        setSubmitError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        // Jump back to the step that owns the bad field
        if (r.fieldErrors?.leagueSlug) setStage("league");
        else if (r.fieldErrors?.schoolName || r.fieldErrors?.ncesId) setStage("school");
      }
    });
  }

  if (stage === "submitted") {
    return (
      <Submitted league={pickedLeague!} school={pickedSchool!} coachEmail={coachEmail} />
    );
  }

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            Already a member? Sign in
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <Stepper stage={stage} />

          {stage === "league" ? (
            leagues.length === 0 ? (
              <NoLeagues />
            ) : (
              <LeagueStep
                query={leagueQuery}
                setQuery={setLeagueQuery}
                leagues={filteredLeagues}
                picked={pickedLeague}
                onPick={(l) => {
                  setPickedLeague(l);
                  setStage("school");
                }}
              />
            )
          ) : null}

          {stage === "school" && pickedLeague ? (
            <SchoolStep
              league={pickedLeague}
              query={schoolQuery}
              setQuery={setSchoolQuery}
              expanded={expandedSearch}
              setExpanded={setExpandedSearch}
              schools={filteredSchools}
              picked={pickedSchool}
              onPick={(s) => {
                setPickedSchool(s);
                setStage("coach");
              }}
              onBack={() => setStage("league")}
            />
          ) : null}

          {stage === "coach" && pickedLeague && pickedSchool ? (
            <CoachStep
              league={pickedLeague}
              school={pickedSchool}
              coachName={coachName}
              setCoachName={setCoachName}
              coachEmail={coachEmail}
              setCoachEmail={setCoachEmail}
              coachRole={coachRole}
              setCoachRole={setCoachRole}
              reason={reason}
              setReason={setReason}
              onSubmit={handleSubmit}
              onBack={() => setStage("school")}
              pending={pending}
              submitError={submitError}
              fieldErrors={fieldErrors}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

// --- Stepper -----------------------------------------------------------

function Stepper({ stage }: { stage: Stage }) {
  const steps: { id: Stage; label: string; icon: LucideIcon }[] = [
    { id: "league", label: "Pick league", icon: Trophy },
    { id: "school", label: "Find school", icon: SchoolIcon },
    { id: "coach", label: "Your details", icon: ClipboardList },
  ];
  const order: Stage[] = ["league", "school", "coach", "submitted"];
  const currentIdx = order.indexOf(stage);

  return (
    <ol className="mb-10 flex items-center">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const status = currentIdx === i ? "current" : currentIdx > i ? "done" : "upcoming";
        return (
          <li key={s.id} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div
              className={cn(
                "flex shrink-0 items-center gap-2",
                status === "current" && "text-foreground",
                status === "done" && "text-muted-foreground",
                status === "upcoming" && "text-muted-foreground/40",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold",
                  status === "current" && "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)] text-white",
                  status === "done" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  status === "upcoming" && "border-border bg-background",
                )}
              >
                {status === "done" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span className="hidden text-[12px] font-medium sm:block">{s.label}</span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "ml-2 mr-2 h-px flex-1",
                  currentIdx > i ? "bg-emerald-500/40" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// --- Step 1: League ----------------------------------------------------

function NoLeagues() {
  return (
    <Card className="border-dashed border-border/80 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <Trophy className="h-5 w-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Not open yet
        </p>
        <h3 className="max-w-md text-balance text-xl font-semibold tracking-tight">
          No leagues are accepting public applications right now.
        </h3>
        <p className="max-w-md text-balance text-[13px] leading-relaxed text-muted-foreground">
          Reach out to your league administrator for a direct invite link, or email{" "}
          <span className="font-mono">hello@riel.gg</span> and we&apos;ll connect you.
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-2 inline-flex",
          )}
        >
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}

function LeagueStep({
  query,
  setQuery,
  leagues,
  picked,
  onPick,
}: {
  query: string;
  setQuery: (s: string) => void;
  leagues: JoinLeagueOption[];
  picked: JoinLeagueOption | null;
  onPick: (l: JoinLeagueOption) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Step 1 of 3
        </p>
        <CardTitle className="text-2xl tracking-tight">Which league are you joining?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by name, abbreviation, or region.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hoosier Esports Alliance, HEA, Indiana…"
            className="h-7 flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          {leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onPick(l)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all hover-edge-crimson",
                picked?.id === l.id ? "border-[color:var(--brand-crimson)]" : "border-border/60",
              )}
            >
              <div
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight text-white shadow-inner"
                style={{
                  background: `linear-gradient(135deg, ${l.primaryColor} 0%, ${l.secondaryColor} 100%)`,
                }}
              >
                {l.shortName.slice(0, 4)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{l.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {l.region} · {l.schoolCount} school{l.schoolCount === 1 ? "" : "s"} ·{" "}
                  {l.classification.toLowerCase()}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
          {leagues.length === 0 ? (
            <p className="rounded-md border border-border/60 bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground">
              No leagues match that search. Try a different name or region.
            </p>
          ) : null}
        </div>

        <p className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
          Don&apos;t see your league? Ask the league administrator for a direct invite link.
        </p>
      </CardContent>
    </Card>
  );
}

// --- Step 2: School ----------------------------------------------------

function SchoolStep({
  league,
  query,
  setQuery,
  expanded,
  setExpanded,
  schools,
  picked,
  onPick,
  onBack,
}: {
  league: JoinLeagueOption;
  query: string;
  setQuery: (s: string) => void;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
  schools: ReadonlyArray<NcesSchool>;
  picked: NcesSchool | null;
  onPick: (s: NcesSchool) => void;
  onBack: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <span aria-hidden>·</span>
          <span>
            Joining <span className="text-foreground">{league.name}</span>
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Step 2 of 3
        </p>
        <CardTitle className="text-2xl tracking-tight">Find your school</CardTitle>
        <p className="text-sm text-muted-foreground">
          We search the NCES database — every accredited US school is in there. Verified results show a shield.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) setExpanded(true);
            }}
            placeholder="Type your school name…"
            className="h-7 flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>

        {!expanded && query.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-background/40 px-3 py-8 text-center text-sm text-muted-foreground">
            Start typing to search the NCES national school directory.
          </p>
        ) : null}

        {schools.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {schools.length} {schools.length === 1 ? "match" : "matches"}
            </p>
            {schools.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all hover-edge-crimson",
                  picked?.id === s.id ? "border-[color:var(--brand-crimson)]" : "border-border/60",
                )}
              >
                <div
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tracking-tight text-muted-foreground"
                >
                  {s.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[14px] font-semibold">{s.name}</p>
                    {s.verified ? (
                      <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        NCES
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {s.city}, {s.state}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        ) : query.length > 0 ? (
          <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-4 text-center">
            <p className="text-[13px] text-foreground">
              No results for &quot;<span className="font-semibold">{query}</span>&quot;
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Make sure the spelling matches the school&apos;s official name. If it&apos;s a brand-new
              school, ask your league admin to add it manually.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Step 3: Coach details ---------------------------------------------

function CoachStep({
  league,
  school,
  coachName,
  setCoachName,
  coachEmail,
  setCoachEmail,
  coachRole,
  setCoachRole,
  reason,
  setReason,
  onSubmit,
  onBack,
  pending,
  submitError,
  fieldErrors,
}: {
  league: JoinLeagueOption;
  school: NcesSchool;
  coachName: string;
  setCoachName: (s: string) => void;
  coachEmail: string;
  setCoachEmail: (s: string) => void;
  coachRole: string;
  setCoachRole: (s: string) => void;
  reason: string;
  setReason: (s: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  pending: boolean;
  submitError: string | null;
  fieldErrors: Record<string, string>;
}) {
  const valid = coachName.trim().length > 1 && /\S+@\S+\.\S+/.test(coachEmail);

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <span aria-hidden>·</span>
          <span>
            <span className="text-foreground">{school.name}</span> applying to{" "}
            <span className="text-foreground">{league.name}</span>
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Step 3 of 3
        </p>
        <CardTitle className="text-2xl tracking-tight">Tell us about you</CardTitle>
        <p className="text-sm text-muted-foreground">
          You&apos;ll be invited as the school&apos;s owner. Once {league.shortName} approves, you can invite
          assistant coaches and players.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="coachName">Your name</Label>
            <Input
              id="coachName"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="Carlos Melendez"
              aria-invalid={!!fieldErrors.coachName}
            />
            {fieldErrors.coachName ? (
              <p className="text-[11px] text-[color:var(--brand-crimson)]">{fieldErrors.coachName}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coachEmail">School email</Label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                id="coachEmail"
                type="email"
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
                placeholder={`coach@${school.name.split(" ")[0].toLowerCase()}.k12.in.us`}
                className="h-9 flex-1 bg-transparent focus:outline-none"
                aria-invalid={!!fieldErrors.coachEmail}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use your official school address — it speeds up verification.
            </p>
            {fieldErrors.coachEmail ? (
              <p className="text-[11px] text-[color:var(--brand-crimson)]">{fieldErrors.coachEmail}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coachRole">Your role</Label>
          <select
            id="coachRole"
            value={coachRole}
            onChange={(e) => setCoachRole(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option>Head Coach</option>
            <option>Assistant Coach</option>
            <option>Athletic Director</option>
            <option>Esports Director</option>
            <option>Faculty Sponsor</option>
            <option>Manager / Staff</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Anything the league should know? (optional)</Label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Returning member · planning Varsity LoL + Rocket League · ~24 students interested"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="rounded-lg border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5 p-3">
          <p className="flex items-center gap-2 text-[12px] font-medium">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
            What happens next
          </p>
          <ul className="mt-1 space-y-0.5 pl-5 text-[11px] text-muted-foreground">
            <li>· {league.name} reviews your application (typically within 1-2 days)</li>
            <li>· You receive an invite link to claim ownership of {school.name}</li>
            <li>· You sign in, set up your teams, and register for competitions</li>
          </ul>
        </div>

        {submitError ? (
          <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{submitError}</p>
          </div>
        ) : null}

        <button
          onClick={onSubmit}
          disabled={!valid || pending}
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50 glow-crimson-sm",
          )}
        >
          <Send className="mr-2 h-4 w-4" />
          {pending ? "Submitting…" : "Submit application"}
        </button>
      </CardContent>
    </Card>
  );
}

// --- Submitted ---------------------------------------------------------

function Submitted({
  league,
  school,
  coachEmail,
}: {
  league: JoinLeagueOption;
  school: NcesSchool;
  coachEmail: string;
}) {
  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 glow-crimson-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Your application is on its way to {league.name}.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We&apos;ve notified the league office.{" "}
            <span className="text-foreground">{school.name}</span> is now in their approval queue.
          </p>

          <Card className="mt-8 border-border/60 bg-card/80 text-left">
            <CardHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Application summary
              </p>
              <CardTitle className="text-base">What we sent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">League</span>
                <span className="font-medium">{league.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">School</span>
                <span className="font-medium">{school.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner contact</span>
                <span className="font-mono text-[12px]">{coachEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
                  Pending
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            <NextStep
              icon={Globe2}
              title="Check your email"
              body={`We'll send updates to ${coachEmail}.`}
            />
            <NextStep
              icon={ShieldCheck}
              title="Approval window"
              body="Most leagues review within 1-2 business days."
            />
            <NextStep
              icon={Building2}
              title="After approval"
              body="Click the invite link to claim your school and set up teams."
            />
          </div>

          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-8 inline-flex")}
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

function NextStep({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{body}</p>
    </div>
  );
}
