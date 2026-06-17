"use client";

import type { FormEvent, ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ExternalLink,
  FileText,
  Pin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  createLeagueResource,
  deleteLeagueResource,
  type ResourceActionResult,
  updateLeagueResource,
} from "@/lib/league/resource-actions";
import {
  audienceLabel,
  categoryLabel,
  RESOURCE_AUDIENCES,
  RESOURCE_CATEGORIES,
  type LeagueResourceManagerData,
  type LeagueResourceRow,
} from "@/lib/league/resources";
import { cn } from "@/lib/utils";

type Props = {
  leagueId: string;
  data: LeagueResourceManagerData;
};

export function ResourceManager({ leagueId, data }: Props) {
  const [createResult, setCreateResult] = useState<ResourceActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateResult(null);
    const form = event.currentTarget;
    const payload = formToPayload(leagueId, new FormData(form));
    startTransition(async () => {
      const result = await createLeagueResource(payload);
      setCreateResult(result);
      if (result.ok) form.reset();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              New resource
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Add a league rule or guide</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Publish league-wide rules, game-specific setup notes, eligibility policies, or match-day instructions.
            </p>
          </div>
        </div>

        <form onSubmit={onCreate} className="space-y-4">
          <ResourceFields data={data} />
          <ActionMessage result={createResult} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {pending ? "Publishing..." : "Create resource"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-purple)]">
            Resource library
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {data.resources.length} resource{data.resources.length === 1 ? "" : "s"}
          </h2>
        </div>

        {data.resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
            <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No resources yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Add the league handbook, match-day checklist, or game-specific rules above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.resources.map((resource) => (
              <ResourceEditor
                key={resource.id}
                leagueId={leagueId}
                resource={resource}
                data={data}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResourceEditor({
  leagueId,
  resource,
  data,
}: {
  leagueId: string;
  resource: LeagueResourceRow;
  data: LeagueResourceManagerData;
}) {
  const [result, setResult] = useState<ResourceActionResult | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const payload = {
      ...formToPayload(leagueId, new FormData(event.currentTarget)),
      resourceId: resource.id,
    };
    startTransition(async () => {
      setResult(await updateLeagueResource(payload));
    });
  }

  function onDelete() {
    setResult(null);
    startTransition(async () => {
      const response = await deleteLeagueResource({ leagueId, resourceId: resource.id });
      setResult(response);
      if (response.ok) setRemoved(true);
    });
  }

  if (removed) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-[13px] text-muted-foreground">
        Removed {resource.title}. Refreshing...
      </div>
    );
  }

  return (
    <details className="group rounded-2xl border border-border/60 bg-card/70 p-4 open:bg-card/85">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <FileText className="h-4 w-4 text-[color:var(--brand-crimson)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{resource.title}</h3>
            {resource.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
                <Pin className="h-2.5 w-2.5" />
                Pinned
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                resource.published
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {resource.published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {resource.summary ?? resource.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            <Pill>{categoryLabel(resource.category)}</Pill>
            <Pill>{audienceLabel(resource.audience)}</Pill>
            {resource.gameTitle ? <Pill>{resource.gameTitle.name}</Pill> : null}
            {resource.season ? <Pill>{resource.season.name}</Pill> : null}
            {resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 hover:text-foreground"
                onClick={(event) => event.stopPropagation()}
              >
                Link
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </div>
        </div>
        <span className="mt-1 text-[11px] font-medium text-muted-foreground group-open:hidden">
          Edit
        </span>
      </summary>

      <form onSubmit={onUpdate} className="mt-4 space-y-4 border-t border-border/60 pt-4">
        <ResourceFields data={data} resource={resource} />
        <ActionMessage result={result} />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 px-3 py-2 text-[12px] font-semibold text-[color:var(--brand-crimson)] transition-colors hover:bg-[color:var(--brand-crimson)]/15 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {pending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </details>
  );
}

function ResourceFields({
  data,
  resource,
}: {
  data: LeagueResourceManagerData;
  resource?: LeagueResourceRow;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Title" errorKey="title">
          <input
            name="title"
            required
            defaultValue={resource?.title ?? ""}
            placeholder="League handbook"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
        <Field label="Category" errorKey="category">
          <select
            name="category"
            defaultValue={resource?.category ?? "GENERAL_RULES"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {RESOURCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Audience" errorKey="audience">
          <select
            name="audience"
            defaultValue={resource?.audience ?? "ALL"}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {RESOURCE_AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {audienceLabel(audience)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Summary" errorKey="summary">
        <input
          name="summary"
          defaultValue={resource?.summary ?? ""}
          placeholder="Short note shown in the resource list"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </Field>

      <Field label="Resource text" errorKey="body">
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={resource?.body ?? ""}
          placeholder="Paste or write the rule text, lobby setup steps, or match-day instructions here."
          className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="External link" errorKey="url">
          <input
            name="url"
            type="url"
            defaultValue={resource?.url ?? ""}
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
        <Field label="Game scope" errorKey="gameTitleId">
          <select
            name="gameTitleId"
            defaultValue={resource?.gameTitle?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="">All games</option>
            {data.games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Season scope" errorKey="seasonId">
          <select
            name="seasonId"
            defaultValue={resource?.season?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="">All seasons</option>
            {data.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Competition scope" errorKey="competitionId">
          <select
            name="competitionId"
            defaultValue={resource?.competition?.id ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="">All competitions</option>
            {data.competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12px]">
          <input
            type="checkbox"
            name="pinned"
            defaultChecked={resource?.pinned ?? false}
            className="accent-[color:var(--brand-crimson)]"
          />
          Pin to top
        </label>
        <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12px]">
          <input
            type="checkbox"
            name="published"
            defaultChecked={resource?.published ?? true}
            className="accent-[color:var(--brand-crimson)]"
          />
          Published
        </label>
      </div>
    </div>
  );
}

function Field({
  label,
  errorKey,
  children,
}: {
  label: string;
  errorKey: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
      <span data-error-for={errorKey} className="sr-only" />
    </label>
  );
}

function ActionMessage({ result }: { result: ResourceActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[12px] text-emerald-600 dark:text-emerald-400">
        Saved.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-2 text-[12px] text-[color:var(--brand-crimson)]">
      <p>{result.error}</p>
      {result.fieldErrors ? (
        <ul className="mt-1 list-disc pl-4">
          {Object.entries(result.fieldErrors).map(([field, message]) => (
            <li key={field}>
              <span className="font-mono">{field}</span>: {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-background px-1.5 py-0.5">
      {children}
    </span>
  );
}

function formToPayload(leagueId: string, formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const maybe = (key: string) => text(key) || null;
  return {
    leagueId,
    title: text("title"),
    summary: maybe("summary"),
    body: text("body"),
    url: maybe("url"),
    category: text("category"),
    audience: text("audience"),
    gameTitleId: maybe("gameTitleId"),
    seasonId: maybe("seasonId"),
    competitionId: maybe("competitionId"),
    pinned: formData.get("pinned") === "on",
    published: formData.get("published") === "on",
  };
}
