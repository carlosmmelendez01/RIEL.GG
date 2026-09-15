import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import Papa from "papaparse";
import unzipper, { type Entry } from "unzipper";

import {
  CcdRowError,
  parseDirectoryRow,
  sumGrades912,
  totalEnrollment,
  type CcdRow,
  type DirectoryRecord,
} from "../domain/nces-ccd";

export const NCES_CCD_FILE_API_URL = "https://nces.ed.gov/ccd/datatables/api/File/2/0/0/0/0/0";

export type CcdFileComponent = "Directory" | "Membership";

export type CcdImportFile = {
  component: CcdFileComponent;
  schoolYear: string;
  schoolYearKey: string;
  title: string;
  version: string | null;
  fileURL: string;
  fileName: string;
  datasetRelease: string;
  versionOrder: number;
  order: number;
};

export type CcdRelease = {
  schoolYear: string;
  schoolYearKey: string;
  release: string;
  sourceUrl: string;
  directory: CcdImportFile;
  membership: CcdImportFile;
};

export type CsvRowContext = {
  entryPath: string;
  rowNumber: number;
};

export interface CcdRowReader {
  streamRows(file: CcdImportFile, onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>): Promise<void>;
}

export type ImportRunInput = {
  release: string;
  sourceUrl: string;
};

export type ImportRunCompletion = {
  schoolsSeen: number;
  schoolsCreated: number;
  schoolsUpdated: number;
  enrollmentRows: number;
  errorCount: number;
  errors: NcesImportRowError[];
};

export type SchoolUpsertResult = {
  id: string;
  created: boolean;
  updated: boolean;
};

export type EnrollmentScopeForImport = "GRADES_9_12" | "TOTAL";

export type EnrollmentUpsertInput = {
  schoolId: string;
  schoolYear: string;
  enrollment: number;
  scope: EnrollmentScopeForImport;
  datasetRelease: string;
  importedAt: Date;
  notes: string | null;
};

export interface NcesImportStore {
  hasCompletedImport(release: string): Promise<boolean>;
  createImportRun(input: ImportRunInput): Promise<{ id: string }>;
  completeImportRun(id: string, completion: ImportRunCompletion): Promise<void>;
  failImportRun(id: string, completion: ImportRunCompletion): Promise<void>;
  upsertSchool(input: {
    record: DirectoryRecord;
    datasetRelease: string;
    importedAt: Date;
  }): Promise<SchoolUpsertResult>;
  findCcdSchoolByExternalId(externalId: string): Promise<{ id: string } | null>;
  upsertEnrollment(input: EnrollmentUpsertInput): Promise<{ created: boolean; updated: boolean }>;
}

export type NcesImportRowError = {
  phase: "directory" | "membership";
  message: string;
  field?: string;
  externalId?: string;
  rowNumber?: number;
};

export type NcesImportResult = ImportRunCompletion & {
  status: "completed" | "skipped";
  release: CcdRelease;
  importId: string;
};

export type ImportNcesCcdOptions = {
  release?: CcdRelease;
  store: NcesImportStore;
  rowReader: CcdRowReader;
  now?: () => Date;
  force?: boolean;
  maxStoredErrors?: number;
  fetchJson?: (url: string) => Promise<unknown>;
};

type ApiFile = {
  level?: unknown;
  elementType?: unknown;
  component?: unknown;
  schoolYear?: unknown;
  title?: unknown;
  version?: unknown;
  fileURL?: unknown;
  versionOrder?: unknown;
  order?: unknown;
};

type CcdApiFile = ApiFile & {
  component: CcdFileComponent;
  fileURL: string;
  schoolYear: string;
  title: string;
};

export async function discoverLatestCompleteCcdRelease(
  apiUrl = NCES_CCD_FILE_API_URL,
  fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
): Promise<CcdRelease> {
  return discoverLatestCompleteCcdReleaseFromResponse(await fetchJson(apiUrl));
}

