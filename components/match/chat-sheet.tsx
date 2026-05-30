"use client";

/**
 * Slide-up match chat overlay.
 *
 * Reads from a pre-loaded `MatchChatPayload` (no network on open — sheet
 * appears instantly). The input is disabled today and labeled
 * "Coming soon" — when realtime + insert flows land in Sprint 3b/4,
 * the input becomes live without UI changes.
 *
 * Why a sheet instead of a route: the 3-tap brief requires "open chat
 * without navigating away." A bottom sheet keeps the player on /me so
 * back/forward, scroll position, and right-sidebar context all survive.
 */

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  ShieldCheck,
  Send,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { MatchChatPayload } from "@/lib/match/match-day";

export function ChatSheet({
  payload,
  open,
  onClose,
}: {
  payload: MatchChatPayload | null;
  open: boolean;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while sheet is open + scroll the thread to the bottom
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Defer scroll-to-bottom until layout settles
    queueMicrotask(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !payload) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:h-[640px] sm:rounded-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              <CircleDot className="h-3 w-3" />
              Match chat
            </p>
            <h2 id="chat-sheet-title" className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
              {payload.ownTeam} <span className="text-muted-foreground">vs</span> {payload.opponentTeam}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Permission verified pill — matches the "auto-permission" promise */}
        <div className="border-b border-border/60 bg-background/40 px-5 py-2">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-500">
            <CheckCircle2 className="h-3 w-3" />
            You&apos;re verified for this channel
          </p>
        </div>

        {/* Messages */}
        <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {payload.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <p className="text-[12px] text-muted-foreground">
                No messages yet. Say hi to your opponent before kickoff.
              </p>
            </div>
          ) : (
            payload.messages.map((m) => <ChatBubble key={m.id} msg={m} />)
          )}
        </div>

        {/* Input (locked for Sprint 3 — wired in 3b alongside realtime) */}
        <footer className="border-t border-border/60 bg-background/40 px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5 opacity-70">
            <input
              type="text"
              placeholder="Sending lands with realtime — coming soon"
              disabled
              className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              disabled
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--brand-crimson)]/60 text-white"
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Channel auto-archives 7 days after the match. Coaches and captains can pin or mute.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: MatchChatPayload["messages"][number] }) {
  if (msg.isSystem) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[color:var(--brand-purple)]/25 bg-[color:var(--brand-purple)]/5 px-3 py-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--brand-purple)]" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-purple)]">
            {msg.authorName}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-foreground">{msg.body}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{shortTime(msg.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", msg.isOwnTeam ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tracking-tight text-white",
          msg.isOwnTeam
            ? "bg-gradient-to-br from-[color:var(--brand-crimson)] to-rose-700"
            : "bg-gradient-to-br from-zinc-600 to-zinc-800",
        )}
      >
        {msg.authorInitials}
      </div>
      <div className={cn("max-w-[75%] min-w-0", msg.isOwnTeam ? "items-end text-right" : "items-start")}>
        <p className={cn("text-[10px] text-muted-foreground", msg.isOwnTeam && "text-right")}>
          {msg.authorName} <span className="text-muted-foreground/60">· {shortTime(msg.createdAt)}</span>
        </p>
        <div
          className={cn(
            "mt-1 rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
            msg.isOwnTeam
              ? "rounded-br-sm bg-[color:var(--brand-crimson)] text-white"
              : "rounded-bl-sm bg-card text-foreground",
          )}
        >
          {msg.body}
        </div>
      </div>
    </div>
  );
}

function shortTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
