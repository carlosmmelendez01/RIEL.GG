import { describe, expect, it } from "vitest";

import {
  CcdRowError,
  groupBySchool,
  isOperational,
  mapSchoolLevel,
  normalizeGrade,
  offersHighSchoolGrades,
  parseDirectoryRow,
  parseStudentCount,
  sumGrades912,
  totalEnrollment,
  type CcdRow,
} from "./nces-ccd";

// A directory row shaped like the 2025-26 preliminary file.
function directoryRow(over: CcdRow = {}): CcdRow {
  return {
    NCESSCH: "181614000725",
    SCH_NAME: "Michigan City High School",
    LEAID: "1816140",
    LEA_NAME: "Michigan City Area Schools",
    LSTREET1: "8501 W Pahs Rd",
    LCITY: "Michigan City",
    LSTATE: "IN",
    LZIP: "46360",
    LEVEL: "3",
    GSLO: "09",
    GSHI: "12",
    SY_STATUS_TEXT: "Open",
    G_9_OFFERED: "Yes",
    G_10_OFFERED: "Yes",
    G_11_OFFERED: "Yes",
    G_12_OFFERED: "Yes",
    ...over,
  };
}

describe("directory rows", () => {
  it("maps a well-formed row", () => {
    const r = parseDirectoryRow(directoryRow());
    expect(r.externalId).toBe("181614000725");
    expect(r.name).toBe("Michigan City High School");
    expect(r.districtExternalId).toBe("1816140");
    expect(r.districtName).toBe("Michigan City Area Schools");
    expect(r.city).toBe("Michigan City");
    expect(r.state).toBe("IN");
    expect(r.zip).toBe("46360");
    expect(r.level).toBe("HIGH");
    expect(r.lowGrade).toBe("09");
    expect(r.highGrade).toBe("12");
    expect(r.operational).toBe(true);
    expect(r.offersHighSchoolGrades).toBe(true);
  });

  it("rejects an id that is not a 12-digit NCES school id", () => {
    // The mock data this replaces used ids like "1801560-001", which are not
    // NCES ids at all. Those must never enter the directory as CCD-sourced.
    for (const bad of ["1801560-001", "18161400072", "abc", "1816140007255"]) {
      expect(() => parseDirectoryRow(directoryRow({ NCESSCH: bad }))).toThrow(CcdRowError);
    }
  });

  it("rejects a row with no school name", () => {
    expect(() => parseDirectoryRow(directoryRow({ SCH_NAME: "   " }))).toThrow(CcdRowError);
  });

  it("drops a district id that is not a 7-digit LEA id rather than storing junk", () => {
    expect(parseDirectoryRow(directoryRow({ LEAID: "18161" })).districtExternalId).toBeNull();
  });

  it("treats CCD missing-value markers as null", () => {
    const r = parseDirectoryRow(directoryRow({ LSTREET1: "†", LCITY: "‡", LZIP: "-1" }));
    expect(r.streetAddress).toBeNull();
    expect(r.city).toBeNull();
    expect(r.zip).toBeNull();
  });

  it("maps school levels from both code and word forms", () => {
    expect(mapSchoolLevel("1")).toBe("ELEMENTARY");
    expect(mapSchoolLevel("2")).toBe("MIDDLE");
    expect(mapSchoolLevel("3")).toBe("HIGH");
    expect(mapSchoolLevel("High")).toBe("HIGH");
    expect(mapSchoolLevel("M")).toBe("MIDDLE");
    expect(mapSchoolLevel("")).toBeNull();
    expect(mapSchoolLevel("banana")).toBeNull();
  });

  it("recognises operational status from text or code", () => {
    expect(isOperational({ SY_STATUS_TEXT: "Open" })).toBe(true);
    expect(isOperational({ SY_STATUS_TEXT: "New" })).toBe(true);
    expect(isOperational({ SY_STATUS_TEXT: "Closed" })).toBe(false);
    expect(isOperational({ SY_STATUS_TEXT: "Future" })).toBe(false);
    expect(isOperational({ SY_STATUS: "1" })).toBe(true);
    expect(isOperational({ SY_STATUS: "2" })).toBe(false);
  });

  it("detects whether a school actually offers grades 9-12", () => {
    // A 7-12 building and a K-8 building are both "MIDDLE"-adjacent in
    // different releases; the grade flags are the independent check.
    expect(offersHighSchoolGrades(directoryRow())).toBe(true);
    expect(
      offersHighSchoolGrades(
        directoryRow({ G_9_OFFERED: "No", G_10_OFFERED: "No", G_11_OFFERED: "No", G_12_OFFERED: "No" }),
      ),
    ).toBe(false);
  });
});

// --- Membership -------------------------------------------------------

function gradeRow(grade: string, count: string, over: CcdRow = {}): CcdRow {
  return {
    NCESSCH: "181614000725",
    TOTAL_INDICATOR: "Subtotal 4 - By Grade",
    GRADE: grade,
    STUDENT_COUNT: count,
    ...over,
  };
}

function detailRow(grade: string, count: string): CcdRow {
  // The same students, broken out by race and sex. Summing these alongside the
  // by-grade subtotals is the double-count this module exists to prevent.
  return {
    NCESSCH: "181614000725",
    TOTAL_INDICATOR: "Category Set A - By Race/Ethnicity; Sex; Grade",
    GRADE: grade,
    STUDENT_COUNT: count,
  };
}

