ALTER TYPE "public"."AnalysisStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "public"."analyses"
ADD COLUMN "cancellation_requested" BOOLEAN NOT NULL DEFAULT false;
