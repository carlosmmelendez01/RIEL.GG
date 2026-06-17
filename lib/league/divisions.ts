export type LeagueDivisionOption = {
  value: string;
  label: string;
  description?: string;
};

function parseConfiguredDivisions(value: unknown): LeagueDivisionOption[] | null {
  if (!Array.isArray(value)) return null;

  const options: LeagueDivisionOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.value !== "string" || typeof candidate.label !== "string") continue;

    const option: LeagueDivisionOption = {
      value: candidate.value,
      label: candidate.label,
    };
    if (typeof candidate.description === "string" && candidate.description.trim()) {
      option.description = candidate.description;
    }
    options.push(option);
  }

  return options;
}

const IEN_DIVISIONS: LeagueDivisionOption[] = [
  {
    value: "A",
    label: "A",
    description: "Smaller-school Indiana Esports Network division.",
  },
  {
    value: "AA",
    label: "AA",
    description: "Larger-school Indiana Esports Network division.",
  },
  {
    value: "MIDDLE_SCHOOL",
    label: "Middle School",
    description: "Middle school programs.",
  },
  {
    value: "UNIFIED",
    label: "Unified",
    description: "Unified esports programs.",
  },
];

const SCHOLASTIC_DEFAULT_DIVISIONS: LeagueDivisionOption[] = [
  { value: "HIGH_SCHOOL", label: "High School" },
  { value: "MIDDLE_SCHOOL", label: "Middle School" },
  { value: "UNIFIED", label: "Unified" },
];

const COLLEGIATE_DEFAULT_DIVISIONS: LeagueDivisionOption[] = [
  { value: "VARSITY", label: "Varsity" },
  { value: "CLUB", label: "Club" },
];

export function getLeagueDivisionOptions(league: {
  name: string;
  slug?: string | null;
  shortName?: string | null;
  classification?: string | null;
  schoolDivisions?: unknown;
}): LeagueDivisionOption[] {
  const configured = parseConfiguredDivisions(league.schoolDivisions);
  if (configured) return configured;

  const key = `${league.slug ?? ""} ${league.shortName ?? ""} ${league.name}`.toLowerCase();

  if (
    key.includes("ien") ||
    key.includes("ihsen") ||
    key.includes("indiana esports network") ||
    key.includes("riel")
  ) {
    return IEN_DIVISIONS;
  }

  if (league.classification === "COLLEGIATE") return COLLEGIATE_DEFAULT_DIVISIONS;
  if (league.classification === "SCHOLASTIC") return SCHOLASTIC_DEFAULT_DIVISIONS;

  return [];
}

export function findLeagueDivisionOption(
  options: LeagueDivisionOption[],
  value: string | null | undefined,
): LeagueDivisionOption | null {
  if (!value) return null;
  return options.find((option) => option.value === value) ?? null;
}

export function labelForLeagueDivision(
  options: LeagueDivisionOption[],
  value: string | null | undefined,
): string | null {
  return findLeagueDivisionOption(options, value)?.label ?? value ?? null;
}
