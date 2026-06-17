/**
 * Beta access gate helpers.
 *
 * A soft, shared-password barrier in front of the whole deployed beta so the
 * URL stays private. This is NOT authentication — Supabase auth is still the
 * real boundary for who-can-do-what. It just keeps random visitors out of
 * the beta entirely.
 *
 * Shared between the edge proxy (gate check) and the Node submit route
 * (cookie set), so it must be runtime-agnostic — no Node-only APIs.
 */

export const BETA_COOKIE = "riel_beta_access";

// Shared beta access should expire periodically so leaked cookies do not last
// for an entire season.
export const BETA_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Deterministic SHA-256 token derived from the password. We store this in the
 * cookie instead of the raw password so the shared secret never sits verbatim
 * in a cookie. Web Crypto works in both Edge and Node runtimes.
 */
export async function betaToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
