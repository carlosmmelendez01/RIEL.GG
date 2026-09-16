import type { ContentState, ContentStatus, SchoolLevel, SkillTier } from "@prisma/client";

import {
  evaluateEligibility,
  type EligibilityDecision,
  type SchoolPopulation,
} from "@/lib/domain/eligibility";
import { isSupportedGame } from "@/lib/games/supported";

export type TeamCompetitionEligibilityInput = {
  now: Date;
  school: {
    id: string;
    name: string;
    level: SchoolLevel | null;
    lowGrade: string | null;
    highGrade: string | null;
    verifiedInLeague: boolean;
    agreementAccepted: boolean;
    divisionId: string | null;
    classificationMissing: boolean;
  };
  team: {
    id: string;
    gameTitleId: string;
    skillTier: SkillTier;
  };
  competition: {
    id: string;
    name: string;
    gameTitleId: string;
    gameSlug: string;
    skillTier: SkillTier;
    state: ContentState;
    status: ContentStatus;
    divisionId: string | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
  };
  actor: {
    canRegister: boolean;
  };
  state: {
    registeredTeamCount: number;
    existingRosterId: string | null;
  };
};

export function evaluateTeamCompetitionEligibility(
  input: TeamCompetitionEligibilityInput,
): EligibilityDecision {
  return evaluateEligibility({
    now: input.now,
    school: {
      id: input.school.id,
      name: input.school.name,
      verifiedInLeague: input.school.verifiedInLeague,
      agreementAccepted: input.school.agreementAccepted,
      populations: schoolPopulations(input.school),
      divisionId: input.school.divisionId,
      classificationMissing: input.school.classificationMissing,
    },
    competition: {
      id: input.competition.id,
      name: input.competition.name,
      published: input.competition.state !== "DRAFT",
      finished: input.competition.state === "COMPLETE" || input.competition.status === "FINISHED",
      population: populationForTier(input.competition.skillTier),
      divisionId: input.competition.divisionId,
      gameSupported:
        isSupportedGame(input.competition.gameSlug) &&
        input.competition.gameTitleId === input.team.gameTitleId &&
        input.competition.skillTier === input.team.skillTier,
      registrationOpensAt: input.competition.registrationOpensAt,
      registrationClosesAt: input.competition.registrationClosesAt,
      lateRegistrationEnabled: false,
      maxTeamsPerSchool: null,
    },
    actor: input.actor,
    state: {
      registeredTeamCount: input.state.registeredTeamCount,
      existingRosterId: input.state.existingRosterId,
      hasApprovedLateRegistration: false,
      hasApprovedTeamLimitBypass: false,
    },
  });
}

export function populationForTier(tier: SkillTier): SchoolPopulation {
  if (tier === "MIDDLE_SCHOOL") return "MIDDLE_SCHOOL";
  if (tier === "UNIFIED") return "UNIFIED";
  return "HIGH_SCHOOL";
}

export function schoolPopulations(school: {
  level: SchoolLevel | null;
  lowGrade: string | null;
  highGrade: string | null;
}): SchoolPopulation[] {
  const populations = new Set<SchoolPopulation>();
  const low = gradeNumber(school.lowGrade);
  const high = gradeNumber(school.highGrade);

  if (school.level === "HIGH") populations.add("HIGH_SCHOOL");
  if (school.level === "MIDDLE") populations.add("MIDDLE_SCHOOL");

  if (low !== null && high !== null) {
    if (low <= 12 && high >= 9) populations.add("HIGH_SCHOOL");
    if (low <= 8 && high >= 6) populations.add("MIDDLE_SCHOOL");
  }

  if (populations.has("HIGH_SCHOOL")) populations.add("UNIFIED");
  return [...populations];
}

function gradeNumber(grade: string | null): number | null {
  if (!grade) return null;
  const normalized = grade.trim().toUpperCase();
  if (normalized === "KG" || normalized === "K") return 0;
  if (normalized === "PK" || normalized === "PREK") return -1;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
