import Link from "next/link";

import { RielIcon } from "@/components/brand/logo";
import { BetaBadge } from "@/components/brand/beta-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Leagues", href: "#leagues" },
  { label: "Games", href: "#games" },
  { label: "Schools", href: "#schools" },
  { label: "About", href: "#about" },
  { label: "Resources", href: "#resources" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="RIEL.GG home">
          <RielIcon size={40} />
          <BetaBadge />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle variant="subtle" />
          {process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "true" ? (
            <Link
              href="/dev"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "hidden border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/8 text-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold)]/15 sm:inline-flex",
              )}
            >
              Try a demo account
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
            >
              Log in
            </Link>
          )}
          <Link
            href="/join"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] glow-crimson-sm",
            )}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
