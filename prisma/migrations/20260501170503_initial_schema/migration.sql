-- CreateEnum
CREATE TYPE "ClassificationKind" AS ENUM ('SCHOLASTIC', 'COLLEGIATE', 'AMATEUR');

-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SchoolRole" AS ENUM ('MANAGER', 'COACH', 'PLAYER');

-- CreateEnum
CREATE TYPE "InviteScope" AS ENUM ('SCHOOL', 'LEAGUE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SkillTier" AS ENUM ('CLUB', 'JV', 'VARSITY', 'PREMIER', 'ACADEMY', 'MIDDLE_SCHOOL');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('MANAGER', 'COACH', 'CAPTAIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "CompetitionKind" AS ENUM ('SEASON_PLAY', 'TOURNAMENT', 'SCRIMMAGE_CUP');

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('SEEDING', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('LEAGUE_PLAY', 'GROUP_STAGE', 'ROUND_ROBIN', 'SWISS', 'SINGLE_ELIM', 'DOUBLE_ELIM', 'PLACEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SchedulingMethod" AS ENUM ('CUSTOM', 'ROUND_ROBIN', 'SINGLE_ELIM', 'DOUBLE_ELIM', 'SWISS', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "ConfirmationMode" AS ENUM ('CONSENSUS', 'DELAYED_AUTO');

-- CreateEnum
CREATE TYPE "ResultsReporterKind" AS ENUM ('BOTH_SIDES', 'EITHER_SIDE', 'COACH_ONLY', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('GAME_ACCOUNT_LINK', 'DOCUMENT_UPLOAD', 'PARENTAL_CONSENT', 'OFFICIAL_APPROVAL', 'FEE_PAYMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RosterParticipation" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LockState" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "RosterLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RosterRole" AS ENUM ('MANAGER', 'COACH', 'CAPTAIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'CHECKING_IN', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'FINISHED', 'FORFEITED', 'CANCELED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM', 'EVIDENCE');

-- CreateEnum
CREATE TYPE "AnnouncementScope" AS ENUM ('LEAGUE', 'COMPETITION', 'STAGE', 'SCHOOL', 'ROSTER', 'TEAM');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'COACHES', 'PLAYERS', 'PARENTS', 'STAFF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "classification" "ClassificationKind" NOT NULL DEFAULT 'SCHOLASTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueAdminship" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueAdminship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "displayNameOverride" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "code" TEXT,
    "city" TEXT,
    "state" TEXT DEFAULT 'IN',
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "logoUrl" TEXT,
    "ncesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL DEFAULT 'PLAYER',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "detached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "InviteScope" NOT NULL,
    "schoolId" TEXT,
    "leagueId" TEXT,
    "createdById" TEXT NOT NULL,
    "rolesGranted" TEXT[],
    "grantsOwnership" BOOLEAN NOT NULL DEFAULT false,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "status" "InviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTitle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameFormat" (
    "id" TEXT NOT NULL,
    "gameTitleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL,

    CONSTRAINT "GameFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gameTitleId" TEXT NOT NULL,
    "gameFormatId" TEXT,
    "skillTier" "SkillTier" NOT NULL DEFAULT 'VARSITY',
    "customName" TEXT,
    "colorTag" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "avatarUrl" TEXT,
    "nameplateUrl" TEXT,
    "heroImageUrl" TEXT,
    "preferredRegions" TEXT[],
    "availabilityWindows" JSONB,
    "rank" INTEGER,
    "currentElo" DOUBLE PRECISION,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameTitleId" TEXT NOT NULL,
    "gameFormatId" TEXT,
    "skillTier" "SkillTier" NOT NULL,
    "kind" "CompetitionKind" NOT NULL DEFAULT 'SEASON_PLAY',
    "state" "ContentState" NOT NULL DEFAULT 'DRAFT',
    "status" "ContentStatus" NOT NULL DEFAULT 'SEEDING',
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "locationLabel" TEXT,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "rewardsConfig" JSONB,
    "discordConfig" JSONB,
    "resultsConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StageKind" NOT NULL,
    "schedulingMethod" "SchedulingMethod" NOT NULL DEFAULT 'ROUND_ROBIN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "state" "ContentState" NOT NULL DEFAULT 'DRAFT',
    "status" "ContentStatus" NOT NULL DEFAULT 'SEEDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bestOf" INTEGER NOT NULL DEFAULT 3,
    "gamesPerMatch" INTEGER NOT NULL DEFAULT 3,
    "matchIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "concurrentMatches" BOOLEAN NOT NULL DEFAULT true,
    "checkInWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "rescheduleCutoffHours" INTEGER NOT NULL DEFAULT 24,
    "resultsReporters" "ResultsReporterKind" NOT NULL DEFAULT 'COACH_ONLY',
    "confirmationMode" "ConfirmationMode" NOT NULL DEFAULT 'CONSENSUS',
    "autoFinishAfterMinutes" INTEGER,
    "autoScoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "useRankAsInitialElo" BOOLEAN NOT NULL DEFAULT false,
    "eloMultiplier" INTEGER NOT NULL DEFAULT 1000,
    "pointsConfig" JSONB,
    "resourcesConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationModule" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "type" "ModuleKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "participation" "RosterParticipation" NOT NULL DEFAULT 'ACTIVE',
    "editLock" "LockState" NOT NULL DEFAULT 'OPEN',
    "presentationLock" "LockState" NOT NULL DEFAULT 'OPEN',
    "lifecycle" "RosterLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rank" INTEGER,
    "initialElo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMembership" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RosterRole" NOT NULL DEFAULT 'PLAYER',
    "jerseyNumber" INTEGER,
    "inGameName" TEXT,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    "teamRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterModuleStatus" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterModuleStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "roundId" TEXT,
    "homeRosterId" TEXT NOT NULL,
    "awayRosterId" TEXT NOT NULL,
    "bracketRound" INTEGER,
    "bracketSlot" INTEGER,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bestOf" INTEGER NOT NULL DEFAULT 3,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerRosterId" TEXT,
    "homeConfirmedAt" TIMESTAMP(3),
    "homeConfirmedById" TEXT,
    "awayConfirmedAt" TIMESTAMP(3),
    "awayConfirmedById" TEXT,
    "finishedAt" TIMESTAMP(3),
    "forfeitReason" TEXT,
    "forfeitingSide" "MatchSide",
    "canceledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerSide" "MatchSide",
    "isTie" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT,
    "map" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAppearance" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "rosterMembershipId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "characterPick" TEXT,
    "stats" JSONB,

    CONSTRAINT "GameAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchReport" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reportedByMembershipId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchReportEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchReportEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchMessage" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "attachmentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageStanding" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "gameWins" INTEGER NOT NULL DEFAULT 0,
    "gameLosses" INTEGER NOT NULL DEFAULT 0,
    "pointsFor" INTEGER NOT NULL DEFAULT 0,
    "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "elo" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "scope" "AnnouncementScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "leagueId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "leagueId" TEXT,
    "schoolId" TEXT,
    "competitionId" TEXT,
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueAdminship_leagueId_userId_key" ON "LeagueAdminship"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_leagueId_schoolId_key" ON "LeagueMembership"("leagueId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "School_ncesId_key" ON "School"("ncesId");

-- CreateIndex
CREATE INDEX "SchoolMembership_userId_idx" ON "SchoolMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMembership_schoolId_userId_key" ON "SchoolMembership"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GameTitle_name_key" ON "GameTitle"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GameTitle_slug_key" ON "GameTitle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GameFormat_gameTitleId_name_key" ON "GameFormat"("gameTitleId", "name");

-- CreateIndex
CREATE INDEX "Team_schoolId_idx" ON "Team"("schoolId");

-- CreateIndex
CREATE INDEX "Team_gameTitleId_idx" ON "Team"("gameTitleId");

-- CreateIndex
CREATE INDEX "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Competition_seasonId_idx" ON "Competition"("seasonId");

-- CreateIndex
CREATE INDEX "Competition_gameTitleId_skillTier_idx" ON "Competition"("gameTitleId", "skillTier");

-- CreateIndex
CREATE INDEX "Stage_competitionId_idx" ON "Stage"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_stageId_order_key" ON "Round"("stageId", "order");

-- CreateIndex
CREATE INDEX "Roster_competitionId_registrationStatus_idx" ON "Roster"("competitionId", "registrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_teamId_competitionId_key" ON "Roster"("teamId", "competitionId");

-- CreateIndex
CREATE INDEX "RosterMembership_userId_idx" ON "RosterMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterMembership_rosterId_userId_key" ON "RosterMembership"("rosterId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterModuleStatus_rosterId_moduleId_key" ON "RosterModuleStatus"("rosterId", "moduleId");

-- CreateIndex
CREATE INDEX "Match_scheduledAt_idx" ON "Match"("scheduledAt");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_stageId_idx" ON "Match"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_index_key" ON "Game"("matchId", "index");

-- CreateIndex
CREATE INDEX "GameAppearance_rosterMembershipId_idx" ON "GameAppearance"("rosterMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAppearance_gameId_rosterMembershipId_key" ON "GameAppearance"("gameId", "rosterMembershipId");

-- CreateIndex
CREATE INDEX "MatchReport_matchId_idx" ON "MatchReport"("matchId");

-- CreateIndex
CREATE INDEX "MatchMessage_matchId_createdAt_idx" ON "MatchMessage"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "StageStanding_stageId_rank_idx" ON "StageStanding"("stageId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "StageStanding_stageId_rosterId_key" ON "StageStanding"("stageId", "rosterId");

-- CreateIndex
CREATE INDEX "Announcement_scope_scopeRefId_publishedAt_idx" ON "Announcement"("scope", "scopeRefId", "publishedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_leagueId_createdAt_idx" ON "AuditLog"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_competitionId_createdAt_idx" ON "AuditLog"("competitionId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeagueAdminship" ADD CONSTRAINT "LeagueAdminship_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueAdminship" ADD CONSTRAINT "LeagueAdminship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFormat" ADD CONSTRAINT "GameFormat_gameTitleId_fkey" FOREIGN KEY ("gameTitleId") REFERENCES "GameTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_gameTitleId_fkey" FOREIGN KEY ("gameTitleId") REFERENCES "GameTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_gameFormatId_fkey" FOREIGN KEY ("gameFormatId") REFERENCES "GameFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_gameTitleId_fkey" FOREIGN KEY ("gameTitleId") REFERENCES "GameTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_gameFormatId_fkey" FOREIGN KEY ("gameFormatId") REFERENCES "GameFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationModule" ADD CONSTRAINT "RegistrationModule_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterModuleStatus" ADD CONSTRAINT "RosterModuleStatus_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterModuleStatus" ADD CONSTRAINT "RosterModuleStatus_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "RegistrationModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterModuleStatus" ADD CONSTRAINT "RosterModuleStatus_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeRosterId_fkey" FOREIGN KEY ("homeRosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayRosterId_fkey" FOREIGN KEY ("awayRosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerRosterId_fkey" FOREIGN KEY ("winnerRosterId") REFERENCES "Roster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAppearance" ADD CONSTRAINT "GameAppearance_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAppearance" ADD CONSTRAINT "GameAppearance_rosterMembershipId_fkey" FOREIGN KEY ("rosterMembershipId") REFERENCES "RosterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_reportedByMembershipId_fkey" FOREIGN KEY ("reportedByMembershipId") REFERENCES "RosterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReport" ADD CONSTRAINT "MatchReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReportEvidence" ADD CONSTRAINT "MatchReportEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMessage" ADD CONSTRAINT "MatchMessage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMessage" ADD CONSTRAINT "MatchMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageStanding" ADD CONSTRAINT "StageStanding_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageStanding" ADD CONSTRAINT "StageStanding_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
