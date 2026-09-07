import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards on the schema and migration set that need no database.
 *
 * These exist because migrations in this repo are hand-written, and because
 * the June 2026 security audit's standing requirement is to verify RLS is
 * still enabled after every schema change. A checklist item nobody runs is
 * not a control; a failing test is.
 */

const PRISMA_DIR = join(process.cwd(), "prisma");
const SCHEMA = readFileSync(join(PRISMA_DIR, "schema.prisma"), "utf8");
const MIGRATIONS_DIR = join(PRISMA_DIR, "migrations");

function modelNames(): string[] {
  return [...SCHEMA.matchAll(/^model (\w+)/gm)].map((m) => m[1]);
}

function migrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .map((dir) => join(MIGRATIONS_DIR, dir, "migration.sql"))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function tablesWithRls(sql: string): Set<string> {
  return new Set(
    [...sql.matchAll(/ALTER TABLE "(\w+)" ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]),
  );
}

describe("row level security", () => {
  it("every model's table has RLS enabled by some migration", () => {
    const enabled = tablesWithRls(migrationSql());
    const missing = modelNames().filter((model) => !enabled.has(model));
    // A new table without RLS ships readable by the Supabase anon role.
    expect(missing).toEqual([]);
  });

  it("no migration disables RLS", () => {
    expect(migrationSql()).not.toMatch(/DISABLE ROW LEVEL SECURITY/);
  });
});

describe("schema hygiene", () => {
  it("does not hard-code Indiana as a default", () => {
    // RIEL is meant to run more than one league. A default of "IN" on School
    // is the same class of mistake as hard-coding IEN's division names.
    expect(SCHEMA).not.toMatch(/@default\("IN"\)/);
  });

  it("keys school directory identity on (source, externalId)", () => {
    expect(SCHEMA).toMatch(/@@unique\(\[directorySource, externalId\]\)/);
  });

  it("stores enrollment per school year and scope, not as one number on School", () => {
    expect(SCHEMA).toMatch(/model SchoolEnrollment/);
    expect(SCHEMA).toMatch(/@@unique\(\[schoolId, schoolYear, source, scope\]\)/);
    // School itself must never grow a bare enrollment column.
    const school = SCHEMA.slice(SCHEMA.indexOf("model School {"));
    const body = school.slice(0, school.indexOf("\n}"));
    expect(body).not.toMatch(/^\s+enrollment\s+Int/m);
  });
});

describe("migration set", () => {
  it("every migration directory contains a migration.sql", () => {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const empty = dirs.filter((d) => !existsSync(join(MIGRATIONS_DIR, d, "migration.sql")));
    expect(empty).toEqual([]);
  });

  it("migration directory names are unique and ordered by timestamp prefix", () => {
    const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const prefixes = dirs.map((d) => d.split("_")[0]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect([...prefixes].sort()).toEqual(prefixes.slice().sort());
  });
});
