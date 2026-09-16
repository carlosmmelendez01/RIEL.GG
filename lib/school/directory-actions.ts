"use server";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

const SearchDirectoryInput = z.object({
  query: z.string().trim().min(2).max(120),
});

export type JoinDirectorySchool = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  code: string;
  ncesId: string;
  verified: boolean;
};

export type SearchDirectorySchoolsResult =
  | { ok: true; schools: JoinDirectorySchool[] }
  | { ok: false; error: string };

export async function searchDirectorySchools(input: {
  query: string;
}): Promise<SearchDirectorySchoolsResult> {
  const parsed = SearchDirectoryInput.safeParse(input);
  if (!parsed.success) {
    return { ok: true, schools: [] };
  }

  const query = parsed.data.query;
  const schools = await prisma.school
    .findMany({
      where: {
        directorySource: "CCD",
        externalId: { not: null },
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortName: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { externalId: { contains: query, mode: "insensitive" } },
          { ncesId: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
      take: 20,
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        city: true,
        state: true,
        externalId: true,
        ncesId: true,
      },
    })
    .catch(() => null);

  if (!schools) {
    return {
      ok: false,
      error: "School search is unavailable right now. Try again in a minute.",
    };
  }

  return {
    ok: true,
    schools: schools.map((school) => ({
      id: school.id,
      name: school.name,
      city: school.city,
      state: school.state,
      code: schoolCode(school.code ?? school.shortName ?? school.name),
      ncesId: school.externalId ?? school.ncesId ?? "",
      verified: true,
    })),
  };
}

function schoolCode(value: string): string {
  const letters = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
  return letters || "SCH";
}
