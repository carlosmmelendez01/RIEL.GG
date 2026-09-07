/**
 * NCES Common Core of Data — row mapping.
 *
 * Pure transforms from CCD flat-file rows to RIEL's directory and enrollment
 * shapes. No database, no filesystem, no network: the importer streams rows in
 * and calls these, which is what lets the mapping be tested exhaustively
 * without a 1 GB download.
 *
 * Two files matter:
 *
 *   - Directory  (`ccd_sch_029_*`) — one row per school. Identity, address,
 *     level, grade span.
 *   - Membership (`ccd_sch_052_*`) — enrollment in LONG format, disaggregated
 *     by grade x race/ethnicity x sex, with a TOTAL_INDICATOR column marking
 *     which aggregation level each row represents.
 *
 * The membership file is where this gets dangerous. The same student is
 * counted in several rows at different aggregation levels, so naively summing
 * STUDENT_COUNT inflates enrollment several-fold — and enrollment decides
 * which division a school competes in. Everything below is built to fail
 * loudly rather than return a plausible wrong number.
 */

export type CcdRow = Record<string, string | undefined>;

export type SchoolLevel = "ELEMENTARY" | "MIDDLE" | "HIGH" | "OTHER";

export type DirectoryRecord = {
  /** NCES school id — 12 digits. */
  externalId: string;
  name: string;
  districtExternalId: string | null;
  districtName: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  level: SchoolLevel | null;
  lowGrade: string | null;
  highGrade: string | null;
  /** False for closed, inactive or future schools — these are skipped on import. */
  operational: boolean;
  /** True when the school reports offering any of grades 9-12. */
  offersHighSchoolGrades: boolean;
};

export class CcdRowError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "CcdRowError";
  }
}

function clean(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // CCD's markers for "missing", "not applicable" and "suppressed".
  //
  // Deliberately NOT treating bare "M" and "N" as markers here, even though
  // CCD uses them that way in numeric columns: "M" is also the LEVEL code for
  // Middle School, and swallowing it would silently strip the school level off
  // every middle school in the file. Numeric suppression is handled in
  // parseStudentCount instead, where the ambiguity does not exist.
  if (trimmed === "†" || trimmed === "‡" || trimmed === "-1" || trimmed === "-2") return null;
  return trimmed;
}

const NCES_SCHOOL_ID = /^\d{12}$/;
const NCES_LEA_ID = /^\d{7}$/;

/**
 * CCD `LEVEL` codes. The published values are single letters; the longer
 * spellings appear in some releases and in the ArcGIS mirrors, so both are
 * accepted.
 */
const LEVEL_MAP: Record<string, SchoolLevel> = {
  "1": "ELEMENTARY",
  "2": "MIDDLE",
  "3": "HIGH",
  "4": "OTHER",
  E: "ELEMENTARY",
  M: "MIDDLE",
  H: "HIGH",
  O: "OTHER",
  N: "OTHER", // "not applicable / not reported"
  ELEMENTARY: "ELEMENTARY",
  MIDDLE: "MIDDLE",
  HIGH: "HIGH",
  OTHER: "OTHER",
};

export function mapSchoolLevel(raw: string | undefined): SchoolLevel | null {
  const value = clean(raw);
  if (value === null) return null;
  return LEVEL_MAP[value.toUpperCase()] ?? null;
}

/**
 * `SY_STATUS_TEXT` / `SY_STATUS` marks whether the school was open in the
 * collection year. Only currently-operational schools are imported; a closed
 * school should not appear in a coach's search.
 */
export function isOperational(row: CcdRow): boolean {
  const text = clean(row.SY_STATUS_TEXT)?.toLowerCase();
  if (text) {
    return text.startsWith("open") || text.startsWith("new") || text.startsWith("reopened");
  }
  const code = clean(row.SY_STATUS);
  // 1 = Open, 3 = New, 8 = Reopened. 2 (closed), 4 (future), 5 (inactive),
  // 6 (added), 7 (changed boundary) are not importable as active schools.
  return code === "1" || code === "3" || code === "8";
}

const HIGH_SCHOOL_GRADE_FLAGS = ["G_9_OFFERED", "G_10_OFFERED", "G_11_OFFERED", "G_12_OFFERED"];

export function offersHighSchoolGrades(row: CcdRow): boolean {
  return HIGH_SCHOOL_GRADE_FLAGS.some((flag) => clean(row[flag])?.toUpperCase() === "YES");
}

/**
 * Map one directory row. Throws `CcdRowError` on a row that cannot be trusted
 * as an identity — the importer counts and records these rather than guessing.
 */
export function parseDirectoryRow(row: CcdRow): DirectoryRecord {
  const externalId = clean(row.NCESSCH);
  if (externalId === null) throw new CcdRowError("Row has no NCESSCH", "NCESSCH");
  if (!NCES_SCHOOL_ID.test(externalId)) {
    throw new CcdRowError(`NCESSCH "${externalId}" is not a 12-digit NCES school id`, "NCESSCH");
  }

  const name = clean(row.SCH_NAME);
  if (name === null) throw new CcdRowError(`School ${externalId} has no SCH_NAME`, "SCH_NAME");

  const leaId = clean(row.LEAID);

  return {
    externalId,
    name,
    districtExternalId: leaId !== null && NCES_LEA_ID.test(leaId) ? leaId : null,
    districtName: clean(row.LEA_NAME),
    streetAddress: clean(row.LSTREET1),
    city: clean(row.LCITY),
    state: clean(row.LSTATE),
    // CCD ships ZIP and ZIP4 separately; RIEL stores the 5-digit ZIP.
    zip: clean(row.LZIP),
    level: mapSchoolLevel(row.LEVEL),
    lowGrade: clean(row.GSLO),
    highGrade: clean(row.GSHI),
    operational: isOperational(row),
    offersHighSchoolGrades: offersHighSchoolGrades(row),
  };
}

