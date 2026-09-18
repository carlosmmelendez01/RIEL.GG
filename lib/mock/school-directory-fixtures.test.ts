import { describe, expect, it } from "vitest";

import { PLATFORM_SCHOOLS } from "./platform-data";
import {
  INDIANA_CCD_SCHOOL_FIXTURES,
  MANUAL_SCHOOL_CLASSIFICATION_FIXTURES,
} from "./school-directory-fixtures";

describe("seeded school directory fixtures", () => {
  it("uses unique 12-digit CCD identifiers and keeps Michigan City distinct from Plainfield", () => {
    const ids = Object.values(INDIANA_CCD_SCHOOL_FIXTURES).map(
      (fixture) => fixture.externalId,
    );

    expect(ids.every((id) => /^18\d{10}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INDIANA_CCD_SCHOOL_FIXTURES["ps-mchs"].externalId).not.toBe(
      INDIANA_CCD_SCHOOL_FIXTURES["ps-plainfield"].externalId,
    );
  });

  it("keeps platform CCD claims aligned with the verified fixture map", () => {
    for (const [seedSchoolId, fixture] of Object.entries(
      INDIANA_CCD_SCHOOL_FIXTURES,
    )) {
      const school = PLATFORM_SCHOOLS.find((entry) => entry.id === seedSchoolId);
      expect(school?.ncesVerified).toBe(true);
      expect(school?.ncesId).toBe(fixture.externalId);
      expect(school?.name).toBe(fixture.officialName);
      expect(school?.city).toBe(fixture.city);
    }
  });

  it("labels synthetic private-school data as manual rather than NCES verified", () => {
    for (const seedSchoolId of Object.keys(
      MANUAL_SCHOOL_CLASSIFICATION_FIXTURES,
    )) {
      const school = PLATFORM_SCHOOLS.find((entry) => entry.id === seedSchoolId);
      expect(school?.ncesVerified).toBe(false);
      expect(school?.ncesId).toBeUndefined();
    }
  });
});
