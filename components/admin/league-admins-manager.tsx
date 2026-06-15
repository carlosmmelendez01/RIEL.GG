"use client";

/**
 * League staff manager (/admin/admins).
 *
 *   - Current admins list with role badges; owners can remove others.
 *   - "Invite admin" dialog (name / email / role, gated to grantable roles).
 *   - Outstanding league invites with copy / revoke.
 *
 * Authority is enforced server-side; we mirror it here so users don't see
 * actions they can't take.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  Clock,
  Copy,
  Crown,
  Link2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createLeagueInvite,
  removeLeagueAdmin,
  revokeLeagueInvite,
  type CreateLeagueInviteResult,
} from "@/lib/league-admin/admin-invite-actions";
import type {
  LeagueAdminRow,
  LeagueOutstandingInvite,
  LeagueRole,
} from "@/lib/league-admin/admins-data";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<LeagueRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
};

const ROLE_TONE: Record<LeagueRole, string> = {
  OWNER: "border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)]",
  ADMIN: "border-[color:var(--brand-purple)]/40 bg-[color:var(--brand-purple)]/10 text-[color:var(--brand-purple)]",
  STAFF: "border-border/60 bg-background/60 text-muted-foreground",
};

function grantableRoles(viewerRole: LeagueRole): LeagueRole[] {
  if (viewerRole === "OWNER") return ["OWNER", "ADMIN", "STAFF"];
  if (viewerRole === "ADMIN") return ["ADMIN", "STAFF"];
  return [];
}

export function LeagueAdminsManager({
  leagueName,
  viewerRole,
  admins,
  invites,
}: {
  leagueName: string;
  viewerRole: LeagueRole;
  admins: LeagueAdminRow[];
  invites: LeagueOutstandingInvite[];
}) {
  const [open, setOpen] = useState(false);
  const canInvite = grantableRoles(viewerRole).length > 0;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              People
            </p>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[color:var(--brand-crimson)]" />
              League staff
              <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {admins.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {admins.map((a) => (
              <AdminRow key={a.userId} admin={a} viewerRole={viewerRole} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Invitations
            </p>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-[color:var(--brand-crimson)]" />
              Outstanding invites
              <span className="ml-auto rounded-md border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {invites.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canInvite ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-crimson-deep)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Invite an admin
              </button>
            ) : (
              <p className="rounded-md border border-dashed border-border/60 bg-background/40 p-3 text-center text-[11px] text-muted-foreground">
                Staff can&apos;t invite admins. Ask an owner or admin.
              </p>
            )}

            {invites.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-4 text-center text-[12px] text-muted-foreground">
                No pending invites.
              </div>
            ) : (
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li key={inv.id}>
                    <InviteRow invite={inv} viewerRole={viewerRole} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {open ? (
        <CreateInviteDialog
          leagueName={leagueName}
          viewerRole={viewerRole}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

// --- Admin row ----------------------------------------------------------

function AdminRow({
  admin,
  viewerRole,
}: {
  admin: LeagueAdminRow;
  viewerRole: LeagueRole;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Owners can remove anyone but themselves (server also blocks last owner).
  const canRemove = viewerRole === "OWNER" && !admin.isYou;

  function handleRemove() {
    if (!confirm(`Remove ${admin.name} from the league staff?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await removeLeagueAdmin({ userId: admin.userId });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-card">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-semibold text-white">
          {admin.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {admin.name}
          {admin.isYou ? (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(you)</span>
          ) : null}
        </p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono text-[10px]">{admin.email}</span>
        </p>
        {error ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--brand-crimson)]">
            <CircleAlert className="h-3 w-3" />
            {error}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          ROLE_TONE[admin.role],
        )}
      >
        {admin.role === "OWNER" ? <Crown className="h-2.5 w-2.5" /> : null}
        {ROLE_LABEL[admin.role]}
      </span>
      {canRemove ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          title={`Remove ${admin.name}`}
          className="rounded-md border border-border/60 bg-card p-1.5 text-muted-foreground transition-colors hover:bg-[color:var(--brand-crimson)]/10 hover:text-[color:var(--brand-crimson)] disabled:opacity-50"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// --- Outstanding invite row --------------------------------------------

function InviteRow({
  invite,
  viewerRole,
}: {
  invite: LeagueOutstandingInvite;
  viewerRole: LeagueRole;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const absoluteUrl =
    typeof window !== "undefined" ? `${window.location.origin}${invite.url}` : invite.url;

  const canRevoke =
    viewerRole === "OWNER" || (viewerRole === "ADMIN" && invite.role !== "OWNER");

  function handleCopy() {
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const r = await revokeLeagueInvite({ inviteId: invite.id });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            ROLE_TONE[invite.role],
          )}
        >
          {invite.role === "OWNER" ? <Crown className="h-2.5 w-2.5" /> : null}
          {ROLE_LABEL[invite.role]}
        </span>
        {invite.intendedEmail ? (
          <span className="inline-flex items-center gap-1 truncate font-mono text-[11px]">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
            {invite.intendedEmail}
          </span>
        ) : null}
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
        {canRevoke ? (
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

      {error ? (
        <p className="flex items-start gap-1 text-[11px] text-[color:var(--brand-crimson)]">
          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : null}

      {invite.createdByName ? (
        <p className="text-[10px] text-muted-foreground">Issued by {invite.createdByName}</p>
      ) : null}
    </div>
  );
}

// --- Create invite dialog ----------------------------------------------

function CreateInviteDialog({
  leagueName,
  viewerRole,
  onClose,
}: {
  leagueName: string;
  viewerRole: LeagueRole;
  onClose: () => void;
}) {
  const router = useRouter();
  const roles = grantableRoles(viewerRole);
  const [role, setRole] = useState<LeagueRole>(roles.includes("ADMIN") ? "ADMIN" : roles[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [expiresDays, setExpiresDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{ url: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fullUrl = success
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${success.url}`
    : "";

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const r: CreateLeagueInviteResult = await createLeagueInvite({
        role,
        intendedEmail: email.trim(),
        inviteeName: name.trim() || undefined,
        expiresDays,
      });
      if (r.ok) {
        setSuccess({ url: r.url, email: r.intendedEmail });
        router.refresh();
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
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
              Invite an admin to {leagueName}
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

        {success ? (
          <div className="space-y-4 px-5 py-4">
            <p className="text-[13px] text-muted-foreground">
              Invite sent to <span className="font-mono text-foreground">{success.email}</span>.
              Share this link if email isn&apos;t configured yet — it expires in {expiresDays} days.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background p-1.5">
              <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
              <input
                readOnly
                value={fullUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 truncate bg-transparent font-mono text-[11px] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-background"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSuccess(null);
                  setName("");
                  setEmail("");
                }}
                className="rounded-md border border-border/60 px-3 py-2 text-[12px] font-medium hover:bg-background/40"
              >
                Invite another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-crimson)] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[color:var(--brand-crimson-deep)]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Name <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Rivera"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@league.org"
                  className={cn(
                    "h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40",
                    fieldErrors.intendedEmail ? "border-[color:var(--brand-crimson)]/60" : "border-input",
                  )}
                />
                {fieldErrors.intendedEmail ? (
                  <p className="mt-1 text-[11px] text-[color:var(--brand-crimson)]">
                    {fieldErrors.intendedEmail}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                {role === "OWNER"
                  ? "Owners have full control, including managing other admins."
                  : role === "ADMIN"
                    ? "Admins can run competitions, schedules, and schools."
                    : "Staff can help operate the league with limited authority."}
              </p>
            </div>

            <div className="w-40">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Expires in (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

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
                {pending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
