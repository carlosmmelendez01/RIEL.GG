import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";

import { ArcLightLockup } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AgreementPageShell({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-system flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="ArcLight home">
            <ArcLightLockup />
          </Link>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}

export function AgreementAlreadyAccepted({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">{body}</p>
        <Link href={href} className={cn(buttonVariants({ size: "sm" }), "mt-2")}>
          {label}
        </Link>
      </CardContent>
    </Card>
  );
}

export function AgreementBlocked({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card className="border-[color:var(--brand-crimson)]/40 bg-[color:var(--brand-crimson)]/5">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--brand-crimson)]/30 bg-[color:var(--brand-crimson)]/10 text-[color:var(--brand-crimson)]">
          <CircleAlert className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
