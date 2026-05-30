/**
 * Email sender — single entry point for every transactional email we send.
 *
 * Design rules:
 *   - Never throw. Mutations call this fire-and-forget after their tx
 *     commits; an email failure must not surface as a 500 on the caller.
 *   - Never block long. Resend's SDK is async-only and we await it inline,
 *     but each call is one HTTPS round-trip (~200ms). If we ever hit a
 *     scale where that matters we'll switch to a queue.
 *   - Falls back to `console.log` when `RESEND_API_KEY` is missing so dev
 *     environments keep working without anyone having to configure email.
 *   - Returns `{ ok: true, id }` or `{ ok: false, error }` for caller
 *     observability — callers can log the result without try/catch noise.
 */

import { Resend } from "resend";
import type { ReactNode } from "react";

// Lazy-construct the client so we don't crash at import time in builds
// without RESEND_API_KEY. Singleton across the module's lifetime.
let resend: Resend | null = null;
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export type SendEmailInput = {
  /** Recipient email. Pass an array for multiple recipients (max 50). */
  to: string | string[];
  subject: string;
  /** React Email component, rendered to HTML by Resend on the wire. */
  react: ReactNode;
  /** Plain-text fallback for clients that don't render HTML. Optional. */
  text?: string;
  /** Resend tags — show up in their dashboard for filtering. */
  tags?: { name: string; value: string }[];
  /** Reply-to override. Defaults to the from address. */
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string; provider: "resend" | "console" }
  | { ok: false; error: string };

const DEFAULT_FROM = "RIEL.GG <hello@riel.gg>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  const from = process.env.RESEND_FROM_ADDRESS || DEFAULT_FROM;

  // Console fallback — keeps every flow working without RESEND_API_KEY.
  if (!client) {
    const recipients = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    // eslint-disable-next-line no-console
    console.log(
      `[email] (console fallback — RESEND_API_KEY missing) to=${recipients} subject=${input.subject}`,
    );
    return { ok: true, id: "console-fallback", provider: "console" };
  }

  try {
    const res = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      react: input.react as React.ReactElement, // Resend's typings narrow here
      text: input.text,
      tags: input.tags,
      replyTo: input.replyTo,
    });
    if (res.error) {
      // Resend returns errors in the response rather than throwing, so we
      // funnel them through the same path as exceptions.
      // eslint-disable-next-line no-console
      console.warn(`[email] resend error: ${res.error.message}`);
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res.data?.id ?? "unknown", provider: "resend" };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[email] send threw: ${err instanceof Error ? err.message : String(err)}`);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed.",
    };
  }
}

/**
 * Build absolute URLs for links inside email templates. Falls back to
 * localhost in dev when NEXT_PUBLIC_APP_URL isn't set, so previews still
 * render reasonable links.
 */
export function emailUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${normalized}`;
}
