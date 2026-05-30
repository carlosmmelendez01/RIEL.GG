"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronsUpDown,
  ClipboardList,
  GraduationCap,
  Globe2,
  Mail,
  Palette,
  Save,
  Sparkles,
  ShieldCheck,
  School,
  Trophy,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_GAMES, type ClassificationKind } from "@/lib/mock/platform";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Identity", icon: ClipboardList },
  { id: 2, label: "Branding", icon: Palette },
  { id: 3, label: "Games", icon: Trophy },
  { id: 4, label: "Owner", icon: UserPlus },
  { id: 5, label: "Review", icon: Check },
] as const;

const CLASSIFICATIONS: { id: ClassificationKind; label: string; desc: string; icon: LucideIcon }[] = [
  {
    id: "SCHOLASTIC",
    label: "Scholastic (K-12)",
    desc: "High school league. Default skill tiers: Varsity, JV, Club, Unified.",
    icon: GraduationCap,
  },
  {
    id: "COLLEGIATE",
    label: "Collegiate",
    desc: "College / university league. Default tiers: Varsity, Premier, Academy.",
    icon: School,
  },
  {
    id: "AMATEUR",
    label: "Amateur / Community",
    desc: "Open community league. Custom tier system.",
    icon: Globe2,
  },
];

const COLOR_PRESETS = [
  { name: "Crimson + Gold", primary: "#A31F34", secondary: "#FFCC00" },
  { name: "Navy + Amber", primary: "#0F4D8C", secondary: "#F5A623" },
  { name: "Forest + Cream", primary: "#1F5037", secondary: "#FAEDCD" },
  { name: "Royal + Sky", primary: "#1E3A8A", secondary: "#7DD3FC" },
  { name: "Onyx + Magenta", primary: "#0A0A0A", secondary: "#C026D3" },
  { name: "Maroon + White", primary: "#7C1D1D", secondary: "#F8FAFC" },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

export default function CreateLeaguePage() {
  const [step, setStep] = useState(1);

  // Identity
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [classification, setClassification] = useState<ClassificationKind>("SCHOLASTIC");
  const [tagline, setTagline] = useState("");

  // Branding
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].primary);
  const [secondaryColor, setSecondaryColor] = useState(COLOR_PRESETS[0].secondary);

  // Games (selection of game ids)
  const [selectedGames, setSelectedGames] = useState<string[]>(["lol", "val", "rl", "smash"]);

  // Owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [trialMode, setTrialMode] = useState(true);

  const computedSlug = slug || slugify(name);
  const computedShort = shortName || (name ? name.split(" ").map((w) => w[0]).join("").slice(0, 4).toUpperCase() : "");

  const canContinue = useMemo(() => {
    if (step === 1) return name.trim().length > 1 && computedSlug.length > 1;
    if (step === 4) return ownerName.trim().length > 1 && /\S+@\S+\.\S+/.test(ownerEmail);
    return true;
  }, [step, name, computedSlug, ownerName, ownerEmail]);

  return (
    <>
      <PlatformTopbar
        title="Create League"
        eyebrow={`Step ${step} of ${STEPS.length} · ${STEPS[step - 1].label}`}
      />

      <main className="flex-1 px-6 py-6 md:px-8">
        <Stepper step={step} onJump={(s) => s < step && setStep(s)} />

        <div className="mx-auto mt-8 max-w-3xl">
          {step === 1 ? (
            <IdentityStep
              name={name}
              setName={setName}
              shortName={shortName}
              setShortName={setShortName}
              slug={slug}
              setSlug={setSlug}
              region={region}
              setRegion={setRegion}
              classification={classification}
              setClassification={setClassification}
              tagline={tagline}
              setTagline={setTagline}
              computedSlug={computedSlug}
              computedShort={computedShort}
            />
          ) : null}

          {step === 2 ? (
            <BrandingStep
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
              secondaryColor={secondaryColor}
              setSecondaryColor={setSecondaryColor}
              shortName={computedShort || "RIEL"}
              name={name || "Your League"}
            />
          ) : null}

          {step === 3 ? (
            <GamesStep selectedGames={selectedGames} setSelectedGames={setSelectedGames} />
          ) : null}

          {step === 4 ? (
            <OwnerStep
              ownerName={ownerName}
              setOwnerName={setOwnerName}
              ownerEmail={ownerEmail}
              setOwnerEmail={setOwnerEmail}
              trialMode={trialMode}
              setTrialMode={setTrialMode}
            />
          ) : null}

          {step === 5 ? (
            <ReviewStep
              data={{
                name,
                shortName: computedShort,
                slug: computedSlug,
                region,
                classification,
                tagline,
                primaryColor,
                secondaryColor,
                selectedGames,
                ownerName,
                ownerEmail,
                trialMode,
              }}
            />
          ) : null}
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between border-t border-border/60 pt-6">
          <Link href="/platform/leagues" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
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
                disabled={!canContinue}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50",
                )}
              >
                Continue
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </button>
            ) : (
              <>
                <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  <Save className="mr-1.5 h-3 w-3" />
                  Save as draft
                </button>
                <button
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson",
                  )}
                >
                  <Sparkles className="mr-1.5 h-3 w-3" />
                  Provision league
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

