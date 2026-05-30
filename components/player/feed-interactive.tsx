"use client";

import { useState, type FormEvent } from "react";
import { Award, ImageIcon, ListChecks, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// --- CreatePostCard ----------------------------------------------------

const CHIPS: Array<{ label: string; icon: LucideIcon; tone: string }> = [
  { label: "Photo", icon: ImageIcon, tone: "text-emerald-400" },
  { label: "Highlight", icon: Trophy, tone: "text-[color:var(--brand-gold)]" },
  { label: "Achievement", icon: Award, tone: "text-[color:var(--brand-purple)]" },
  { label: "Poll", icon: ListChecks, tone: "text-sky-400" },
];

export function CreatePostCard({ initials }: { initials: string }) {
  const [body, setBody] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: POST to /api/posts when the schema lands
    setBody("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border/60 bg-card/60 p-4 transition-colors focus-within:border-[color:var(--brand-crimson)]/40 hover:bg-card md:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700 text-[11px] font-semibold text-white">
          {initials}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <c.icon className={cn("h-3.5 w-3.5", c.tone)} />
            {c.label}
          </button>
        ))}
        <button
          type="submit"
          disabled={!body.trim()}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-crimson)] px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </form>
  );
}

// --- FeedTabs ----------------------------------------------------------

const TABS = ["All", "Matches", "Highlights", "Achievements", "Mentions"] as const;
type TabName = (typeof TABS)[number];

export function FeedTabs({
  active = "All",
  onChange,
}: {
  active?: TabName;
  onChange?: (t: TabName) => void;
}) {
  const [current, setCurrent] = useState<TabName>(active);
  return (
    <div className="border-b border-border/60">
      <div className="flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = current === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setCurrent(t);
                onChange?.(t);
              }}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full bg-[color:var(--brand-crimson)] shadow-[0_0_10px_oklch(0.4555_0.1734_19.27/60%)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
