import { describe, expect, it } from "vitest";

import {
  discoverLatestCompleteCcdReleaseFromResponse,
  importNcesCcd,
  type CcdImportFile,
  type CcdRelease,
  type CcdRowReader,
  type CsvRowContext,
  type EnrollmentUpsertInput,
  type ImportRunCompletion,
  type ImportRunInput,
  type NcesImportStore,
} from "./importer";
import type { CcdRow, DirectoryRecord } from "../domain/nces-ccd";

describe("NCES CCD release discovery", () => {
  it("chooses the newest school-level release with both directory and membership files", () => {
    const release = discoverLatestCompleteCcdReleaseFromResponse({
      selectionGroupModels: [
        fileApiRow("2025 - 2026", "Directory", "https://nces.ed.gov/ccd/data/zip/ccd_sch_029_2526_w_0a_050626.zip"),
        fileApiRow("2024 - 2025", "Directory", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_029_2425_w_1a_073025.zip"),
        fileApiRow("2024 - 2025", "Membership", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_052_2425_l_1a_073025.zip"),
        fileApiRow("2023 - 2024", "Directory", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_029_2324_w_1a_073124.zip"),
        fileApiRow("2023 - 2024", "Membership", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_052_2324_l_1a_073124.zip"),
      ],
    });

    expect(release.schoolYearKey).toBe("2024-25");
    expect(release.release).toBe(
      "CCD 2024-25 directory ccd_sch_029_2425_w_1a_073025.zip; membership ccd_sch_052_2425_l_1a_073025.zip",
    );
    expect(release.directory.fileURL).toBe("https://nces.ed.gov/ccd/Data/zip/ccd_sch_029_2425_w_1a_073025.zip");
    expect(release.membership.fileURL).toBe("https://nces.ed.gov/ccd/Data/zip/ccd_sch_052_2425_l_1a_073025.zip");
  });
});

describe("NCES CCD importer orchestration", () => {
  it("imports Indiana schools and writes both grades 9-12 and total enrollment rows", async () => {
    const release = testRelease();
    const reader = new FakeReader([
      [release.directory.fileURL, [directoryRow()]],
      [
        release.membership.fileURL,
        [
          gradeRow("09", "230"),
          gradeRow("10", "225"),
          gradeRow("11", "210"),
          gradeRow("12", "211"),
          totalRow("876"),
        ],
      ],
    ]);
    const store = new FakeStore();

    const result = await importNcesCcd({
      release,
      rowReader: reader,
      store,
      now: () => new Date("2026-09-15T00:00:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(result.schoolsSeen).toBe(1);
    expect(result.schoolsCreated).toBe(1);
    expect(result.enrollmentRows).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(store.enrollments.get("school-1:2024-25:NCES_CCD:GRADES_9_12")?.enrollment).toBe(876);
    expect(store.enrollments.get("school-1:2024-25:NCES_CCD:TOTAL")?.enrollment).toBe(876);
    expect(store.recalculatedSchoolIds).toEqual([["school-1"]]);
  });

  it("records a run but does no file work when the release already completed", async () => {
    const release = testRelease();
    const reader = new FakeReader([]);
    const store = new FakeStore();
    store.completedReleases.add(release.release);

    const result = await importNcesCcd({ release, rowReader: reader, store });

    expect(result.status).toBe("skipped");
    expect(reader.calls).toEqual([]);
    expect(store.schools.size).toBe(0);
    expect(store.importRuns).toHaveLength(1);
    expect(store.importRuns[0].status).toBe("COMPLETED");
  });

  it("counts row-level errors and still completes the import", async () => {
    const release = testRelease();
    const reader = new FakeReader([
      [release.directory.fileURL, [directoryRow({ NCESSCH: "" }), directoryRow()]],
      [release.membership.fileURL, [gradeRow("09", "230"), gradeRow("09", "230")]],
    ]);
    const store = new FakeStore();

    const result = await importNcesCcd({ release, rowReader: reader, store });

    expect(result.status).toBe("completed");
    expect(result.schoolsCreated).toBe(1);
    expect(result.enrollmentRows).toBe(0);
    expect(result.errorCount).toBe(2);
    expect(result.errors.map((error) => error.phase)).toEqual(["directory", "membership"]);
    expect(store.importRuns[0].status).toBe("COMPLETED");
  });

  it("marks the run failed when the row reader has a fatal stream error", async () => {
    const release = testRelease();
    const store = new FakeStore();
    const reader: CcdRowReader = {
      async streamRows() {
        throw new Error("download stream terminated");
      },
    };

    await expect(importNcesCcd({ release, rowReader: reader, store })).rejects.toThrow("download stream terminated");

    expect(store.importRuns[0].status).toBe("FAILED");
    expect(store.importRuns[0].completion?.errorCount).toBe(1);
    expect(store.importRuns[0].completion?.errors[0]?.message).toBe("download stream terminated");
  });
});

function fileApiRow(schoolYear: string, component: string, fileURL: string) {
  return {
    fiscal: false,
    level: "School",
    schoolYear,
    title: "Public Elementary/Secondary School Universe Survey Data",
    version: "v.2a",
    versionOrder: 0,
    elementType: "Data File",
    component,
    order: 0,
    fileURL,
  };
}

function testRelease(): CcdRelease {
  const directory = testFile("Directory", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_029_2425_w_1a_073025.zip");
  const membership = testFile("Membership", "https://nces.ed.gov/ccd/Data/zip/ccd_sch_052_2425_l_1a_073025.zip");
  return {
    schoolYear: "2024 - 2025",
    schoolYearKey: "2024-25",
    release: "CCD 2024-25 directory ccd_sch_029_2425_w_1a_073025.zip; membership ccd_sch_052_2425_l_1a_073025.zip",
    sourceUrl: `directory=${directory.fileURL}\nmembership=${membership.fileURL}`,
    directory,
    membership,
  };
}

function testFile(component: "Directory" | "Membership", fileURL: string): CcdImportFile {
  return {
    component,
    schoolYear: "2024 - 2025",
    schoolYearKey: "2024-25",
    title: "Public Elementary/Secondary School Universe Survey Data",
    version: "v.2a",
    fileURL,
    fileName: fileURL.split("/").at(-1)!,
    datasetRelease: `CCD 2024-25 ${component.toLowerCase()} v.2a ${fileURL.split("/").at(-1)!}`,
    versionOrder: 0,
    order: 0,
  };
}

function directoryRow(overrides: CcdRow = {}): CcdRow {
  return {
    ST: "IN",
    NCESSCH: "180000000001",
    SCH_NAME: "Indiana High School",
    LEAID: "1800000",
    LEA_NAME: "Indiana District",
    LSTREET1: "1 Main St",
    LCITY: "Indianapolis",
    LSTATE: "IN",
    LZIP: "46204",
    LEVEL: "High",
    GSLO: "09",
    GSHI: "12",
    SY_STATUS_TEXT: "Open",
    G_9_OFFERED: "Yes",
    G_10_OFFERED: "Yes",
    G_11_OFFERED: "Yes",
    G_12_OFFERED: "Yes",
    ...overrides,
  };
}

function gradeRow(grade: string, count: string): CcdRow {
  return {
    ST: "IN",
    NCESSCH: "180000000001",
    TOTAL_INDICATOR: "Subtotal 4 - By Grade",
    GRADE: grade,
    STUDENT_COUNT: count,
  };
}

function totalRow(count: string): CcdRow {
  return {
    ST: "IN",
    NCESSCH: "180000000001",
    TOTAL_INDICATOR: "Education Unit Total",
    STUDENT_COUNT: count,
  };
}

class FakeReader implements CcdRowReader {
  readonly calls: string[] = [];
  private readonly rowsByUrl: Map<string, CcdRow[]>;

  constructor(entries: Array<[string, CcdRow[]]>) {
    this.rowsByUrl = new Map(entries);
  }

  async streamRows(file: CcdImportFile, onRow: (row: CcdRow, context: CsvRowContext) => Promise<void>): Promise<void> {
    this.calls.push(file.fileURL);
    const rows = this.rowsByUrl.get(file.fileURL) ?? [];
    let rowNumber = 1;
    for (const row of rows) {
      await onRow(row, { entryPath: file.fileName, rowNumber });
      rowNumber += 1;
    }
  }
}

class FakeStore implements NcesImportStore {
  readonly completedReleases = new Set<string>();
  readonly importRuns: Array<{
    id: string;
    input: ImportRunInput;
    status: "RUNNING" | "COMPLETED" | "FAILED";
    completion?: ImportRunCompletion;
  }> = [];
  readonly schools = new Map<string, { id: string; record: DirectoryRecord; datasetRelease: string }>();
  readonly enrollments = new Map<string, EnrollmentUpsertInput & { source: "NCES_CCD" }>();
  readonly recalculatedSchoolIds: string[][] = [];

  async hasCompletedImport(release: string): Promise<boolean> {
    return this.completedReleases.has(release);
  }

  async createImportRun(input: ImportRunInput): Promise<{ id: string }> {
    const id = `import-${this.importRuns.length + 1}`;
    this.importRuns.push({ id, input, status: "RUNNING" });
    return { id };
  }

  async completeImportRun(id: string, completion: ImportRunCompletion): Promise<void> {
    const run = this.mustRun(id);
    run.status = "COMPLETED";
    run.completion = completion;
    this.completedReleases.add(run.input.release);
  }

  async failImportRun(id: string, completion: ImportRunCompletion): Promise<void> {
    const run = this.mustRun(id);
    run.status = "FAILED";
    run.completion = completion;
  }

  async upsertSchool(input: {
    record: DirectoryRecord;
    datasetRelease: string;
    importedAt: Date;
  }): Promise<{ id: string; created: boolean; updated: boolean }> {
    const existing = this.schools.get(input.record.externalId);
    if (!existing) {
      const id = `school-${this.schools.size + 1}`;
      this.schools.set(input.record.externalId, {
        id,
        record: input.record,
        datasetRelease: input.datasetRelease,
      });
      return { id, created: true, updated: false };
    }

    const updated =
      JSON.stringify(existing.record) !== JSON.stringify(input.record) || existing.datasetRelease !== input.datasetRelease;
    if (updated) {
      this.schools.set(input.record.externalId, {
        id: existing.id,
        record: input.record,
        datasetRelease: input.datasetRelease,
      });
    }
    return { id: existing.id, created: false, updated };
  }

  async findCcdSchoolByExternalId(externalId: string): Promise<{ id: string } | null> {
    return this.schools.get(externalId) ?? null;
  }

  async upsertEnrollment(input: EnrollmentUpsertInput): Promise<{ created: boolean; updated: boolean }> {
    const key = `${input.schoolId}:${input.schoolYear}:NCES_CCD:${input.scope}`;
    const existing = this.enrollments.get(key);
    this.enrollments.set(key, { ...input, source: "NCES_CCD" });
    return { created: !existing, updated: Boolean(existing) && JSON.stringify(existing) !== JSON.stringify(input) };
  }

  async recalculateClassificationsForSchools(schoolIds: string[]): Promise<void> {
    this.recalculatedSchoolIds.push(schoolIds);
  }

  private mustRun(id: string): (typeof this.importRuns)[number] {
    const run = this.importRuns.find((entry) => entry.id === id);
    if (!run) throw new Error(`Missing import run ${id}`);
    return run;
  }
}
