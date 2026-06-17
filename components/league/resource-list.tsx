import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, FileText, Pin } from "lucide-react";

import {
  audienceLabel,
  categoryLabel,
  type LeagueResourceRow,
} from "@/lib/league/resources";
import { cn } from "@/lib/utils";

export function ResourceList({
  resources,
  emptyTitle = "No resources published yet",
  emptyBody = "Rules and match-day guides will appear here when the league publishes them.",
  showAudience = false,
}: {
  resources: LeagueResourceRow[];
  emptyTitle?: string;
  emptyBody?: string;
  showAudience?: boolean;
}) {
  if (resources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
        <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {resources.map((resource) => (
        <article
          key={resource.id}
          className={cn(
            "rounded-2xl border bg-card/75 p-5",
            resource.pinned
              ? "border-[color:var(--brand-gold)]/40"
              : "border-border/60",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <FileText className="h-4 w-4 text-[color:var(--brand-crimson)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight">{resource.title}</h3>
                {resource.pinned ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
                    <Pin className="h-2.5 w-2.5" />
                    Pinned
                  </span>
                ) : null}
              </div>
              {resource.summary ? (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {resource.summary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            <Pill>{categoryLabel(resource.category)}</Pill>
            {showAudience ? <Pill>{audienceLabel(resource.audience)}</Pill> : null}
            {resource.gameTitle ? <Pill>{resource.gameTitle.name}</Pill> : null}
            {resource.season ? <Pill>{resource.season.name}</Pill> : null}
            {resource.competition ? <Pill>{resource.competition.name.replace(/^Spring 2026 — /, "")}</Pill> : null}
          </div>

          <div className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
            {resource.body}
          </div>

          {resource.url ? (
            <Link
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Open linked resource
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </article>
      ))}
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
