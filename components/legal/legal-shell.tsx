import Link from "next/link";
import type { ReactNode } from "react";

import { RielLockup } from "@/components/brand/logo";

export function LegalShell({
  title,
  eyebrow,
  updated,
  children,
}: {
  title: string;
  eyebrow: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-system min-h-screen">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" aria-label="RIEL.GG home">
            <RielLockup height={28} />
          </Link>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-crimson)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-7 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
