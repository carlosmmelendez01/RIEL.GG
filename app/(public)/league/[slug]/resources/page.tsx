/**
 * Public league resources.
 *
 * Only resources published for "Everyone" are shown here. Coach-only notes
 * remain inside the signed-in dashboard.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";

import { ArcLightLockup } from "@/components/brand/logo";
import { ResourceList } from "@/components/league/resource-list";
import { buttonVariants } from "@/components/ui/button";
import { loadPublicLeagueResources } from "@/lib/league/resources";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicLeagueResources(slug);
  if (!data) return { title: "Resources · ArcLight" };
  return {
    title: `${data.league.name} Resources · ArcLight`,
    description: `Rules and resources for ${data.league.name}.`,
  };
}

export default async function PublicLeagueResourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadPublicLeagueResources(slug);
  if (!data) notFound();

  const { league, resources } = data;

  return (
    <div className="bg-system min-h-screen">
      <PublicHeader />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <Link
          href={`/league/${league.slug}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {league.name}
        </Link>

        <section className="rounded-2xl border border-border/60 bg-card/60 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-crimson)]">
                <FileText className="h-3 w-3" />
                League resources
              </p>
              <h1 className="mt-2 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
                {league.name} rules & resources
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Public league handbooks, game rules, lobby setup notes, and match-day
                procedures. Signed-in coaches may see additional coach-only notes in their dashboard.
              </p>
            </div>
            <Link
              href="/join"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
              )}
            >
              Apply your school
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <ResourceList resources={resources} />
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="ArcLight home">
          <ArcLightLockup height={28} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/join"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)]",
            )}
          >
            Apply your school
          </Link>
        </div>
      </div>
    </header>
  );
}
