import { cn } from "@/lib/utils";

/**
 * Small "BETA" pill shown beside the logo across the app shells, so demo
 * viewers always know they're looking at a pre-release build.
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-[color:var(--brand-gold)]",
        className,
      )}
    >
      Beta
    </span>
  );
}