export function discoverLatestCompleteCcdReleaseFromResponse(response: unknown): CcdRelease {
  const files = flattenApiFiles(response)
    .filter(isCcdApiFile)
    .map(toImportFile)
    .sort(compareImportFiles);

  const byYear = new Map<string, Partial<Record<CcdFileComponent, CcdImportFile>>>();
  for (const file of files) {
    const group = byYear.get(file.schoolYear) ?? {};
    group[file.component] ??= file;
    byYear.set(file.schoolYear, group);
  }

  const complete = [...byYear.values()]
    .filter((group): group is Record<CcdFileComponent, CcdImportFile> => Boolean(group.Directory && group.Membership))
    .sort((a, b) => compareSchoolYears(b.Directory.schoolYear, a.Directory.schoolYear))[0];

  if (!complete) {
    throw new Error("NCES CCD file API did not return a school-level release with both Directory and Membership data files.");
  }

  const directory = complete.Directory;
  const membership = complete.Membership;
  return {
    schoolYear: directory.schoolYear,
    schoolYearKey: directory.schoolYearKey,
    release: `CCD ${directory.schoolYearKey} directory ${directory.fileName}; membership ${membership.fileName}`,
    sourceUrl: `directory=${directory.fileURL}\nmembership=${membership.fileURL}`,
    directory,
    membership,
  };
}

export async function importNcesCcd(options: ImportNcesCcdOptions): Promise<NcesImportResult> {
  const release =
    options.release ??
    (await discoverLatestCompleteCcdRelease(NCES_CCD_FILE_API_URL, options.fetchJson ?? defaultFetchJson));
  const now = options.now ?? (() => new Date());
  const maxStoredErrors = options.maxStoredErrors ?? 100;
  const errors: NcesImportRowError[] = [];
  let errorCount = 0;
  const completion: ImportRunCompletion = {
    schoolsSeen: 0,
    schoolsCreated: 0,
    schoolsUpdated: 0,
    enrollmentRows: 0,
    errorCount: 0,
    errors,
  };

  const importRun = await options.store.createImportRun({
    release: release.release,
    sourceUrl: release.sourceUrl,
  });

  const recordError = (error: NcesImportRowError) => {
    errorCount += 1;
    completion.errorCount = errorCount;
    if (errors.length < maxStoredErrors) errors.push(error);
  };

  if (!options.force && (await options.store.hasCompletedImport(release.release))) {
    await options.store.completeImportRun(importRun.id, completion);
    return { status: "skipped", release, importId: importRun.id, ...completion };
  }

  try {
    const importedAt = now();
    await importDirectoryRows({
      file: release.directory,
      importedAt,
      store: options.store,
      rowReader: options.rowReader,
      completion,
      recordError,
    });
    await importMembershipRows({
      file: release.membership,
      importedAt,
      schoolYear: release.schoolYearKey,
      store: options.store,
      rowReader: options.rowReader,
      completion,
      recordError,
    });
    await options.store.completeImportRun(importRun.id, completion);
    return { status: "completed", release, importId: importRun.id, ...completion };
  } catch (error) {
    recordError({ phase: "membership", message: error instanceof Error ? error.message : String(error) });
    await options.store.failImportRun(importRun.id, completion);
    throw error;
  }
}

export class ZipCsvCcdRowReader implements CcdRowReader {
  async streamRows(file: CcdImportFile, onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>): Promise<void> {
    const response = await fetch(file.fileURL);
    if (!response.ok) {
      throw new Error(`Failed to download ${file.fileURL}: ${response.status} ${response.statusText}`);
    }
    if (!response.body) throw new Error(`Download response for ${file.fileURL} did not include a body.`);

    const zip = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>).pipe(
      unzipper.Parse({ forceStream: true }),
    );
    let matched = false;

    for await (const entry of zip as AsyncIterable<Entry>) {
      if (!matched && entry.type === "File" && isCsvEntry(entry.path)) {
        matched = true;
        await parseCsvEntry(entry, onRow);
      } else {
        entry.autodrain();
      }
    }

    if (!matched) {
      throw new Error(`No CSV/TXT flat-file entry found in ${file.fileURL}.`);
    }
  }
}

