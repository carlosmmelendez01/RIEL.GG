import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import Papa from "papaparse";

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
  recalculateClassificationsForSchools?(schoolIds: string[]): Promise<void>;
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
  const schoolsWithEnrollment = new Set<string>();

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
      schoolsWithEnrollment,
    });
    if (schoolsWithEnrollment.size > 0) {
      await options.store.recalculateClassificationsForSchools?.([...schoolsWithEnrollment]);
    }
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
    const tempDir = await mkdtemp(join(tmpdir(), "riel-nces-"));
    try {
      const zipPath = join(tempDir, file.fileName);
      await downloadValidZipToFile(file, zipPath);
      await streamZipFileRows(zipPath, file, onRow);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

async function downloadValidZipToFile(file: CcdImportFile, zipPath: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await rm(zipPath, { force: true });
      await downloadZipToFile(file, zipPath);
      await validateCsvEntry(zipPath, file);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to download a valid ZIP for ${file.fileURL} after 3 attempts: ${message}`);
}

async function downloadZipToFile(file: CcdImportFile, zipPath: string): Promise<void> {
  await downloadUrlToFile(file.fileURL, zipPath);
}

async function downloadUrlToFile(url: string, zipPath: string, redirectCount = 0): Promise<void> {
  if (redirectCount > 3) throw new Error(`Too many redirects while downloading ${url}.`);

  await new Promise<void>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const get = parsedUrl.protocol === "http:" ? httpGet : httpsGet;
    const request = get(
      parsedUrl,
      {
        headers: {
          "accept-encoding": "identity",
          "user-agent": "RIEL NCES importer",
        },
      },
      (response) => {
        void (async () => {
          const status = response.statusCode ?? 0;
          if (status >= 300 && status < 400 && response.headers.location) {
            response.resume();
            await downloadUrlToFile(new URL(response.headers.location, parsedUrl).toString(), zipPath, redirectCount + 1);
            return;
          }

          if (status < 200 || status >= 300) {
            response.resume();
            throw new Error(`Failed to download ${url}: ${status} ${response.statusMessage ?? ""}`.trim());
          }

          const expectedLength = contentLengthHeader(response.headers["content-length"]);
          let bytesWritten = 0;
          const counter = new Transform({
            transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error: Error | null, data?: Buffer) => void) {
              bytesWritten += chunk.byteLength;
              callback(null, chunk);
            },
          });

          await pipeline(response, counter, createWriteStream(zipPath));

          if (expectedLength !== null && bytesWritten !== expectedLength) {
            throw new Error(`Downloaded ${bytesWritten} bytes from ${url}; expected ${expectedLength}.`);
          }
        })().then(resolve, reject);
      },
    );
    request.setTimeout(300_000, () => request.destroy(new Error(`Timed out downloading ${url}.`)));
    request.on("error", reject);
  });
}

function contentLengthHeader(value: number | string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const length = Number(raw);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

async function findCsvEntryPath(zipPath: string, file: CcdImportFile): Promise<string> {
  const output = await captureCommand("unzip", ["-Z1", zipPath]);
  const entryPath = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && isCsvEntry(entry));
  if (entryPath) return entryPath;
  throw new Error(`No CSV/TXT flat-file entry found in ${file.fileURL}.`);
}

async function validateCsvEntry(zipPath: string, file: CcdImportFile): Promise<void> {
  const entryPath = await findCsvEntryPath(zipPath, file);
  await runCommand("unzip", ["-t", zipPath, entryPath]);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamZipFileRows(
  zipPath: string,
  file: CcdImportFile,
  onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>,
): Promise<void> {
  const entryPath = await findCsvEntryPath(zipPath, file);
  await streamCommandStdout("unzip", ["-p", zipPath, entryPath], (stream) =>
    parseCcdCsvStream(entryPath, stream, onRow),
  );
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
  schoolsWithEnrollment: Set<string>;
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
      schoolsWithEnrollment: input.schoolsWithEnrollment,
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
  schoolsWithEnrollment: Set<string>;
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
      input.schoolsWithEnrollment.add(school.id);
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

/**
 * Parse a CCD CSV stream without Papa Parse's Node `header: true` mode.
 *
 * Papa Parse 5.5 resets duplicate-header tracking at Node stream chunk
 * boundaries. That mutates the first data row in each chunk, turning values
 * such as `Carmel` into `Carmel_1` and `IN` into `IN_2`. Reading the header
 * row ourselves keeps transport chunking from changing directory data.
 */
export async function parseCcdCsvStream(
  entryPath: string,
  stream: Readable,
  onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>,
): Promise<void> {
  const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: false,
    skipEmptyLines: true,
  });

  stream.on("error", (error) => parser.destroy(error));
  stream.pipe(parser);
  let headers: string[] | null = null;
  let rowNumber = 1;

  for await (const rawRow of parser as AsyncIterable<unknown>) {
    if (!Array.isArray(rawRow)) {
      throw new Error(`${entryPath} produced a non-array CSV row.`);
    }

    if (headers === null) {
      headers = normalizeCsvHeaders(rawRow, entryPath);
      continue;
    }
    if (rawRow.length !== headers.length) {
      throw new Error(
        `${entryPath} row ${rowNumber} has ${rawRow.length} columns; expected ${headers.length}.`,
      );
    }

    const row: CcdRow = {};
    for (const [index, header] of headers.entries()) {
      const value = rawRow[index];
      row[header] = value === null || value === undefined ? undefined : String(value);
    }
    await onRow(row, { entryPath, rowNumber });
    rowNumber += 1;
  }

  if (headers === null) throw new Error(`${entryPath} has no CSV header row.`);
}

async function captureCommand(command: string, args: string[]): Promise<string> {
  let stdout = "";
  await streamCommandStdout(command, args, async (stream) => {
    stream.setEncoding("utf8");
    for await (const chunk of stream) {
      stdout += chunk;
    }
  });
  return stdout;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await streamCommandStdout(command, args, async (stream) => {
    stream.resume();
    await new Promise<void>((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
    });
  });
}

async function streamCommandStdout(
  command: string,
  args: string[],
  consumeStdout: (stream: Readable) => Promise<void>,
): Promise<void> {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });

  const exitPromise = new Promise<void>((resolve, reject) => {
    child.on("error", (error) => reject(error));
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}: ${stderr.trim()}`));
    });
  });

  try {
    await consumeStdout(child.stdout);
    await exitPromise;
  } catch (error) {
    child.kill();
    throw error;
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

function normalizeCsvHeaders(rawHeaders: unknown[], entryPath: string): string[] {
  const headers = rawHeaders.map((value) =>
    String(value ?? "").replace(/^\uFEFF/, "").trim(),
  );
  const seen = new Set<string>();
  for (const header of headers) {
    if (!header) throw new Error(`${entryPath} contains a blank CSV header.`);
    if (seen.has(header)) {
      throw new Error(`${entryPath} contains the duplicate CSV header "${header}".`);
    }
    seen.add(header);
  }
  return headers;
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