describe("grades 9-12 enrollment", () => {
  it("sums the by-grade subtotal rows", () => {
    const sum = sumGrades912([
      gradeRow("09", "230"),
      gradeRow("10", "225"),
      gradeRow("11", "210"),
      gradeRow("12", "211"),
    ]);
    expect(sum?.total).toBe(876);
    expect(sum?.byGrade).toEqual({ "09": 230, "10": 225, "11": 210, "12": 211 });
  });

  it("ignores the race/sex detail rows that describe the same students", () => {
    const sum = sumGrades912([
      gradeRow("09", "230"),
      gradeRow("10", "225"),
      gradeRow("11", "210"),
      gradeRow("12", "211"),
      detailRow("09", "115"),
      detailRow("09", "115"),
      detailRow("10", "225"),
      { NCESSCH: "181614000725", TOTAL_INDICATOR: "Education Unit Total", GRADE: "No Category Codes", STUDENT_COUNT: "876" },
    ]);
    // 876, not 1331. This is the number that decides 1A vs 2A.
    expect(sum?.total).toBe(876);
  });

  it("ignores grades outside 9-12", () => {
    const sum = sumGrades912([
      gradeRow("07", "180"),
      gradeRow("08", "175"),
      gradeRow("09", "230"),
      gradeRow("10", "225"),
      gradeRow("11", "210"),
      gradeRow("12", "211"),
    ]);
    // A 7-12 building: 876 for classification, not 1231. This is exactly the
    // case that made grades 9-12 the chosen scope.
    expect(sum?.total).toBe(876);
  });

  it("accepts 'Grade 9' as well as '09'", () => {
    const sum = sumGrades912([
      gradeRow("Grade 9", "230"),
      gradeRow("Grade 10", "225"),
      gradeRow("Grade 11", "210"),
      gradeRow("Grade 12", "211"),
    ]);
    expect(sum?.total).toBe(876);
  });

  it("returns null for a school with no 9-12 grades at all", () => {
    expect(sumGrades912([gradeRow("06", "150"), gradeRow("07", "160"), gradeRow("08", "155")])).toBeNull();
  });

  it("returns null when there are no membership rows", () => {
    expect(sumGrades912([])).toBeNull();
  });

  it("throws rather than double-count a duplicated grade row", () => {
    expect(() => sumGrades912([gradeRow("09", "230"), gradeRow("09", "230")])).toThrow(CcdRowError);
  });

  it("throws when the release uses TOTAL_INDICATOR values it does not recognise", () => {
    // The safety net for the one assumption in this module that has not been
    // verified against a downloaded file. Failing loudly here is the whole
    // point: a silently wrong enrollment misclassifies a school.
    const unknown = [
      { NCESSCH: "1", TOTAL_INDICATOR: "Some New Aggregation", GRADE: "09", STUDENT_COUNT: "230" },
      { NCESSCH: "1", TOTAL_INDICATOR: "Some New Aggregation", GRADE: "10", STUDENT_COUNT: "225" },
    ];
    expect(() => sumGrades912(unknown)).toThrow(/TOTAL_INDICATOR/);
  });

  it("treats a suppressed count as zero rather than dropping the grade", () => {
    const sum = sumGrades912([gradeRow("09", "230"), gradeRow("10", "†"), gradeRow("11", "210"), gradeRow("12", "211")]);
    expect(sum?.byGrade["10"]).toBe(0);
    expect(sum?.total).toBe(651);
  });
});

describe("total enrollment", () => {
  it("reads the education-unit-total row", () => {
    expect(
      totalEnrollment([
        gradeRow("09", "230"),
        { NCESSCH: "1", TOTAL_INDICATOR: "Education Unit Total", STUDENT_COUNT: "1231" },
      ]),
    ).toBe(1231);
  });

  it("returns null when there is no total row", () => {
    expect(totalEnrollment([gradeRow("09", "230")])).toBeNull();
  });

  it("throws on more than one total row", () => {
    expect(() =>
      totalEnrollment([
        { NCESSCH: "1", TOTAL_INDICATOR: "Education Unit Total", STUDENT_COUNT: "1231" },
        { NCESSCH: "1", TOTAL_INDICATOR: "Education Unit Total", STUDENT_COUNT: "1240" },
      ]),
    ).toThrow(CcdRowError);
  });
});

describe("helpers", () => {
  it("parses student counts and rejects nonsense", () => {
    expect(parseStudentCount("230")).toBe(230);
    expect(parseStudentCount("0")).toBe(0);
    expect(parseStudentCount("")).toBeNull();
    expect(parseStudentCount("-1")).toBeNull();
    expect(parseStudentCount("abc")).toBeNull();
  });

  it("normalizes grade codes", () => {
    expect(normalizeGrade("9")).toBe("09");
    expect(normalizeGrade("09")).toBe("09");
    expect(normalizeGrade("Grade 12")).toBe("12");
    expect(normalizeGrade("KG")).toBe("KG");
    expect(normalizeGrade("")).toBeNull();
  });

  it("groups membership rows by school", () => {
    const grouped = groupBySchool([
      { NCESSCH: "181614000725", GRADE: "09" },
      { NCESSCH: "181614000725", GRADE: "10" },
      { NCESSCH: "180519000156", GRADE: "09" },
      { GRADE: "11" },
    ]);
    expect(grouped.size).toBe(2);
    expect(grouped.get("181614000725")).toHaveLength(2);
  });
});
