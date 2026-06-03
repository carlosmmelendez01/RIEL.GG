"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  CircleAlert,
  Clock,
  ClipboardList,
  Gamepad2,
  Globe2,
  HeartHandshake,
  ListTree,
  Network,
  RefreshCw,
  Save,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminTopbar } from "@/components/admin/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import {
  createCompetition,
  type CreateCompetitionResult,
} from "@/lib/competition/competition-actions";
import { cn } from "@/lib/utils";

const GAMES = [
  { id: "lol", name: "League of Legends", format: "5v5" },
  { id: "val", name: "Valorant", format: "5v5" },
  { id: "rl", name: "Rocket League", format: "3v3" },
  { id: "ow2", name: "Overwatch 2", format: "5v5" },
  { id: "smash", name: "Super Smash Bros.", format: "1v1 / Crew" },
  { id: "fortnite", name: "Fortnite", format: "Squads" },
];

const TIERS = ["Varsity", "JV", "Club", "Premier", "Academy", "Middle School", "Unified"];

type StageTemplate = "ROUND_ROBIN" | "RR_SINGLE_ELIM" | "RR_DOUBLE_ELIM" | "SWISS" | "BRACKET_ONLY" | "CUSTOM";

const STAGE_TEMPLATES: { id: StageTemplate; name: string; desc: string; stages: string[]; icon: LucideIcon }[] = [
  {
    id: "ROUND_ROBIN",
    name: "Round Robin only",
    desc: "Every team plays every other team. No playoffs.",
    stages: ["Round Robin"],
    icon: RefreshCw,
  },
  {
    id: "RR_SINGLE_ELIM",
    name: "Round Robin + Single Elim",
    desc: "Regular season, then top teams enter a single-elimination bracket. Most common.",
    stages: ["League Play", "Playoffs"],
    icon: Trophy,
  },
  {
    id: "RR_DOUBLE_ELIM",
    name: "Round Robin + Double Elim",
    desc: "Regular season, then top teams enter a double-elim bracket with losers' bracket.",
    stages: ["League Play", "Playoffs"],
    icon: Network,
  },
  {
    id: "SWISS",
    name: "Swiss",
    desc: "Teams paired by current record each round. Good for large divisions.",
    stages: ["Swiss Rounds"],
    icon: Swords,
  },
  {
    id: "BRACKET_ONLY",
    name: "Bracket only",
    desc: "Single tournament — no league play. Pure single-elim bracket.",
    stages: ["Bracket"],
    icon: Target,
  },
  {
    id: "CUSTOM",
    name: "Custom",
    desc: "Configure stages manually after creation.",
    stages: ["Custom"],
    icon: ListTree,
  },
];

const STEPS = [
  { id: 1, label: "Basics", icon: ClipboardList },
  { id: 2, label: "Schedule", icon: CalendarRange },
  { id: 3, label: "Stages", icon: ListTree },
  { id: 4, label: "Format", icon: Wand2 },
  { id: 5, label: "Review", icon: Check },
] as const;

