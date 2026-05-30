/**
 * Pure helpers for invite codes. Not a server action — safe to import from
 * any server-side action file.
 */

/**
 * URL-safe random invite code. 24 chars of base32 (~120 bits entropy) —
 * collisions astronomically unlikely. Avoids ambiguous characters
 * (0/O, 1/I/l) so an admin reading the code aloud to a coach doesn't
 * get tripped up.
 */
export function generateInviteCode(length = 24): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}
