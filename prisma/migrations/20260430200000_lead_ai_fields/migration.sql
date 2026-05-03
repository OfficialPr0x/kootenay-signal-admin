-- AlterTable: Add AI-enrichment fields to Lead
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "websiteUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "industry"   TEXT,
  ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "analysis"   JSONB,
  ADD COLUMN IF NOT EXISTS "pitchDraft" TEXT,
  ADD COLUMN IF NOT EXISTS "pitchSentAt" TIMESTAMPTZ;
