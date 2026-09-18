/**
 * Explicit directory identities used by the local/demo seed.
 *
 * These IDs were verified against the imported NCES CCD 2024-25 directory.
 * Keeping the mapping here prevents the seed from falling back to name-based
 * matching, which is unsafe when schools have similar or changing names.
 */
export const INDIANA_CCD_SCHOOL_FIXTURES = {
  "ps-mchs": {
    externalId: "180657001160",
    officialName: "Michigan City High School",
    city: "Michigan City",
  },
  "ps-carmel": {
    externalId: "180120000193",
    officialName: "Carmel High School",
    city: "Carmel",
  },
  "ps-fishers": {
    externalId: "181065002392",
    officialName: "Fishers High School",
    city: "Fishers",
  },
  "ps-hse": {
    externalId: "181065001752",
    officialName: "Hamilton Southeastern HS",
    city: "Fishers",
  },
  "ps-nch": {
    externalId: "181272002021",
    officialName: "North Central High School",
    city: "Indianapolis",
  },
  "ps-cgv": {
    externalId: "180144000209",
    officialName: "Center Grove High School",
    city: "Greenwood",
  },
  "ps-westfield": {
    externalId: "181308002075",
    officialName: "Westfield High School",
    city: "Westfield",
  },
  "ps-zionsville": {
    externalId: "180283000341",
    officialName: "Zionsville Community High School",
    city: "Zionsville",
  },
  "ps-plainfield": {
    externalId: "180897001494",
    officialName: "Plainfield High School",
    city: "Plainfield",
  },
  "ps-crownpoint": {
    externalId: "180249000293",
    officialName: "Crown Point High School",
    city: "Crown Point",
  },
} as const;

export type IndianaCcdSeedSchoolId = keyof typeof INDIANA_CCD_SCHOOL_FIXTURES;

/**
 * Private demo schools are intentionally MANUAL until a PSS importer exists.
 * Enrollment values are synthetic local-demo inputs, clearly stored as
 * LEAGUE_ADMIN data rather than represented as NCES-verified facts.
 */
export const MANUAL_SCHOOL_CLASSIFICATION_FIXTURES = {
  "ps-brebeuf": {
    level: "HIGH",
    schoolYear: "2024-25",
    grades912Enrollment: 800,
  },
  "ps-cathedral": {
    level: "HIGH",
    schoolYear: "2024-25",
    grades912Enrollment: 1100,
  },
  "ps-bishop": {
    level: "HIGH",
    schoolYear: "2024-25",
    grades912Enrollment: 650,
  },
} as const;

export type ManualClassificationSeedSchoolId =
  keyof typeof MANUAL_SCHOOL_CLASSIFICATION_FIXTURES;

export const SYNTHETIC_ENROLLMENT_NOTE =
  "Synthetic local-demo enrollment supplied by the seed; not NCES-verified.";
