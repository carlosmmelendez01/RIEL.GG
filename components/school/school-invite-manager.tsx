"use client";

/**
 * Coach-side school invite manager.
 *
 *   - "Invite someone" button → opens a modal (role / email / expiry)
 *   - Outstanding invites list with copy / revoke buttons
 *
 * Role authority is gated server-side, but we mirror it in the UI so
 * COACH-tier users don't see actions they can't take (e.g., MANAGER role
 * option or "grants ownership" checkbox).
 */

import { useState, useTransition } from "react";
import {
  CircleAlert,
  Clock,
  Copy,
  Crown,
  Link2,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSchoolInvite,
  revokeSchoolInvite,
  type CreateSchoolInviteResult,
  type RevokeSchoolInviteResult,
} from "@/lib/invite/invite-actions";
import type { SchoolOutstandingInvite } from "@/lib/school/data";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<"MANAGER" | "COACH" | "PLAYER", string> = {
  MANAGER: "Manager",
  COACH: "Coach",
  PLAYER: "Player",
};

const ROLE_TONE: Record<"MANAGER" | "COACH" | "PLAYER", string> = {
  MANAGER: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  COACH: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  PLAYER: "border-border/60 bg-background/60 text-muted-foreground",
};

export function SchoolInviteManager({
  schoolId,
  schoolName,
  viewerRole,
  invites,
}: {
  schoolId: string;
  schoolName: string;
  viewerRole: "MANAGER" | "COACH";
  invites: SchoolOutstandingInvite[];
}) {
  const [open, setOpen] = useState(false);
  const [freshInvite, setFreshInvite] = useState<{
    code: string;
    url: string;
    role: "MANAGER" | "COACH" | "PLAYER";
    intendedEmail: string | null;
  } | null>(null);

  // After successful create, append to the displayed list optimistically so
  // the coach can grab the link without a page refresh. revalidatePath
  // catches us up on next nav.
  const optimisticInvites = freshInvite
    ? [
        {
          id: `__fresh-${freshInvite.code}`,
          code: freshInvite.code,
          url: freshInvite.url,
          role: freshInvite.role,
          intendedEmail: freshInvite.intendedEmail,
          maxUses: 1,
          usedCount: 0,
          grantsOwnership: false,
          expiresAt: null,
          createdAt: new Date(),
          createdByName: "You (just now)",
        },
        ...invites,
      ]
    : invites;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          Invitations
        </p>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-[color:var(--brand-crimson)]" />
          Outstanding invites
          <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {optimisticInvites.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite someone to {schoolName}
        </button>

        {optimisticInvites.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-4 text-center text-[12px] text-muted-foreground">
            No active invites. Use the button above to invite an assistant coach or
            player.
          </div>
        ) : (
          <ul className="space-y-2">
            {optimisticInvites.map((invite) => (
              <li key={invite.id}>
                <InviteRow
                  invite={invite}
                  viewerRole={viewerRole}
                  isFresh={invite.id.startsWith("__fresh-")}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {open ? (
        <CreateInviteDialog
          schoolId={schoolId}
          schoolName={schoolName}
          viewerRole={viewerRole}
          onClose={() => setOpen(false)}
          onCreated={(invite) => setFreshInvite(invite)}
        />
      ) : null}
    </Card>
  );
}

// --- Single invite row -------------------------------------------------

function InviteRow({
  invite,
  viewerRole,
  isFresh,
}: {
  invite: SchoolOutstandingInvite;
  viewerRole: "MANAGER" | "COACH";
  isFresh: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [pending, startTransition] = useTransition();

  const absoluteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${invite.url}`
      : invite.url;

  function handleCopy() {
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleRevoke() {
    if (isFresh) return; // can't revoke the optimistic row; refresh first
    setRevokeError(null);
    startTransition(async () => {
      const r: RevokeSchoolInviteResult = await revokeSchoolInvite({
        inviteId: invite.id,
      });
      if (r.ok) setRevoked(true);
      else setRevokeError(r.error);
    });
  }

  if (revoked) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-3 text-[12px] text-muted-foreground">
        <X className="h-3.5 w-3.5 shrink-0" />
        Revoked. Refreshing…
      </div>
    );
  }

  // COACHes can't revoke MANAGER invites (mirrored from server gate)
  const canRevoke = viewerRole === "MANAGER" || invite.role !== "MANAGER";

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        isFresh
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-background/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            ROLE_TONE[invite.role],
          )}
        >
          {ROLE_LABEL[invite.role]}
        </span>
        {invite.grantsOwnership ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">
            <Crown className="h-2.5 w-2.5" />
            Owner
          </span>
        ) : null}
        {invite.intendedEmail ? (
          <span className="inline-flex items-center gap-1 truncate font-mono text-[11px]">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
            {invite.intendedEmail}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            Open link · {invite.maxUses - invite.usedCount} of {invite.maxUses} uses left
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {invite.expiresAt
            ? `expires ${invite.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "no expiry"}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background p-1.5">
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <input
          readOnly
          value={absoluteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 truncate bg-transparent font-mono text-[11px] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-background"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
        {canRevoke && !isFresh ? (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-[color:var(--brand-crimson)]/10 hover:text-[color:var(--brand-crimson)] disabled:opacity-50"
            title="Revoke this invite"
          >
            <Trash2 className="h-3 w-3" />
            {pending ? "…" : "Revoke"}
          </button>
        ) : null}
      </div>

      {revokeError ? (
        <p className="flex items-start gap-1 text-[11px] text-[color:var(--brand-crimson)]">
          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {revokeError}
        </p>
      ) : null}

      {invite.createdByName ? (
        <p className="text-[10px] text-muted-foreground">
          Issued by {invite.createdByName}
        </p>
      ) : null}
    </div>
  );
}

// --- Create invite dialog ----------------------------------------------

function CreateInviteDialog({
  schoolId,
  schoolName,
  viewerRole,
  onClose,
  onCreated,
}: {
  schoolId: string;
  schoolName: string;
  viewerRole: "MANAGER" | "COACH";
  onClose: () => void;
  onCreated: (invite: {
    code: string;
    url: string;
    role: "MANAGER" | "COACH" | "PLAYER";
    intendedEmail: string | null;
  }) => void;
}) {
  const [role, setRole] = useState<"MANAGER" | "COACH" | "PLAYER">("COACH");
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresDays, setExpiresDays] = useState(30);
  const [grantsOwnership, setGrantsOwnership] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // COACH can only invite COACH or PLAYER
  const availableRoles =
    viewerRole === "MANAGER"
      ? (["MANAGER", "COACH", "PLAYER"] as const)
      : (["COACH", "PLAYER"] as const);

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r: CreateSchoolInviteResult = await createSchoolInvite({
        schoolId,
        role,
        intendedEmail: email.trim() || undefined,
        maxUses,
        expiresDays,
        grantsOwnership,
      });
      if (r.ok) {
        onCreated({
          code: r.code,
          url: r.url,
          role: r.role,
          intendedEmail: r.intendedEmail,
        });
        onClose();
      } else {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
              Invite
            </p>
            <h2 id="invite-dialog-title" className="mt-0.5 text-lg font-semibold tracking-tight">
              Invite someone to {schoolName}
            </h2>
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
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availableRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-md border bg-background/40 px-2 py-2 text-[12px] font-medium transition-colors",
                    role === r
                      ? "border-[color:var(--brand-crimson)] bg-[color:var(--brand-crimson)]/10"
                      : "border-border/60 hover:bg-card",
                  )}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recipient email{" "}
              <span className="font-normal normal-case text-muted-foreground/70">
                (optional — leave blank for an open share link)
              </span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@school.edu"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            {fieldErrors.intendedEmail ? (
              <p className="mt-1 text-[11px] text-[color:var(--brand-crimson)]">
                {fieldErrors.intendedEmail}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">
                If set, only that exact email can claim. Leave blank to allow anyone
                with the link.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Max uses
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Use {">"} 1 for an open link (multiple players claim with the same URL).
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Expires in (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={(e) =>
                  setExpiresDays(Math.max(1, parseInt(e.target.value, 10) || 30))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          {viewerRole === "MANAGER" && role === "MANAGER" ? (
            <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2.5 text-[12px]">
              <input
                type="checkbox"
                checked={grantsOwnership}
                onChange={(e) => setGrantsOwnership(e.target.checked)}
                className="h-3.5 w-3.5 accent-[color:var(--brand-gold)]"
              />
              <Crown className="h-3.5 w-3.5 text-[color:var(--brand-gold)]" />
              <span>Grant ownership of the school (only one owner at a time)</span>
            </label>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/10 p-3 text-[12px] text-[color:var(--brand-crimson)]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
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
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {pending ? "Creating…" : "Create invite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