const todayIso = () => new Date().toISOString().slice(0, 10);
const dateAdd = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function NewCompetitionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [season, setSeason] = useState("Spring 2026");
  const [game, setGame] = useState<string>(GAMES[0].id);
  const [tier, setTier] = useState<string>("Varsity");
  const [isOnline, setIsOnline] = useState(true);
  const [unified, setUnified] = useState(false);

  const startBase = todayIso();
  const [startsAt, setStartsAt] = useState(dateAdd(startBase, 14));
  const [endsAt, setEndsAt] = useState(dateAdd(startBase, 84));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(startBase);
  const [registrationClosesAt, setRegistrationClosesAt] = useState(dateAdd(startBase, 12));

  const [template, setTemplate] = useState<StageTemplate>("RR_SINGLE_ELIM");
  const [expectedTeams, setExpectedTeams] = useState(12);

  const [bestOf, setBestOf] = useState(3);
  const [matchInterval, setMatchInterval] = useState(60);
  const [concurrentMatches, setConcurrentMatches] = useState(true);
  const [checkInWindow, setCheckInWindow] = useState(15);
  const [rescheduleCutoff, setRescheduleCutoff] = useState(24);
  const [confirmationMode, setConfirmationMode] = useState<"CONSENSUS" | "DELAYED_AUTO">("CONSENSUS");
  const [autoFinishMinutes, setAutoFinishMinutes] = useState(60);

  // Submission state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const gameObj = GAMES.find((g) => g.id === game);
  const generatedName = name.trim() || `${season} — ${gameObj?.name ?? "Game"} ${tier}${unified ? " Unified" : ""}`;

  function handleSubmit(activate: boolean) {
    setSubmitError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r: CreateCompetitionResult = await createCompetition({
        name: generatedName,
        seasonName: season.trim(),
        gameSlug: game,
        skillTier: tierToEnum(tier, unified),
        isOnline,
        startsAt,
        endsAt,
        registrationOpensAt,
        registrationClosesAt,
        template,
        expectedTeams,
        bestOf,
        matchIntervalMinutes: matchInterval,
        concurrentMatches,
        checkInWindowMinutes: checkInWindow,
        rescheduleCutoffHours: rescheduleCutoff,
        confirmationMode,
        autoFinishAfterMinutes:
          confirmationMode === "DELAYED_AUTO" ? autoFinishMinutes : undefined,
        activate,
      });
      if (r.ok) {
        router.push(`/admin/competitions`);
      } else {
        setSubmitError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        // Jump back to the step that owns the bad field
        if (r.fieldErrors?.name || r.fieldErrors?.seasonName || r.fieldErrors?.gameSlug) {
          setStep(1);
        } else if (
          r.fieldErrors?.startsAt ||
          r.fieldErrors?.endsAt ||
          r.fieldErrors?.registrationOpensAt ||
          r.fieldErrors?.registrationClosesAt
        ) {
          setStep(2);
        } else if (r.fieldErrors?.template || r.fieldErrors?.expectedTeams) {
          setStep(3);
        } else if (r.fieldErrors?.bestOf || r.fieldErrors?.matchIntervalMinutes) {
          setStep(4);
        }
      }
    });
  }

  return (
    <>
      <AdminTopbar
        title="New Competition"
        eyebrow={`Step ${step} of ${STEPS.length} · ${STEPS[step - 1].label}`}
      />

      <main className="flex-1 px-6 py-6 md:px-8">
        {submitError ? (
          <div className="mx-auto mb-6 flex max-w-3xl items-start gap-3 rounded-lg border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-4 py-3 text-[12px] leading-relaxed text-[color:var(--brand-crimson)]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Couldn&apos;t save</p>
              <p>{submitError}</p>
              {Object.keys(fieldErrors).length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {Object.entries(fieldErrors).map(([k, v]) => (
                    <li key={k}>
                      <span className="font-mono">{k}</span>: {v}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Stepper */}
        <Stepper step={step} onJump={(s) => s < step && setStep(s)} />

        <div className="mx-auto mt-8 max-w-3xl">
          {step === 1 ? (
            <BasicsStep
              name={name}
              setName={setName}
              season={season}
              setSeason={setSeason}
              game={game}
              setGame={setGame}
              tier={tier}
              setTier={setTier}
              isOnline={isOnline}
              setIsOnline={setIsOnline}
              unified={unified}
              setUnified={setUnified}
              generatedName={generatedName}
            />
          ) : null}

          {step === 2 ? (
            <ScheduleStep
              startsAt={startsAt}
              setStartsAt={setStartsAt}
              endsAt={endsAt}
              setEndsAt={setEndsAt}
              registrationOpensAt={registrationOpensAt}
              setRegistrationOpensAt={setRegistrationOpensAt}
              registrationClosesAt={registrationClosesAt}
              setRegistrationClosesAt={setRegistrationClosesAt}
            />
          ) : null}

          {step === 3 ? (
            <StagesStep
              template={template}
              setTemplate={setTemplate}
              expectedTeams={expectedTeams}
              setExpectedTeams={setExpectedTeams}
            />
          ) : null}

          {step === 4 ? (
            <FormatStep
              bestOf={bestOf}
              setBestOf={setBestOf}
              matchInterval={matchInterval}
              setMatchInterval={setMatchInterval}
              concurrentMatches={concurrentMatches}
              setConcurrentMatches={setConcurrentMatches}
              checkInWindow={checkInWindow}
              setCheckInWindow={setCheckInWindow}
              rescheduleCutoff={rescheduleCutoff}
              setRescheduleCutoff={setRescheduleCutoff}
              confirmationMode={confirmationMode}
              setConfirmationMode={setConfirmationMode}
              autoFinishMinutes={autoFinishMinutes}
              setAutoFinishMinutes={setAutoFinishMinutes}
            />
          ) : null}

          {step === 5 ? (
            <ReviewStep
              data={{
                name: generatedName,
                season,
                game: gameObj?.name ?? "",
                tier,
                isOnline,
                unified,
                startsAt,
                endsAt,
                registrationOpensAt,
                registrationClosesAt,
                template,
                expectedTeams,
                bestOf,
                matchInterval,
                concurrentMatches,
                checkInWindow,
                rescheduleCutoff,
                confirmationMode,
                autoFinishMinutes,
              }}
            />
          ) : null}
        </div>

        {/* Nav buttons */}
        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between border-t border-border/60 pt-6">
          <Link
            href="/admin/competitions"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Cancel
          </Link>
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ArrowLeft className="mr-1.5 h-3 w-3" />
                Back
              </button>
            ) : null}
            {step < STEPS.length ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
                )}
              >
                Continue
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={pending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Save className="mr-1.5 h-3 w-3" />
                  {pending ? "Saving…" : "Save as draft"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={pending}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Wand2 className="mr-1.5 h-3 w-3" />
                  {pending ? "Creating…" : "Activate competition"}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

// --- Stepper -------------------------------------------------------------

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <ol className="mx-auto flex max-w-3xl items-center">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const status = step === s.id ? "current" : step > s.id ? "done" : "upcoming";
        return (
          <li key={s.id} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <button
              onClick={() => onJump(s.id)}
              disabled={status === "upcoming"}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                status === "current" && "text-foreground",
                status === "done" && "text-muted-foreground hover:text-foreground",
                status === "upcoming" && "cursor-not-allowed text-muted-foreground/40",
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
            </button>
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "ml-2 mr-2 h-px flex-1",
                  step > s.id ? "bg-emerald-500/40" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// --- Step 1: Basics -----------------------------------------------------

function BasicsStep({
  name,
  setName,
  season,
  setSeason,
  game,
  setGame,
  tier,
  setTier,
  isOnline,
  setIsOnline,
  unified,
  setUnified,
  generatedName,
}: {
  name: string;
  setName: (v: string) => void;
  season: string;
  setSeason: (v: string) => void;
  game: string;
  setGame: (v: string) => void;
  tier: string;
  setTier: (v: string) => void;
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
  unified: boolean;
  setUnified: (v: boolean) => void;
  generatedName: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Step 1</p>
        <CardTitle className="text-xl">What are we creating?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick the game, tier, and season. We&apos;ll auto-generate a name unless you set a custom one.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="season">Season</Label>
            <Input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier">Skill tier</Label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Game</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGame(g.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all",
                  game === g.id
                    ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                    : "border-border/60 hover:border-border",
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold">{g.name}</p>
                  <p className="text-[11px] text-muted-foreground">{g.format}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Custom name (optional)</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={generatedName}
          />
          <p className="text-[11px] text-muted-foreground">
            Auto-generated: <span className="text-foreground">{generatedName}</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CheckCard
            checked={isOnline}
            onChange={setIsOnline}
            label="Online play"
            desc="Matches play remotely. Default for scholastic leagues."
            icon={Globe2}
          />
          <CheckCard
            checked={unified}
            onChange={setUnified}
            label="Unified competition"
            desc="Inclusive program with accessibility tools and pairing rules."
            icon={HeartHandshake}
            tone="purple"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CheckCard({
  checked,
  onChange,
  label,
  desc,
  icon: Icon,
  tone = "default",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone?: "default" | "purple";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all",
        checked
          ? tone === "purple"
            ? "border-[color:var(--brand-purple)] bg-[color:var(--brand-purple)]/8 ring-2 ring-[color:var(--brand-purple)]/30"
            : "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
          : "border-border/60 hover:border-border",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all",
          checked
            ? tone === "purple"
              ? "border-[color:var(--brand-purple)] bg-[color:var(--brand-purple)]"
              : "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]"
            : "border-border",
        )}
      >
        {checked ? <Check className="h-3 w-3 text-white" /> : null}
      </div>
    </button>
  );
}

// --- Step 2: Schedule ---------------------------------------------------

function ScheduleStep({
  startsAt,
  setStartsAt,
  endsAt,
  setEndsAt,
  registrationOpensAt,
  setRegistrationOpensAt,
  registrationClosesAt,
  setRegistrationClosesAt,
}: {
  startsAt: string;
  setStartsAt: (v: string) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
  registrationOpensAt: string;
  setRegistrationOpensAt: (v: string) => void;
  registrationClosesAt: string;
  setRegistrationClosesAt: (v: string) => void;
}) {
  const startD = new Date(startsAt);
  const endD = new Date(endsAt);
  const weeks = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (7 * 86_400_000)));

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Step 2</p>
        <CardTitle className="text-xl">When is this competition?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Set the season window and the registration window. The scheduler will fit matches inside the season window.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Competition window
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField id="startsAt" label="Starts" value={startsAt} onChange={setStartsAt} />
            <DateField id="endsAt" label="Ends" value={endsAt} onChange={setEndsAt} />
          </div>
          <p className="text-[12px] text-muted-foreground">
            <span className="text-foreground font-medium">{weeks}</span> weeks total
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Registration window
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField id="regOpens" label="Opens" value={registrationOpensAt} onChange={setRegistrationOpensAt} />
            <DateField id="regCloses" label="Closes" value={registrationClosesAt} onChange={setRegistrationClosesAt} />
          </div>
          <p className="text-[12px] text-muted-foreground">
            Registration must close before the competition starts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// --- Step 3: Stages -----------------------------------------------------

function StagesStep({
  template,
  setTemplate,
  expectedTeams,
  setExpectedTeams,
}: {
  template: StageTemplate;
  setTemplate: (v: StageTemplate) => void;
  expectedTeams: number;
  setExpectedTeams: (v: number) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Step 3</p>
        <CardTitle className="text-xl">How is the competition structured?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a structure template. You can fine-tune individual stages after creation.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Structure
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {STAGE_TEMPLATES.map((t) => {
              const Icon = t.icon;
              const selected = template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all",
                    selected
                      ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold">{t.name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.desc}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.stages.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expectedTeams">Expected team count</Label>
          <Input
            id="expectedTeams"
            type="number"
            min={2}
            max={64}
            value={expectedTeams}
            onChange={(e) => setExpectedTeams(parseInt(e.target.value || "0", 10))}
            className="max-w-[140px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Used for capacity planning. The scheduler adapts to actual roster count once registration closes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Step 4: Format -----------------------------------------------------

function FormatStep({
  bestOf,
  setBestOf,
  matchInterval,
  setMatchInterval,
  concurrentMatches,
  setConcurrentMatches,
  checkInWindow,
  setCheckInWindow,
  rescheduleCutoff,
  setRescheduleCutoff,
  confirmationMode,
  setConfirmationMode,
  autoFinishMinutes,
  setAutoFinishMinutes,
}: {
  bestOf: number;
  setBestOf: (v: number) => void;
  matchInterval: number;
  setMatchInterval: (v: number) => void;
  concurrentMatches: boolean;
  setConcurrentMatches: (v: boolean) => void;
  checkInWindow: number;
  setCheckInWindow: (v: number) => void;
  rescheduleCutoff: number;
  setRescheduleCutoff: (v: number) => void;
  confirmationMode: "CONSENSUS" | "DELAYED_AUTO";
  setConfirmationMode: (v: "CONSENSUS" | "DELAYED_AUTO") => void;
  autoFinishMinutes: number;
  setAutoFinishMinutes: (v: number) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Step 4</p>
        <CardTitle className="text-xl">Match format & rules</CardTitle>
        <p className="text-sm text-muted-foreground">
          Smart defaults are pre-filled. Override only what you need.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Match length
          </p>
          <div className="flex gap-2">
            {[1, 3, 5, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBestOf(n)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-all",
                  bestOf === n
                    ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/15 text-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                Best of {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sequencing
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              label="Match interval (minutes)"
              hint="Time between successive matches"
              value={matchInterval}
              onChange={setMatchInterval}
              suffix="min"
            />
            <NumField
              label="Check-in window (minutes)"
              hint="Time before kickoff for player check-in"
              value={checkInWindow}
              onChange={setCheckInWindow}
              suffix="min"
            />
            <NumField
              label="Reschedule cutoff (hours)"
              hint="No reschedules within this many hours of kickoff"
              value={rescheduleCutoff}
              onChange={setRescheduleCutoff}
              suffix="hrs"
            />
            <CheckCard
              checked={concurrentMatches}
              onChange={setConcurrentMatches}
              label="Concurrent matches"
              desc="Multiple matches can happen simultaneously"
              icon={Clock}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Result confirmation
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirmationMode("CONSENSUS")}
              className={cn(
                "rounded-lg border bg-background/40 p-3 text-left transition-all",
                confirmationMode === "CONSENSUS"
                  ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                  : "border-border/60 hover:border-border",
              )}
            >
              <p className="text-[13px] font-semibold">Both sides confirm</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Both teams must confirm the result before it finalizes. Higher trust, slower.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setConfirmationMode("DELAYED_AUTO")}
              className={cn(
                "rounded-lg border bg-background/40 p-3 text-left transition-all",
                confirmationMode === "DELAYED_AUTO"
                  ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                  : "border-border/60 hover:border-border",
              )}
            >
              <p className="text-[13px] font-semibold">Auto-finish after delay</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Single confirmation finalizes after a delay. Handles &quot;rage quit&quot; no-confirms.
              </p>
            </button>
          </div>
          {confirmationMode === "DELAYED_AUTO" ? (
            <NumField
              label="Auto-finish delay (minutes)"
              hint="Time after first confirmation before result locks"
              value={autoFinishMinutes}
              onChange={setAutoFinishMinutes}
              suffix="min"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
          className="max-w-[140px]"
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

// --- Step 5: Review -----------------------------------------------------

function ReviewStep({ data }: { data: Record<string, string | number | boolean> }) {
  const templateName = STAGE_TEMPLATES.find((t) => t.id === data.template)?.name ?? "Custom";

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Step 5</p>
          <CardTitle className="text-xl">Review & activate</CardTitle>
          <p className="text-sm text-muted-foreground">
            Look it over. Activating will open registration immediately and queue the scheduler.
          </p>
        </CardHeader>
      </Card>

      <Card className="border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {data.season}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{data.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{data.game}</span>
                <span>·</span>
                <span>{data.tier}</span>
                <span>·</span>
                <span>{data.isOnline ? "Online" : "In-person"}</span>
                {data.unified ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-[color:var(--brand-purple)]">
                      <HeartHandshake className="h-3 w-3" /> Unified
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <span className="rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
              Draft → Ready
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Schedule" icon={CalendarRange}>
          <Row label="Competition runs" value={`${formatDate(String(data.startsAt))} → ${formatDate(String(data.endsAt))}`} />
          <Row label="Registration" value={`${formatDate(String(data.registrationOpensAt))} → ${formatDate(String(data.registrationClosesAt))}`} />
        </SummaryCard>

        <SummaryCard title="Structure" icon={ListTree}>
          <Row label="Template" value={templateName} />
          <Row label="Expected teams" value={String(data.expectedTeams)} />
        </SummaryCard>

        <SummaryCard title="Match format" icon={Trophy}>
          <Row label="Best of" value={String(data.bestOf)} />
          <Row label="Match interval" value={`${data.matchInterval} min`} />
          <Row label="Check-in window" value={`${data.checkInWindow} min`} />
          <Row label="Concurrent matches" value={data.concurrentMatches ? "Yes" : "No"} />
          <Row label="Reschedule cutoff" value={`${data.rescheduleCutoff} hrs`} />
        </SummaryCard>

        <SummaryCard title="Result confirmation" icon={Users}>
          <Row
            label="Mode"
            value={data.confirmationMode === "CONSENSUS" ? "Both sides confirm" : "Auto-finish after delay"}
          />
          {data.confirmationMode === "DELAYED_AUTO" ? (
            <Row label="Auto-finish delay" value={`${data.autoFinishMinutes} min`} />
          ) : null}
        </SummaryCard>
      </div>

      <Card className="border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-purple)]" />
          <div>
            <p className="text-[13px] font-semibold">After activation, the AI Scheduler will:</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
              <li>• Open registration to eligible schools</li>
              <li>• Wait until registration closes or capacity hits</li>
              <li>• Generate the round-robin schedule, respecting team availability windows</li>
              <li>• Surface conflicts as suggestions — never auto-assign without your review</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="flex items-start gap-3 p-4">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            &quot;Save as draft&quot; stores everything but keeps the competition hidden from coaches.
            &quot;Activate&quot; publishes it and opens registration immediately.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// --- Tier mapping ------------------------------------------------------

const TIER_TO_ENUM: Record<string, SkillTierEnum> = {
  Varsity: "VARSITY",
  JV: "JV",
  Club: "CLUB",
  Premier: "PREMIER",
  Academy: "ACADEMY",
  "Middle School": "MIDDLE_SCHOOL",
  Unified: "UNIFIED",
};

type SkillTierEnum =
  | "CLUB"
  | "JV"
  | "VARSITY"
  | "PREMIER"
  | "ACADEMY"
  | "MIDDLE_SCHOOL"
  | "UNIFIED";

function tierToEnum(label: string, unified: boolean): SkillTierEnum {
  // The "unified" toggle is independent of tier picker in the UI — when on,
  // it overrides whatever tier the user clicked since `UNIFIED` is its own
  // skill tier. (Mirrors how seed treats unified events.)
  if (unified) return "UNIFIED";
  return TIER_TO_ENUM[label] ?? "VARSITY";
}
