-- CreateEnum
CREATE TYPE "LeaderboardPeriodEnum" AS ENUM ('DAILY', 'WEEKLY', 'ALL_TIME');

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "case_id" UUID,
    "points" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "event_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "min_points" INTEGER NOT NULL,
    "max_points" INTEGER,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period" "LeaderboardPeriodEnum" NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "expert_id" UUID NOT NULL,
    "total_points" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "points_transactions_event_id_key" ON "points_transactions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_expert_id_badge_id_key" ON "user_badges"("expert_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_name_key" ON "levels"("name");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
