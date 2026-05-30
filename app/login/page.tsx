"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleAlert, Loader2, Mail, Sparkles } from "lucide-react";

import { RielLockup } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "default" | "magic-link-sent" | "loading" | "error";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginShell() {
  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading sign-in…</p>
      </main>
    </div>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("default");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function signInWithProvider(provider: "google" | "azure") {
    setMode("loading");
    setErrorMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Microsoft / Google scopes for org accounts (school workspaces)
        scopes: provider === "azure" ? "email openid profile" : undefined,
      },
    });
    if (error) {
      setErrorMessage(humanizeProviderError(error.message, provider));
      setMode("error");
    }
    // On success the browser is redirected — nothing more to do here.
  }

  async function signInWithMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setMode("loading");
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setMode("error");
    } else {
      setMode("magic-link-sent");
    }
  }

  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center" aria-label="RIEL.GG home">
            <RielLockup />
          </Link>
          <Link href="/join" className="text-xs text-muted-foreground hover:text-foreground">
            New here? Apply your school
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {mode === "magic-link-sent" ? (
            <MagicLinkSent email={email} onBack={() => setMode("default")} />
          ) : (
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sign in
                </p>
                <CardTitle className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight">
                  Welcome back to RIEL.GG
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in with your school account, or get a magic link by email.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* SSO providers */}
                <div className="space-y-2">
                  <ProviderButton
                    label="Continue with Google"
                    sublabel="Schools using Google Workspace"
                    onClick={() => signInWithProvider("google")}
                    disabled={mode === "loading"}
                    icon={<GoogleIcon />}
                  />
                  <ProviderButton
                    label="Continue with Microsoft"
                    sublabel="Schools using Microsoft 365 / Entra"
                    onClick={() => signInWithProvider("azure")}
                    disabled={mode === "loading"}
                    icon={<MicrosoftIcon />}
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 py-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                {/* Magic link */}
                <form onSubmit={signInWithMagicLink} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      School email
                    </Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="cmelendez@riel.gg"
                        className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                        disabled={mode === "loading"}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      We&apos;ll email you a one-time link. No password to remember.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={mode === "loading" || !email.trim()}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "w-full bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50 glow-crimson-sm",
                    )}
                  >
                    {mode === "loading" ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending magic link…
                      </>
                    ) : (
                      <>
                        Send magic link
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {errorMessage ? (
                  <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-[12px] text-orange-700 dark:text-orange-400">
                    <p className="flex items-start gap-2">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </p>
                  </div>
                ) : null}

                <div className="rounded-md border border-[color:var(--brand-purple)]/30 bg-[color:var(--brand-purple)]/5 p-3 text-[11px] text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--brand-purple)]" />
                    <span>
                      <span className="font-medium text-foreground">First time signing in?</span>{" "}
                      We&apos;ll auto-link your account if your email matches a roster the league has
                      already onboarded.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            By signing in you agree to RIEL.GG&apos;s{" "}
            <a href="#" className="underline hover:text-foreground">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents -------------------------------------------------------

function ProviderButton({
  label,
  sublabel,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-border/80 hover:bg-card disabled:opacity-50"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card">{icon}</div>
      <div className="flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function MagicLinkSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <Card className="border-emerald-500/30 bg-card/80">
      <CardContent className="space-y-4 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-balance text-xl font-semibold tracking-tight">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a sign-in link to <span className="font-mono text-foreground">{email}</span>.
            Click it within 1 hour and you&apos;ll land on your dashboard.
          </p>
        </div>
        <button
          onClick={onBack}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}
        >
          Use a different email
        </button>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function humanizeProviderError(message: string, provider: "google" | "azure"): string {
  if (message.toLowerCase().includes("provider is not enabled")) {
    return `${provider === "azure" ? "Microsoft" : "Google"} sign-in isn't enabled yet on this Supabase project. Enable it in Supabase Dashboard → Authentication → Providers, then try again.`;
  }
  return message;
}

