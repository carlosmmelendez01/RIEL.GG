import {
  Bell,
  Globe2,
  Lock,
  Mail,
  Palette,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PlatformTopbar } from "@/components/platform/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PlatformSettingsPage() {
  return (
    <>
      <PlatformTopbar
        title="Platform settings"
        eyebrow="Configuration that applies to RIEL.GG itself, not to individual leagues"
      />

      <main className="flex-1 px-6 py-6 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[200px_1fr]">
          {/* Section nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-20 space-y-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </a>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6">
            <GeneralSection />
            <BrandingSection />
            <EmailSection />
            <NotificationsSection />
            <SecuritySection />
            <ApiSection />
            <ComplianceSection />
            <DangerZoneSection />
          </div>
        </div>
      </main>
    </>
  );
}

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: Globe2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "email", label: "Email", icon: Mail },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "api", label: "API & webhooks", icon: Webhook },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "danger", label: "Danger zone", icon: Lock },
];

// --- Reusable settings primitives ---------------------------------------

function Section({
  id,
  title,
  description,
  icon: Icon,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Card
      id={id}
      className={cn(
        "scroll-mt-20 border-border/60 bg-card/80",
        tone === "danger" && "border-[color:var(--brand-crimson)]/30",
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "danger" ? "text-[color:var(--brand-crimson)]" : "text-muted-foreground",
            )}
          />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3 border-b border-border/40 py-3 last:border-0 last:pb-0 sm:grid-cols-[200px_1fr]">
      <div>
        <Label className="text-[13px] font-medium">{label}</Label>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={cn(
        "flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        enabled ? "bg-[color:var(--brand-crimson)]" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  enabled,
}: {
  label: string;
  hint: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Toggle enabled={enabled} />
    </div>
  );
}

// --- Sections ---------------------------------------------------------

function GeneralSection() {
  return (
    <Section
      id="general"
      title="General"
      description="Platform identity and core defaults."
      icon={Globe2}
    >
      <Field label="Platform name" hint="Shown in browser tabs and emails.">
        <Input defaultValue="RIEL.GG" />
      </Field>
      <Field label="Primary domain" hint="Tenant subdomains live under this root.">
        <Input defaultValue="riel.gg" className="font-mono" />
      </Field>
      <Field label="Support email" hint="Inbound destination for replies to system emails.">
        <Input defaultValue="support@riel.gg" type="email" />
      </Field>
      <Field label="Default trial length" hint="New leagues start on this trial unless overridden.">
        <div className="flex items-center gap-2">
          <Input defaultValue="14" type="number" className="max-w-[100px] tabular-nums" />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </Field>
      <Field label="Default time zone" hint="Used for league creation, scheduler defaults.">
        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
          <option>America/Indiana/Indianapolis (ET)</option>
          <option>America/New_York (ET)</option>
          <option>America/Chicago (CT)</option>
          <option>America/Denver (MT)</option>
          <option>America/Los_Angeles (PT)</option>
        </select>
      </Field>
      <SaveBar />
    </Section>
  );
}

function BrandingSection() {
  return (
    <Section
      id="branding"
      title="Branding"
      description="Default RIEL.GG identity. Tenant leagues override their own branding separately."
      icon={Palette}
    >
      <Field label="Primary color" hint="Used in CTAs, accent edges, and live indicators.">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5">
          <span
            className="h-7 w-7 shrink-0 rounded-md border border-border"
            style={{ background: "#A31F34" }}
          />
          <input defaultValue="#A31F34" className="h-7 flex-1 bg-transparent font-mono text-sm focus:outline-none" />
        </div>
      </Field>
      <Field label="Logo (light)" hint="PNG or SVG, transparent background, square.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Upload logo</button>
      </Field>
      <Field label="Logo (dark)" hint="Used on light surfaces. PNG or SVG.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Upload logo</button>
      </Field>
      <Field label="Favicon" hint="32×32 PNG.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Upload favicon</button>
      </Field>
      <Field label="Open Graph image" hint="1200×630 — used when riel.gg links are shared.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Upload image</button>
      </Field>
      <SaveBar />
    </Section>
  );
}

function EmailSection() {
  return (
    <Section
      id="email"
      title="Email"
      description="Outbound mail configuration and templates."
      icon={Mail}
    >
      <Field label="From name" hint='Appears as the sender, e.g. "RIEL.GG Notifications".'>
        <Input defaultValue="RIEL.GG" />
      </Field>
      <Field label="From address" hint="Outbound email is sent from this address.">
        <Input defaultValue="hello@riel.gg" type="email" />
      </Field>
      <Field label="Reply-to" hint="Where replies go (typically your support inbox).">
        <Input defaultValue="support@riel.gg" type="email" />
      </Field>
      <Field label="Provider" hint="Currently using Postmark.">
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[12px] text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          Postmark · Connected
        </span>
      </Field>
      <Field label="Templates" hint="Welcome, invite, league-onboarded, billing.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Manage 12 templates
        </button>
      </Field>
      <SaveBar />
    </Section>
  );
}

function NotificationsSection() {
  return (
    <Section
      id="notifications"
      title="Platform notifications"
      description="When RIEL.GG itself emails you (the platform team) about events across leagues."
      icon={Bell}
    >
      <ToggleRow label="New league created" hint="When a new tenant onboards." enabled />
      <ToggleRow label="Trial ending in 3 days" hint="Heads-up to convert before churn." enabled />
      <ToggleRow label="Match disputes raised" hint="When a coach escalates a dispute that needs platform staff." enabled />
      <ToggleRow label="Integration error" hint="When a connected integration starts failing." enabled />
      <ToggleRow label="Daily digest" hint="One email at 8am ET summarizing the prior day across the platform." enabled={false} />
      <ToggleRow label="High-volume alerts" hint="Throttle so we don't spam you in busy weeks." enabled />
      <SaveBar />
    </Section>
  );
}

function SecuritySection() {
  return (
    <Section
      id="security"
      title="Security"
      description="Auth and access controls for RIEL.GG staff (not tenant league users)."
      icon={Shield}
    >
      <ToggleRow label="Require SSO for staff" hint="All RIEL.GG members must sign in via Google Workspace." enabled />
      <ToggleRow label="Mandatory 2FA" hint="Hardware key or TOTP required after SSO." enabled />
      <ToggleRow label="Session timeout" hint="Auto-sign-out after 12h of inactivity." enabled />
      <Field label="IP allowlist" hint="Comma-separated CIDRs. Leave blank to allow all.">
        <Input defaultValue="" placeholder="73.146.0.0/16, 199.5.83.0/24" className="font-mono text-[12px]" />
      </Field>
      <Field label="Audit retention" hint="Keep audit events this long.">
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
          <option>1 year</option>
          <option>3 years</option>
          <option selected>7 years</option>
          <option>Forever</option>
        </select>
      </Field>
      <SaveBar />
    </Section>
  );
}

function ApiSection() {
  return (
    <Section
      id="api"
      title="API & webhooks"
      description="Programmatic access. Per-league API keys live under that league's settings."
      icon={Webhook}
    >
      <Field label="Public API" hint="Read-only for tenant leagues; gated on pro tier.">
        <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[12px] text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          Enabled
        </span>
      </Field>
      <Field label="Rate limit" hint="Per league, per minute.">
        <div className="flex items-center gap-2">
          <Input defaultValue="120" type="number" className="max-w-[100px] tabular-nums" />
          <span className="text-sm text-muted-foreground">requests / min</span>
        </div>
      </Field>
      <Field label="Webhook signing secret" hint="Outgoing webhooks are signed with HMAC-SHA256.">
        <div className="flex items-center gap-2">
          <Input
            defaultValue="whsec_••••••••••••••••••••••••YgJq"
            className="font-mono text-[12px]"
            readOnly
          />
          <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Rotate</button>
        </div>
      </Field>
      <Field label="Outgoing webhooks" hint="Endpoints we POST to when events happen.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Manage 4 webhooks
        </button>
      </Field>
      <SaveBar />
    </Section>
  );
}

function ComplianceSection() {
  return (
    <Section
      id="compliance"
      title="Compliance"
      description="Privacy and education-data posture for K-12 districts and collegiate IT."
      icon={ShieldCheck}
    >
      <Field label="Privacy policy URL">
        <Input defaultValue="https://riel.gg/privacy" type="url" className="font-mono text-[12px]" />
      </Field>
      <Field label="Terms of service URL">
        <Input defaultValue="https://riel.gg/terms" type="url" className="font-mono text-[12px]" />
      </Field>
      <Field label="DPA template" hint="Districts often request a Data Processing Addendum.">
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Download DPA template
        </button>
      </Field>
      <ToggleRow
        label="FERPA mode"
        hint="Stricter PII handling and audit retention for K-12 schools."
        enabled
      />
      <ToggleRow
        label="COPPA-friendly defaults"
        hint="Disable photo upload + restrict messaging by default for under-13 accounts."
        enabled
      />
      <ToggleRow
        label="SOC 2 mode"
        hint="Forces 2FA, IP logging, and tamper-evident audit on all staff."
        enabled
      />
      <SaveBar />
    </Section>
  );
}

function DangerZoneSection() {
  return (
    <Section
      id="danger"
      title="Danger zone"
      description="Irreversible operations. Triple-check before clicking anything here."
      icon={Lock}
      tone="danger"
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-3">
        <div>
          <p className="text-[13px] font-semibold">Suspend platform</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Read-only mode for all tenants. Public landing stays up.
          </p>
        </div>
        <button
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "border-[color:var(--brand-crimson)]/40 text-[color:var(--brand-crimson)] hover:bg-[color:var(--brand-crimson)]/10",
          )}
        >
          Suspend
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-3">
        <div>
          <p className="text-[13px] font-semibold">Rotate platform encryption keys</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Re-encrypts data at rest. Background job; takes ~20 minutes.
          </p>
        </div>
        <button
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "border-[color:var(--brand-crimson)]/40 text-[color:var(--brand-crimson)] hover:bg-[color:var(--brand-crimson)]/10",
          )}
        >
          Rotate
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/5 p-3">
        <div>
          <p className="text-[13px] font-semibold">Export everything</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Snapshot of all leagues, schools, matches. Encrypted ZIP delivered to your support email.
          </p>
        </div>
        <button
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "border-[color:var(--brand-crimson)]/40 text-[color:var(--brand-crimson)] hover:bg-[color:var(--brand-crimson)]/10",
          )}
        >
          Request export
        </button>
      </div>
    </Section>
  );
}

function SaveBar() {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
      <button className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Cancel</button>
      <button
        className={cn(
          buttonVariants({ size: "sm" }),
          "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
        )}
      >
        <Save className="mr-1.5 h-3 w-3" />
        Save changes
      </button>
    </div>
  );
}