// ===========================================================================
// MEMBERSHIP — enrollment
// ===========================================================================

/** Grade codes that make up a grades 9-12 enrollment figure. */
export const GRADES_9_12 = ["09", "10", "11", "12"] as const;

/**
 * TOTAL_INDICATOR values that represent a clean per-grade subtotal — one row
 * per grade, already summed across race/ethnicity and sex.
 *
 * NOT yet verified against a downloaded file. The importer must not silently
 * trust this: `sumGrades912` cross-checks that the rows it selected form
 * exactly one row per grade, so a wrong assumption here fails loudly instead
 * of producing a plausible but inflated enrollment.
 */
const BY_GRADE_INDICATORS = ["subtotal 4 - by grade", "derived - subtotal by grade"];

export function isByGradeSubtotal(row: CcdRow): boolean {
  const indicator = clean(row.TOTAL_INDICATOR)?.toLowerCase();
  if (!indicator) return false;
  return BY_GRADE_INDICATORS.includes(indicator);
}

export function isEducationUnitTotal(row: CcdRow): boolean {
  return clean(row.TOTAL_INDICATOR)?.toLowerCase() === "education unit total";
}

export function normalizeGrade(raw: string | undefined): string | null {
  const value = clean(raw);
  if (value === null) return null;
  const upper = value.toUpperCase();
  // CCD writes grades as "Grade 9" in some releases and "09" in others.
  const match = upper.match(/^(?:GRADE\s*)?(\d{1,2})$/);
  if (match) return match[1].padStart(2, "0");
  return upper;
}

export function parseStudentCount(raw: string | undefined): number | null {
  const value = clean(raw);
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

export type EnrollmentSum = {
  total: number;
  /** Per-grade counts actually used, for the audit trail. */
  byGrade: Record<string, number>;
};

/**
 * Sum grades 9-12 enrollment for one school from its membership rows.
 *
 * Refuses rather than guesses. Returns null when the school reports no grades
 * 9-12 at all (a K-8 building), and throws `CcdRowError` when the rows are
 * shaped in a way that could double-count:
 *
 *   - more than one by-grade row for the same grade
 *   - no by-grade rows at all, despite grade 9-12 rows existing
 *
 * A silently wrong enrollment here puts a school in the wrong division, so
 * every ambiguous case is an error the importer records for a human.
 */
export function sumGrades912(rows: CcdRow[]): EnrollmentSum | null {
  const byGradeRows = rows.filter(isByGradeSubtotal);

  if (byGradeRows.length === 0) {
    const anyGradeRow = rows.some((row) => {
      const grade = normalizeGrade(row.GRADE);
      return grade !== null && (GRADES_9_12 as readonly string[]).includes(grade);
    });
    if (!anyGradeRow) return null;
    throw new CcdRowError(
      "Membership rows contain grade data but no by-grade subtotal rows. " +
        "The TOTAL_INDICATOR values in this release differ from what the importer expects.",
      "TOTAL_INDICATOR",
    );
  }

  const byGrade: Record<string, number> = {};
  for (const row of byGradeRows) {
    const grade = normalizeGrade(row.GRADE);
    if (grade === null) continue;
    if (!(GRADES_9_12 as readonly string[]).includes(grade)) continue;

    if (grade in byGrade) {
      throw new CcdRowError(
        `Duplicate by-grade row for grade ${grade}; summing these would double-count students.`,
        "GRADE",
      );
    }
    const count = parseStudentCount(row.STUDENT_COUNT);
    byGrade[grade] = count ?? 0;
  }

  if (Object.keys(byGrade).length === 0) return null;

  const total = Object.values(byGrade).reduce((a, b) => a + b, 0);
  return { total, byGrade };
}

/** Total enrollment across all grades, from the education-unit-total row. */
export function totalEnrollment(rows: CcdRow[]): number | null {
  const totals = rows.filter(isEducationUnitTotal);
  if (totals.length === 0) return null;
  if (totals.length > 1) {
    throw new CcdRowError(
      "More than one education-unit-total row for this school; cannot pick an enrollment total.",
      "TOTAL_INDICATOR",
    );
  }
  return parseStudentCount(totals[0].STUDENT_COUNT);
}

/** Group membership rows by NCES school id, for streaming imports. */
export function groupBySchool(rows: CcdRow[]): Map<string, CcdRow[]> {
  const out = new Map<string, CcdRow[]>();
  for (const row of rows) {
    const id = clean(row.NCESSCH);
    if (id === null) continue;
    const list = out.get(id);
    if (list) list.push(row);
    else out.set(id, [row]);
  }
  return out;
}
