"use client";

/**
 * "New team" trigger + create dialog.
 *
 * Called from /dashboard/teams. Picks the school (single-school coaches
 * skip this step), game, tier, and an optional custom name / color tag.
 * On success, navigates to the new team's detail page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus, X } from "lucide-react";

import {
  createTeam,
  type CreateTeamResult,
} from "@/lib/team/roster-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIER_OPTIONS = [
  { value: "VARSITY", label: "Varsity" },
  { value: "JV", label: "JV" },
  { value: "CLUB", label: "Club" },
  { value: "PREMIER", label: "Premier" },
  { value: "ACADEMY", label: "Academy" },
  { value: "MIDDLE_SCHOOL", label: "Middle School" },
  { value: "UNIFIED", label: "Unified" },
] as const;

export type CreateTeamGame = { slug: string; name: string };
export type CreateTeamSchool = { id: string; name: string };

export function CreateTeamTrigger({
  schools,
  games,
}: {
  schools: CreateTeamSchool[];
  games: CreateTeamGame[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants({ size: "sm" }),
          "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
        )}
      >
        <Plus className="mr-1.5 h-3 w-3" />
        New team
      </button>
      {open ? (
        <CreateTeamDialog
          schools={schools}
          games={games}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function CreateTeamDialog({
  schools,
  games,
  onClose,
}: {
  schools: CreateTeamSchool[];
  games: CreateTeamGame[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [gameSlug, setGameSlug] = useState(games[0]?.slug ?? "");
  const [skillTier, setSkillTier] = useState<(typeof TIER_OPTIONS)[number]["value"]>(
    "VARSITY",
  );
  const [customName, setCustomName] = useState("");
  const [colorTag, setColorTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r: CreateTeamResult = await createTeam({
        schoolId,
        gameSlug,
        skillTier,
        customName: customName.trim() || undefined,
        colorTag: colorTag.trim() || undefined,
      });
      if (r.ok) {
        router.push(`/dashboard/teams/${r.teamId}`);
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  const canSubmit = schoolId && gameSlug && !pending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              Team setup
            </p>
            <h2 id="create-team-title" className="mt-0.5 text-lg font-semibold tracking-tight">
              New team
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Teams are long-lived. Register them for specific competitions afterward.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {schools.length > 1 ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                School
              </label>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Game
              </label>
              <select
                value={gameSlug}
                onChange={(e) => setGameSlug(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Tier
              </label>
              <select
                value={skillTier}
                onChange={(e) => setSkillTier(e.target.value as typeof skillTier)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Custom name <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Carmel LoL Black"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Leave blank to auto-generate from school + game.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Color tag <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
              </label>
              <input
                type="text"
                value={colorTag}
                onChange={(e) => setColorTag(e.target.value)}
                placeholder="Black, Red, A, B"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p>{error}</p>
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

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border border-border/60 px-3 py-2 text-[12px] font-medium hover:bg-background/40 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
