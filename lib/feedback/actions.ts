"use server";

/**
 * In-app feedback / "get help" submission.
 *
 * Persists a Feedback row and (if Resend + FEEDBACK_EMAIL are configured)
 * emails it to the team. Non-blocking on the email — the DB row is the
 * source of truth. Returns a short human-friendly reference id.
 */

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

const SubmitFeedbackInput = z.object({
  message: z.string().min(5, "Tell us a little more (5+ chars).").max(4000),
  route: z.string().max(512).optional(),
  errorDigest: z.string().max(128).optional(),
});

export type SubmitFeedbackResult =
  | { ok: true; referenceId: string }
  | { ok: false; error: string };

export async function submitFeedback(input: {
  message: string;
  route?: string;
  errorDigest?: string;
}): Promise<SubmitFeedbackResult> {
  const parsed = SubmitFeedbackInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback." };
  }
  const { message, route, errorDigest } = parsed.data;

  // Feedback is allowed without a session in theory, but the launcher only
  // mounts in authed layouts — so we usually have a user to attribute it to.
  const user = await getCurrentUser();

  const row = await prisma.feedback.create({
    data: {
      message: message.trim(),
      route: route ?? null,
      errorDigest: errorDigest ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    },
    select: { id: true },
  });

  const referenceId = `RIEL-${row.id.slice(-6).toUpperCase()}`;

  // Best-effort email — never blocks or fails the submission.
  if (env.FEEDBACK_EMAIL) {
    await sendEmail({
      to: env.FEEDBACK_EMAIL,
      subject: `[Beta feedback] ${referenceId}${route ? ` · ${route}` : ""}`,
      // Plain React node — the layout components expect richer content, but
      // this is an internal notice so a simple block is fine.
      react: null,
      text: [
        `New beta feedback (${referenceId})`,
        ``,
        `From: ${user?.fullName ?? "Unknown"} <${user?.email ?? "no email"}>`,
        `Route: ${route ?? "—"}`,
        errorDigest ? `Error digest: ${errorDigest}` : null,
        ``,
        message.trim(),
      ]
        .filter((l) => l !== null)
        .join("\n"),
      tags: [{ name: "kind", value: "beta_feedback" }],
    });
  }

  return { ok: true, referenceId };
}
