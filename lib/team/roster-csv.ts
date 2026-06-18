import type { RosterCsvImportRow } from "@/lib/team/roster-actions";

export const ROSTER_CSV_MAX_ROWS = 50;
export const ROSTER_CSV_MAX_BYTES = 100 * 1024;
export const ROSTER_CSV_HEADERS = [
  "full_name",
  "email",
  "in_game_name",
  "role",
  "starter",
] as const;

const HEADER_ALIASES: Record<string, (typeof ROSTER_CSV_HEADERS)[number]> = {
  full_name: "full_name",
  fullname: "full_name",
  name: "full_name",
  player_name: "full_name",
  email: "email",
  email_address: "email",
  student_email: "email",
  in_game_name: "in_game_name",
  ingame_name: "in_game_name",
  ign: "in_game_name",
  gamertag: "in_game_name",
  game_tag: "in_game_name",
  role: "role",
  starter: "starter",
  is_starter: "starter",
};

export type RosterCsvClientError = {
  sourceRow: number | null;
  field: string;
  message: string;
};

export function normalizeRosterCsvHeader(header: string): string {
  const normalized = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return HEADER_ALIASES[normalized] ?? normalized;
}

export function prepareRosterCsvRows(
  fields: string[],
  rawRows: Record<string, string | undefined>[],
): { rows: RosterCsvImportRow[]; errors: RosterCsvClientError[] } {
  const errors: RosterCsvClientError[] = [];
  const fieldSet = new Set(fields);

  for (const required of ["full_name", "email"] as const) {
    if (!fieldSet.has(required)) {
      errors.push({
        sourceRow: null,
        field: required,
        message: `Missing required ${required} column. Keep the template header row unchanged.`,
      });
    }
  }

  if (rawRows.length === 0) {
    errors.push({ sourceRow: null, field: "file", message: "The CSV has no player rows." });
  }
  if (rawRows.length > ROSTER_CSV_MAX_ROWS) {
    errors.push({
      sourceRow: null,
      field: "file",
      message: `Import no more than ${ROSTER_CSV_MAX_ROWS} players at a time.`,
    });
  }

  const rows: RosterCsvImportRow[] = [];
  const emailRows = new Map<string, number>();

  for (const [index, raw] of rawRows.slice(0, ROSTER_CSV_MAX_ROWS).entries()) {
    const sourceRow = index + 2;
    const fullName = String(raw.full_name ?? "").trim();
    const email = String(raw.email ?? "").trim().toLowerCase();
    const inGameName = String(raw.in_game_name ?? "").trim();
    const roleValue = String(raw.role ?? "PLAYER").trim().toUpperCase() || "PLAYER";
    const starterValue = String(raw.starter ?? "yes").trim().toLowerCase();

    if (fullName.length < 2 || fullName.length > 120) {
      errors.push({
        sourceRow,
        field: "full_name",
        message: "Use the student's full name (2–120 characters).",
      });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ sourceRow, field: "email", message: "Use a valid email address." });
    }
    if (inGameName.length > 80) {
      errors.push({
        sourceRow,
        field: "in_game_name",
        message: "In-game names must be 80 characters or fewer.",
      });
    }
    if (roleValue !== "PLAYER" && roleValue !== "CAPTAIN") {
      errors.push({ sourceRow, field: "role", message: "Role must be PLAYER or CAPTAIN." });
    }

    const isStarter = parseStarter(starterValue);
    if (isStarter === null) {
      errors.push({
        sourceRow,
        field: "starter",
        message: "Starter must be yes or no.",
      });
    }

    if (email && emailRows.has(email)) {
      errors.push({
        sourceRow,
        field: "email",
        message: `Duplicate of row ${emailRows.get(email)}. Each email can appear once.`,
      });
    } else if (email) {
      emailRows.set(email, sourceRow);
    }

    if (
      fullName.length >= 2 &&
      fullName.length <= 120 &&
      email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      inGameName.length <= 80 &&
      (roleValue === "PLAYER" || roleValue === "CAPTAIN") &&
      isStarter !== null
    ) {
      rows.push({
        sourceRow,
        fullName,
        email,
        inGameName: inGameName || undefined,
        role: roleValue,
        isStarter,
      });
    }
  }

  return { rows, errors };
}

function parseStarter(value: string): boolean | null {
  if (["", "yes", "y", "true", "1", "starter"].includes(value)) return true;
  if (["no", "n", "false", "0", "sub", "substitute"].includes(value)) return false;
  return null;
}
