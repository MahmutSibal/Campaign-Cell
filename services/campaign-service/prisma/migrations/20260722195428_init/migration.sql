-- CreateEnum
CREATE TYPE "CampaignTypeEnum" AS ENUM ('EK_PAKET', 'TARIFE_YUKSELTME', 'CIHAZ_FIRSATI', 'SADAKAT');

-- CreateEnum
CREATE TYPE "TargetSegmentEnum" AS ENUM ('YUKSEK_DEGER', 'RISKLI_KAYIP', 'YENI_ABONE', 'PASIF', 'BELIRSIZ');

-- CreateEnum
CREATE TYPE "CampaignStatusEnum" AS ENUM ('DRAFT', 'ACTIVE', 'MANUAL_OPTIMIZATION_REQUIRED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CasePriorityEnum" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK');

-- CreateEnum
CREATE TYPE "CaseStatusEnum" AS ENUM ('YENI', 'ATANDI', 'OPTIMIZE_EDILIYOR', 'TEST_EDILIYOR', 'TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI');

-- CreateEnum
CREATE TYPE "AssignedByEnum" AS ENUM ('AI', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "FeedbackResponseEnum" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "CampaignTypeEnum" NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "target_segment" "TargetSegmentEnum",
    "start_date" DATE,
    "end_date" DATE,
    "status" "CampaignStatusEnum" NOT NULL DEFAULT 'DRAFT',
    "ai_recommendation_score" DECIMAL(4,3),
    "ai_conversion_probability" DECIMAL(4,3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_code" VARCHAR(20) NOT NULL,
    "campaign_id" UUID NOT NULL,
    "segment" VARCHAR(20) NOT NULL,
    "priority" "CasePriorityEnum" NOT NULL,
    "status" "CaseStatusEnum" NOT NULL DEFAULT 'YENI',
    "assigned_expert_id" UUID,
    "ai_score" DECIMAL(4,3),
    "ai_conversion_prob" DECIMAL(4,3),
    "ai_reasoning" TEXT,
    "is_ai_misclassified" BOOLEAN NOT NULL DEFAULT false,
    "optimization_note" TEXT,
    "sla_deadline" TIMESTAMPTZ NOT NULL,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_warned" BOOLEAN NOT NULL DEFAULT false,
    "conversion_lift" DECIMAL(5,3),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "optimization_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "expert_id" UUID NOT NULL,
    "assignment_score" DECIMAL(4,3),
    "assigned_by" "AssignedByEnum" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "description" TEXT,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30) NOT NULL,
    "changed_by" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_experiments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "variant_a_desc" TEXT,
    "variant_b_desc" TEXT,
    "variant_a_conversion" DECIMAL(4,3),
    "variant_b_conversion" DECIMAL(4,3),
    "winner" VARCHAR(1),
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "ab_test_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriber_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "response" "FeedbackResponseEnum" NOT NULL,
    "rejection_reason" TEXT,
    "rating" SMALLINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriber_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_code_key" ON "campaigns"("code");

-- CreateIndex
CREATE UNIQUE INDEX "optimization_cases_case_code_key" ON "optimization_cases"("case_code");

-- CreateIndex
CREATE UNIQUE INDEX "segments_name_key" ON "segments"("name");

-- AddForeignKey
ALTER TABLE "optimization_cases" ADD CONSTRAINT "optimization_cases_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_assignments" ADD CONSTRAINT "campaign_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "optimization_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_history" ADD CONSTRAINT "campaign_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "optimization_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_experiments" ADD CONSTRAINT "ab_test_experiments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "optimization_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_feedback" ADD CONSTRAINT "subscriber_feedback_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
