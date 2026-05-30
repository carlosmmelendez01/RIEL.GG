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

// 90 days — long enough that a demo viewer enters the password once.
export const BETA_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Deterministic non-cryptographic token (FNV-1a, 32-bit) derived from the
 * password. We store this in the cookie instead of the raw password so the
 * shared secret never sits verbatim in a cookie. Synchronous + dependency-
 * free so it runs identically in edge + node runtimes.
 */
export function betaToken(password: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