async function importDirectoryRows(input: {
  file: CcdImportFile;
  importedAt: Date;
  store: NcesImportStore;
  rowReader: CcdRowReader;
  completion: ImportRunCompletion;
  recordError: (error: NcesImportRowError) => void;
}) {
  await input.rowReader.streamRows(input.file, async (row, context) => {
    if (!isIndianaRow(row)) return;
    input.completion.schoolsSeen += 1;

    try {
      const record = parseDirectoryRow(row);
      if (!record.operational) return;

      const result = await input.store.upsertSchool({
        record,
        datasetRelease: input.file.datasetRelease,
        importedAt: input.importedAt,
      });
      if (result.created) input.completion.schoolsCreated += 1;
      else if (result.updated) input.completion.schoolsUpdated += 1;
    } catch (error) {
      input.recordError(toRowError("directory", error, row, context));
    }
  });
}

async function importMembershipRows(input: {
  file: CcdImportFile;
  importedAt: Date;
  schoolYear: string;
  store: NcesImportStore;
  rowReader: CcdRowReader;
  completion: ImportRunCompletion;
  recordError: (error: NcesImportRowError) => void;
}) {
  let currentExternalId: string | null = null;
  let currentRows: CcdRow[] = [];
  const completedExternalIds = new Set<string>();
  const outOfOrderExternalIds = new Set<string>();

  const flush = async () => {
    if (currentExternalId === null) return;
    completedExternalIds.add(currentExternalId);
    await importMembershipForSchool({
      externalId: currentExternalId,
      rows: currentRows,
      file: input.file,
      importedAt: input.importedAt,
      schoolYear: input.schoolYear,
      store: input.store,
      completion: input.completion,
      recordError: input.recordError,
    });
    currentExternalId = null;
    currentRows = [];
  };

  await input.rowReader.streamRows(input.file, async (row, context) => {
    if (!isIndianaRow(row)) return;

    const externalId = cleanCell(row.NCESSCH);
    if (externalId === null) {
      input.recordError({
        phase: "membership",
        message: "Membership row has no NCESSCH",
        field: "NCESSCH",
        rowNumber: context.rowNumber,
      });
      return;
    }

    if (outOfOrderExternalIds.has(externalId)) return;

    if (currentExternalId !== null && currentExternalId !== externalId) {
      await flush();
    }

    if (completedExternalIds.has(externalId)) {
      outOfOrderExternalIds.add(externalId);
      input.recordError({
        phase: "membership",
        externalId,
        rowNumber: context.rowNumber,
        message: "Membership rows for this school are not contiguous; refusing to aggregate a partial group.",
      });
      return;
    }

    currentExternalId = externalId;
    currentRows.push(row);
  });

  await flush();
}

async function importMembershipForSchool(input: {
  externalId: string;
  rows: CcdRow[];
  file: CcdImportFile;
  importedAt: Date;
  schoolYear: string;
  store: NcesImportStore;
  completion: ImportRunCompletion;
  recordError: (error: NcesImportRowError) => void;
}) {
  try {
    const school = await input.store.findCcdSchoolByExternalId(input.externalId);
    if (!school) {
      input.recordError({
        phase: "membership",
        externalId: input.externalId,
        message: "Membership rows could not be matched to a CCD school by NCES id.",
      });
      return;
    }

    const grades912 = sumGrades912(input.rows);
    if (grades912 !== null) {
      await input.store.upsertEnrollment({
        schoolId: school.id,
        schoolYear: input.schoolYear,
        enrollment: grades912.total,
        scope: "GRADES_9_12",
        datasetRelease: input.file.datasetRelease,
        importedAt: input.importedAt,
        notes: `By-grade counts: ${JSON.stringify(grades912.byGrade)}`,
      });
      input.completion.enrollmentRows += 1;
    }

    const total = totalEnrollment(input.rows);
    if (total !== null) {
      await input.store.upsertEnrollment({
        schoolId: school.id,
        schoolYear: input.schoolYear,
        enrollment: total,
        scope: "TOTAL",
        datasetRelease: input.file.datasetRelease,
        importedAt: input.importedAt,
        notes: null,
      });
      input.completion.enrollmentRows += 1;
    }
  } catch (error) {
    input.recordError(toRowError("membership", error, { NCESSCH: input.externalId }));
  }
}

async function parseCsvEntry(
  entry: Entry,
  onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>,
): Promise<void> {
  const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  entry.pipe(parser);
  let rowNumber = 1;
  for await (const row of parser as AsyncIterable<Record<string, unknown>>) {
    await onRow(normalizeCsvRow(row), { entryPath: entry.path, rowNumber });
    rowNumber += 1;
  }
}

