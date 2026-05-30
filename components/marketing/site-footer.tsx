import Link from "next/link";

import { RielLockup } from "@/components/brand/logo";
import { EmailSignup } from "@/components/marketing/email-signup";

const COL_PLATFORM = [
  { label: "Leagues", href: "#leagues" },
  { label: "Games", href: "#games" },
  { label: "Schools", href: "#schools" },
  { label: "Pricing", href: "#" },
  { label: "Changelog", href: "#" },
];

const COL_LEAGUE = [
  { label: "RIEL Esports League", href: "/league/riel" },
  { label: "Hoosier Esports Alliance", href: "/league/hea" },
  { label: "Esports Ohio", href: "/league/esports-ohio" },
  { label: "Michigan Collegiate", href: "/league/michigan-collegiate" },
  { label: "Prairie Conference", href: "/league/prairie" },
];

const COL_RESOURCES = [
  { label: "Help Center", href: "#" },
  { label: "Coach Playbook", href: "#" },
  { label: "Eligibility Rules", href: "#" },
  { label: "Brand Kit", href: "#" },
  { label: "Status", href: "#" },
];

const COL_COMPANY = [
  { label: "About", href: "#about" },
  { label: "Careers", href: "#" },
  { label: "Press", href: "#" },
  { label: "Contact", href: "mailto:hello@riel.gg" },
  { label: "Privacy", href: "/privacy" },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-background py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-crimson), var(--brand-purple), transparent)",
        }}
      />
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand + signup */}
          <div className="space-y-5 md:col-span-5">
            <RielLockup height={26} />
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              The home of scholastic esports. Built for schools, coaches, and players who want
              competitive gaming to mean something.
            </p>

            <EmailSignup />
          </div>

          {/* Link columns */}
          <FooterCol title="Platform" items={COL_PLATFORM} className="md:col-span-2" />
          <FooterCol title="Leagues" items={COL_LEAGUE} className="md:col-span-2" />
          <FooterCol title="Resources" items={COL_RESOURCES} className="md:col-span-2" id="resources" />
          <FooterCol title="Company" items={COL_COMPANY} className="md:col-span-1" />
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} RIEL.GG. The home of scholastic esports.</p>
          <div className="flex items-center gap-5">
            <a className="hover:text-foreground" href="/terms">
              Terms
            </a>
            <a className="hover:text-foreground" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-foreground" href="/security">
              Security
            </a>
            <a className="hover:text-foreground" href="/accessibility">
              Accessibility
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
  className,
  id,
}: {
  title: string;
  items: { label: string; href: string }[];
  className?: string;
  id?: string;
}) {
  return (
    <div className={className} id={id}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
