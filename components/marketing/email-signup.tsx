"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Marketing newsletter signup. Optimistic UI: shows the success state
 * immediately on submit. Wire to a real provider (Resend / Mailchimp) when
 * we're ready — for now the form is purely visual.
 */
export function EmailSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    // TODO: POST to /api/marketing/subscribe when the endpoint lands
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Stay in the loop
      </p>
      {submitted ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            You&apos;re on the list. We&apos;ll send the next monthly recap to{" "}
            <span className="font-mono text-foreground">{email}</span>.
          </span>
        </div>
      ) : (
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-3">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@yourschool.edu"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <button
            type="submit"
            disabled={!email.trim()}
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[color:var(--brand-crimson)] text-white hover:bg-[color:var(--brand-crimson-deep)] disabled:opacity-50",
            )}
          >
            Subscribe
            <ArrowRight className="ml-1 h-3 w-3" />
          </button>
        </form>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        We send a monthly recap. No spam, ever.
      </p>
    </div>
  );
}