// --- Step 1: Identity ---------------------------------------------------

function IdentityStep(props: {
  name: string;
  setName: (s: string) => void;
  shortName: string;
  setShortName: (s: string) => void;
  slug: string;
  setSlug: (s: string) => void;
  region: string;
  setRegion: (s: string) => void;
  classification: ClassificationKind;
  setClassification: (c: ClassificationKind) => void;
  tagline: string;
  setTagline: (s: string) => void;
  computedSlug: string;
  computedShort: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step 1</p>
        <CardTitle className="text-xl">Identify the league</CardTitle>
        <p className="text-sm text-muted-foreground">
          Who is the customer, what should the league be called, and which segment does it serve?
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">League name</Label>
          <Input
            id="name"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="Hoosier Esports Alliance"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shortName">Short name / abbreviation</Label>
            <Input
              id="shortName"
              value={props.shortName}
              onChange={(e) => props.setShortName(e.target.value.toUpperCase())}
              placeholder={props.computedShort || "HEA"}
              maxLength={6}
            />
            <p className="text-[11px] text-muted-foreground">
              Used in nav, badges, and {`{shortName}.riel.gg`}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Subdomain slug</Label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 text-sm">
              <span className="text-muted-foreground">riel.gg/</span>
              <input
                id="slug"
                value={props.slug}
                onChange={(e) => props.setSlug(slugify(e.target.value))}
                placeholder={props.computedSlug || "hea"}
                className="h-9 flex-1 bg-transparent text-foreground focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-generated from name. Lowercase letters and hyphens only.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="region">Region / scope</Label>
          <Input
            id="region"
            value={props.region}
            onChange={(e) => props.setRegion(e.target.value)}
            placeholder="Indiana"
          />
        </div>

        <div className="space-y-2">
          <Label>Classification</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {CLASSIFICATIONS.map((c) => {
              const Icon = c.icon;
              const selected = props.classification === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => props.setClassification(c.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-background/40 p-3 text-left transition-all",
                    selected
                      ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] font-semibold">{c.label}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{c.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline (optional)</Label>
          <Input
            id="tagline"
            value={props.tagline}
            onChange={(e) => props.setTagline(e.target.value)}
            placeholder="Indiana high school varsity esports"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Step 2: Branding ---------------------------------------------------

function BrandingStep(props: {
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  secondaryColor: string;
  setSecondaryColor: (c: string) => void;
  shortName: string;
  name: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step 2</p>
        <CardTitle className="text-xl">Brand the league</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick brand colors. The league owner can upload a logo and full asset kit later.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Color presets</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {COLOR_PRESETS.map((p) => {
              const selected = props.primaryColor === p.primary && props.secondaryColor === p.secondary;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    props.setPrimaryColor(p.primary);
                    props.setSecondaryColor(p.secondary);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all",
                    selected
                      ? "border-[color:var(--brand-crimson)] ring-2 ring-[color:var(--brand-crimson)]/30"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="flex shrink-0 -space-x-2">
                    <span
                      className="h-7 w-7 rounded-full border border-background"
                      style={{ background: p.primary }}
                    />
                    <span
                      className="h-7 w-7 rounded-full border border-background"
                      style={{ background: p.secondary }}
                    />
                  </div>
                  <span className="text-[12px] font-medium">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Primary"
            value={props.primaryColor}
            onChange={props.setPrimaryColor}
          />
          <ColorField
            label="Secondary"
            value={props.secondaryColor}
            onChange={props.setSecondaryColor}
          />
        </div>

        <div className="rounded-lg border border-border/60 bg-background/40 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Live preview
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-xl text-base font-bold tracking-tight text-white shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${props.primaryColor} 0%, ${props.secondaryColor} 100%)`,
              }}
            >
              {props.shortName.slice(0, 4)}
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">{props.name}</p>
              <p className="text-xs text-muted-foreground">League badge & sidebar mark</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5">
        <span
          className="h-7 w-7 shrink-0 rounded-md border border-border"
          style={{ background: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 flex-1 bg-transparent font-mono text-sm focus:outline-none"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
      </div>
    </div>
  );
}

// --- Step 3: Games ------------------------------------------------------

function GamesStep({
  selectedGames,
  setSelectedGames,
}: {
  selectedGames: string[];
  setSelectedGames: (g: string[]) => void;
}) {
  const toggle = (id: string) => {
    setSelectedGames(
      selectedGames.includes(id)
        ? selectedGames.filter((g) => g !== id)
        : [...selectedGames, id],
    );
  };

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step 3</p>
        <CardTitle className="text-xl">Pick the games offered</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pre-select titles this league will run. The league admin can add or remove games later.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          {selectedGames.length} of {PLATFORM_GAMES.length} games selected
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLATFORM_GAMES.map((g) => {
            const selected = selectedGames.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-background/40 p-3 text-left transition-all",
                  selected
                    ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/8 ring-2 ring-[color:var(--brand-crimson)]/30"
                    : "border-border/60 hover:border-border",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold">{g.name}</p>
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all",
                        selected ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]" : "border-border",
                      )}
                    >
                      {selected ? <Check className="h-3 w-3 text-white" /> : null}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {g.publisher} · Formats: {g.formats.join(", ")}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-[color:var(--brand-crimson)]"
                        style={{ width: `${g.popularity}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{g.popularity}% adoption</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Step 4: Owner ------------------------------------------------------

function OwnerStep(props: {
  ownerName: string;
  setOwnerName: (s: string) => void;
  ownerEmail: string;
  setOwnerEmail: (s: string) => void;
  trialMode: boolean;
  setTrialMode: (b: boolean) => void;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step 4</p>
        <CardTitle className="text-xl">Invite the league owner</CardTitle>
        <p className="text-sm text-muted-foreground">
          Who will run this league day-to-day? They'll get full ownership. You can add more admins later.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ownerName">Owner name</Label>
            <Input
              id="ownerName"
              value={props.ownerName}
              onChange={(e) => props.setOwnerName(e.target.value)}
              placeholder="Jamie Holcomb"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                id="ownerEmail"
                type="email"
                value={props.ownerEmail}
                onChange={(e) => props.setOwnerEmail(e.target.value)}
                placeholder="jamie@hoosieresports.org"
                className="h-9 flex-1 bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
            props.trialMode
              ? "border-[color:var(--brand-purple)] bg-[color:var(--brand-purple)]/8"
              : "border-border/60 bg-background/40 hover:border-border",
          )}
          onClick={() => props.setTrialMode(!props.trialMode)}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-purple)]" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold">Start with a 14-day trial</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              League gets full functionality. After 14 days, status flips to Paused unless converted to a paid plan.
            </p>
          </div>
          <div
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all",
              props.trialMode
                ? "border-[color:var(--brand-purple)] bg-[color:var(--brand-purple)]"
                : "border-border",
            )}
          >
            {props.trialMode ? <Check className="h-3 w-3 text-white" /> : null}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <p className="flex items-center gap-2 text-[12px] font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            Owner gets a single-use ownership invite link
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Coach + Manager roles + League Owner. Max uses = 1, expires in 7 days. They can promote additional
            admins after accepting.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Step 5: Review -----------------------------------------------------

function ReviewStep({ data }: { data: Record<string, unknown> }) {
  const games = (data.selectedGames as string[]).map(
    (id) => PLATFORM_GAMES.find((g) => g.id === id)?.name ?? id,
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step 5</p>
          <CardTitle className="text-xl">Review & provision</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review the configuration. Provisioning will create the league, send the owner invite, and add it to
            your platform directory.
          </p>
        </CardHeader>
      </Card>

      <Card className="border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-base font-bold tracking-tight text-white shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${data.primaryColor as string} 0%, ${data.secondaryColor as string} 100%)`,
              }}
            >
              {(data.shortName as string).slice(0, 4)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {data.classification as string} · {data.region as string}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{data.name as string}</p>
              {data.tagline ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{data.tagline as string}</p>
              ) : null}
              <p className="mt-2 font-mono text-[12px] text-muted-foreground">
                riel.gg/{data.slug as string}
              </p>
            </div>
            <span className="rounded-md border border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-purple)]">
              {data.trialMode ? "Trial · 14d" : "Paid"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Owner" icon={UserPlus}>
          <Row label="Name" value={(data.ownerName as string) || "—"} />
          <Row label="Email" value={(data.ownerEmail as string) || "—"} />
          <Row label="Roles granted" value="Coach + Manager + Owner" />
          <Row label="Invite expires" value="In 7 days" />
        </SummaryCard>

        <SummaryCard title="Branding" icon={Palette}>
          <Row label="Primary" value={data.primaryColor as string} mono />
          <Row label="Secondary" value={data.secondaryColor as string} mono />
        </SummaryCard>

        <SummaryCard title="Game catalog" icon={Trophy}>
          <p className="text-[12px] text-foreground">{games.join(" · ")}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {games.length} games enabled. Owner can adjust later.
          </p>
        </SummaryCard>

        <SummaryCard title="Provisioning" icon={Building2}>
          <Row label="Subdomain" value={`riel.gg/${data.slug as string}`} mono />
          <Row label="School slots" value="Unlimited (Tier 2)" />
          <Row label="Default tiers" value="Varsity · JV · Club · Unified" />
        </SummaryCard>
      </div>

      <Card className="border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-crimson)]" />
          <div>
            <p className="text-[13px] font-semibold">When you click "Provision league":</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
              <li>• League workspace at <span className="font-mono">riel.gg/{data.slug as string}</span> is created</li>
              <li>• {games.length} game competitions are pre-configured (in Draft state)</li>
              <li>• Owner invite is generated and emailed to {(data.ownerEmail as string) || "—"}</li>
              <li>• {data.trialMode ? "14-day trial timer starts" : "Paid plan billing begins"}</li>
              <li>• League appears in your /platform/leagues directory</li>
            </ul>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", mono && "font-mono text-[12px]")}>{value}</span>
    </div>
  );
}

// suppress unused
void ChevronsUpDown;