function flattenApiFiles(value: unknown): ApiFile[] {
  if (Array.isArray(value)) return value.flatMap(flattenApiFiles);
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const here = typeof record.fileURL === "string" ? [record as ApiFile] : [];
  return [...here, ...Object.values(record).flatMap(flattenApiFiles)];
}

function isCcdApiFile(file: ApiFile): file is CcdApiFile {
  return (
    file.level === "School" &&
    file.elementType === "Data File" &&
    (file.component === "Directory" || file.component === "Membership") &&
    typeof file.fileURL === "string" &&
    typeof file.schoolYear === "string" &&
    typeof file.title === "string" &&
    isUsableZipUrl(file.fileURL)
  );
}

function toImportFile(file: CcdApiFile): CcdImportFile {
  const component = file.component;
  const schoolYearKey = normalizeSchoolYear(file.schoolYear);
  const version = typeof file.version === "string" ? file.version.trim() : null;
  const fileName = fileNameFromUrl(file.fileURL);
  return {
    component,
    schoolYear: file.schoolYear,
    schoolYearKey,
    title: file.title,
    version,
    fileURL: file.fileURL,
    fileName,
    datasetRelease: `CCD ${schoolYearKey} ${component.toLowerCase()} ${version ?? "unversioned"} ${fileName}`,
    versionOrder: numberOrMax(file.versionOrder),
    order: numberOrMax(file.order),
  };
}

function compareImportFiles(a: CcdImportFile, b: CcdImportFile): number {
  return (
    compareSchoolYears(b.schoolYear, a.schoolYear) ||
    a.versionOrder - b.versionOrder ||
    importablePreference(a.fileURL) - importablePreference(b.fileURL) ||
    a.order - b.order ||
    a.fileURL.localeCompare(b.fileURL)
  );
}

function compareSchoolYears(a: string, b: string): number {
  return schoolYearStart(a) - schoolYearStart(b);
}

function schoolYearStart(value: string): number {
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function normalizeSchoolYear(value: string): string {
  const years = [...value.matchAll(/\d{4}/g)].map((match) => Number(match[0]));
  if (years.length >= 2) return `${years[0]}-${String(years[1]).slice(-2)}`;
  if (years.length === 1) return String(years[0]);
  return value.replace(/\s+/g, " ").trim();
}

function importablePreference(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes("_csv")) return 0;
  if (lower.includes("_txt")) return 1;
  if (lower.includes("_sas")) return 9;
  if (lower.includes("sas7bdat")) return 9;
  return 2;
}

function fileNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").pop() || url;
  } catch {
    return url.split(/[?#]/)[0].split("/").pop() || url;
  }
}

function isUsableZipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith(".zip") && !lower.includes("_sas.zip") && !lower.includes("sas7bdat");
}

function isCsvEntry(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".txt");
}

function numberOrMax(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeCsvRow(row: Record<string, unknown>): CcdRow {
  const out: CcdRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/^\uFEFF/, "").trim()] = value === null || value === undefined ? undefined : String(value);
  }
  return out;
}

function isIndianaRow(row: CcdRow): boolean {
  const stateCandidates = [row.ST, row.LSTATE, row.MSTATE, row.STATE].map(cleanCell).filter(Boolean);
  if (stateCandidates.some((value) => value?.toUpperCase() === "IN")) return true;
  if (cleanCell(row.STATENAME)?.toUpperCase() === "INDIANA") return true;
  if (cleanCell(row.FIPST) === "18") return true;
  return cleanCell(row.NCESSCH)?.startsWith("18") ?? false;
}

function cleanCell(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toRowError(
  phase: NcesImportRowError["phase"],
  error: unknown,
  row: CcdRow,
  context?: Partial<CsvRowContext>,
): NcesImportRowError {
  return {
    phase,
    message: error instanceof Error ? error.message : String(error),
    field: error instanceof CcdRowError ? error.field : undefined,
    externalId: cleanCell(row.NCESSCH) ?? undefined,
    rowNumber: context?.rowNumber,
  };
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}
