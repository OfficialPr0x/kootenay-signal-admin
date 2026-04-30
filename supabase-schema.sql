-- ============================================================
-- Kootenay Signal Admin — Complete Supabase (PostgreSQL) Schema
-- Generated from Prisma schema for E2E production deployment
-- ============================================================
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Helper: generate cuid-like IDs ──
-- Supabase doesn't have cuid natively. We use uuid_generate_v4() as default IDs.
-- If you prefer cuid, install pg_cuid extension or use uuid everywhere.

-- ============================================================
-- CORE BUSINESS MODELS
-- ============================================================

CREATE TABLE "User" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "email"     TEXT NOT NULL UNIQUE,
  "password"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Lead" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "phone"     TEXT,
  "business"  TEXT,
  "message"   TEXT,
  "source"    TEXT NOT NULL DEFAULT 'website',
  "status"    TEXT NOT NULL DEFAULT 'new',
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: new, contacted, qualified, converted, lost

CREATE TABLE "Client" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"        TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "phone"       TEXT,
  "business"    TEXT NOT NULL,
  "website"     TEXT,
  "plan"        TEXT NOT NULL DEFAULT 'SignalCore',
  "status"      TEXT NOT NULL DEFAULT 'active',
  "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startDate"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: active, paused, churned

CREATE TABLE "Invoice" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "clientId"  TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "amount"    DOUBLE PRECISION NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'pending',
  "dueDate"   TIMESTAMPTZ NOT NULL,
  "paidAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: pending, paid, overdue

CREATE INDEX "idx_invoice_clientId" ON "Invoice"("clientId");

CREATE TABLE "Service" (
  "id"               TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"             TEXT NOT NULL UNIQUE,
  "description"      TEXT NOT NULL,
  "price"            DOUBLE PRECISION NOT NULL,
  "features"         TEXT NOT NULL,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "isOneOff"         BOOLEAN NOT NULL DEFAULT false,
  "stripeProductId"  TEXT,
  "stripePriceId"    TEXT
);

CREATE TABLE "EmailLog" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "to"        TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'sent',
  "resendId"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MAILBOX & DOMAIN MODELS
-- ============================================================

CREATE TABLE "EmailAccount" (
  "id"              TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "email"           TEXT NOT NULL UNIQUE,
  "name"            TEXT NOT NULL,
  "isDefault"       BOOLEAN NOT NULL DEFAULT false,
  "domainId"        TEXT,
  "warmupProfileId" TEXT,
  "warmupStatus"    TEXT NOT NULL DEFAULT 'none',
  "dailySendLimit"  INTEGER NOT NULL DEFAULT 50,
  "currentVolume"   INTEGER NOT NULL DEFAULT 0,
  "trustScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- warmupStatus: none, warming, stable, at_risk, paused

CREATE INDEX "idx_emailaccount_email" ON "EmailAccount"("email");

-- ============================================================
-- EMAIL MESSAGE MODELS
-- ============================================================

CREATE TABLE "EmailMessage" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "resendId"   TEXT UNIQUE,
  "direction"  TEXT NOT NULL,
  "fromEmail"  TEXT NOT NULL,
  "fromName"   TEXT,
  "toEmail"    TEXT NOT NULL,
  "toName"     TEXT,
  "cc"         TEXT,
  "bcc"        TEXT,
  "subject"    TEXT NOT NULL,
  "bodyHtml"   TEXT,
  "bodyText"   TEXT,
  "status"     TEXT NOT NULL DEFAULT 'sent',
  "isRead"     BOOLEAN NOT NULL DEFAULT false,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "isStarred"  BOOLEAN NOT NULL DEFAULT false,
  "threadId"   TEXT,
  "inReplyTo"  TEXT,
  "tags"       TEXT,
  "campaignId" TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: sent, delivered, opened, clicked, bounced, failed, received
-- direction: inbound, outbound

CREATE INDEX "idx_emailmessage_resendId" ON "EmailMessage"("resendId");
CREATE INDEX "idx_emailmessage_campaignId" ON "EmailMessage"("campaignId");
CREATE INDEX "idx_emailmessage_threadId" ON "EmailMessage"("threadId");
CREATE INDEX "idx_emailmessage_direction" ON "EmailMessage"("direction");
CREATE INDEX "idx_emailmessage_status" ON "EmailMessage"("status");

CREATE TABLE "EmailEvent" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "messageId" TEXT NOT NULL REFERENCES "EmailMessage"("id") ON DELETE CASCADE,
  "type"      TEXT NOT NULL,
  "metadata"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- type: sent, delivered, opened, clicked, bounced, complained

CREATE INDEX "idx_emailevent_messageId" ON "EmailEvent"("messageId");

CREATE TABLE "EmailTemplate" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"      TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "bodyHtml"  TEXT NOT NULL,
  "category"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CAMPAIGN MODELS
-- ============================================================

CREATE TABLE "EmailCampaign" (
  "id"           TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'draft',
  "subject"      TEXT,
  "bodyHtml"     TEXT,
  "tags"         TEXT,
  "sendWindow"   TEXT,
  "throttle"     INTEGER,
  "stopOnReply"  BOOLEAN NOT NULL DEFAULT true,
  "stopOnBounce" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: draft, active, paused, completed
-- sendWindow: JSON { startHour, endHour, timezone, days[] }

-- Add foreign key for EmailMessage.campaignId after EmailCampaign exists
ALTER TABLE "EmailMessage" ADD CONSTRAINT "fk_emailmessage_campaign"
  FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE SET NULL;

CREATE TABLE "EmailCampaignStep" (
  "id"            TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "campaignId"    TEXT NOT NULL REFERENCES "EmailCampaign"("id") ON DELETE CASCADE,
  "stepOrder"     INTEGER NOT NULL,
  "subject"       TEXT NOT NULL,
  "bodyHtml"      TEXT NOT NULL,
  "delayDays"     INTEGER NOT NULL DEFAULT 0,
  "sendCondition" TEXT,
  "aiPersonalize" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- sendCondition: JSON { type: "opened"|"clicked"|"no_reply", stepRef }

CREATE INDEX "idx_campaignstep_campaignId" ON "EmailCampaignStep"("campaignId");

CREATE TABLE "CampaignRun" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "campaignId" TEXT NOT NULL REFERENCES "EmailCampaign"("id") ON DELETE CASCADE,
  "stepOrder"  INTEGER NOT NULL,
  "contactId"  TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'pending',
  "sentAt"     TIMESTAMPTZ,
  "metadata"   TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: pending, sent, failed, skipped

CREATE INDEX "idx_campaignrun_campaignId" ON "CampaignRun"("campaignId");

CREATE TABLE "CampaignMailboxAssignment" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "campaignId" TEXT NOT NULL REFERENCES "EmailCampaign"("id") ON DELETE CASCADE,
  "mailboxId"  TEXT NOT NULL REFERENCES "EmailAccount"("id") ON DELETE CASCADE,
  "weight"     INTEGER NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_campaignmailbox_campaignId" ON "CampaignMailboxAssignment"("campaignId");
CREATE INDEX "idx_campaignmailbox_mailboxId" ON "CampaignMailboxAssignment"("mailboxId");

-- ============================================================
-- CONTACT / CRM MODELS
-- ============================================================

CREATE TABLE "EmailContact" (
  "id"            TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "email"         TEXT NOT NULL UNIQUE,
  "name"          TEXT,
  "phone"         TEXT,
  "company"       TEXT,
  "companyId"     TEXT,
  "tags"          TEXT,
  "status"        TEXT NOT NULL DEFAULT 'subscribed',
  "source"        TEXT,
  "pipelineStage" TEXT NOT NULL DEFAULT 'new',
  "leadScore"     INTEGER NOT NULL DEFAULT 0,
  "lastTouchAt"   TIMESTAMPTZ,
  "nextActionAt"  TIMESTAMPTZ,
  "nextAction"    TEXT,
  "owner"         TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: subscribed, unsubscribed, bounced
-- source: website, import, manual, inbound, campaign
-- pipelineStage: new, contacted, replied, qualified, meeting_booked, proposal, won, lost

CREATE INDEX "idx_emailcontact_email" ON "EmailContact"("email");
CREATE INDEX "idx_emailcontact_pipelineStage" ON "EmailContact"("pipelineStage");
CREATE INDEX "idx_emailcontact_status" ON "EmailContact"("status");

-- CampaignContact depends on both EmailCampaign and EmailContact
CREATE TABLE "CampaignContact" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "campaignId"  TEXT NOT NULL REFERENCES "EmailCampaign"("id") ON DELETE CASCADE,
  "contactId"   TEXT NOT NULL REFERENCES "EmailContact"("id") ON DELETE CASCADE,
  "status"      TEXT NOT NULL DEFAULT 'active',
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: active, replied, bounced, unsubscribed, completed

CREATE INDEX "idx_campaigncontact_campaignId" ON "CampaignContact"("campaignId");
CREATE INDEX "idx_campaigncontact_contactId" ON "CampaignContact"("contactId");

CREATE TABLE "Company" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"      TEXT NOT NULL,
  "domain"    TEXT UNIQUE,
  "industry"  TEXT,
  "size"      TEXT,
  "website"   TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "ContactActivity" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "contactId" TEXT NOT NULL REFERENCES "EmailContact"("id") ON DELETE CASCADE,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "metadata"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- type: email_sent, email_received, email_opened, email_clicked, reply, stage_change, note, task

CREATE INDEX "idx_contactactivity_contactId" ON "ContactActivity"("contactId");

CREATE TABLE "LeadScoreLog" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "contactId" TEXT NOT NULL REFERENCES "EmailContact"("id") ON DELETE CASCADE,
  "score"     INTEGER NOT NULL,
  "reason"    TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_leadscorelog_contactId" ON "LeadScoreLog"("contactId");

CREATE TABLE "Pipeline" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"      TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "PipelineStage" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "pipelineId" TEXT NOT NULL REFERENCES "Pipeline"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "order"      INTEGER NOT NULL,
  "color"      TEXT NOT NULL DEFAULT '#3b82f6',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_pipelinestage_pipelineId" ON "PipelineStage"("pipelineId");

-- ============================================================
-- AI INBOX MODELS
-- ============================================================

CREATE TABLE "AiClassification" (
  "id"              TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "messageId"       TEXT NOT NULL REFERENCES "EmailMessage"("id") ON DELETE CASCADE,
  "intent"          TEXT NOT NULL,
  "sentiment"       TEXT,
  "urgency"         TEXT NOT NULL DEFAULT 'normal',
  "confidence"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "summary"         TEXT,
  "entities"        TEXT,
  "suggestedAction" TEXT,
  "label"           TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- intent: lead, existing_client, follow_up, spam, partnership, support, quote_request, not_interested
-- sentiment: positive, neutral, negative
-- urgency: low, normal, high, urgent
-- suggestedAction: reply, schedule_followup, add_to_campaign, create_contact, ignore

CREATE INDEX "idx_aiclassification_messageId" ON "AiClassification"("messageId");

CREATE TABLE "AiDraft" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "messageId" TEXT NOT NULL REFERENCES "EmailMessage"("id") ON DELETE CASCADE,
  "subject"   TEXT,
  "bodyHtml"  TEXT NOT NULL,
  "bodyText"  TEXT,
  "mode"      TEXT NOT NULL DEFAULT 'manual',
  "status"    TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- mode: manual, approval_required, autonomous
-- status: draft, approved, sent, rejected

CREATE INDEX "idx_aidraft_messageId" ON "AiDraft"("messageId");

CREATE TABLE "ReplyRule" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"      TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "template"  TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "priority"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- condition: JSON { field, operator, value }
-- action: auto_reply, draft, classify, tag, assign

CREATE TABLE "ApprovalQueue" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "type"        TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "payload"     TEXT NOT NULL,
  "reviewedBy"  TEXT,
  "reviewedAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- type: ai_reply, campaign_send, automation_action
-- status: pending, approved, rejected

-- ============================================================
-- WARMUP MODELS
-- ============================================================

CREATE TABLE "WarmupProfile" (
  "id"              TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"            TEXT NOT NULL,
  "startVolume"     INTEGER NOT NULL DEFAULT 2,
  "maxVolume"       INTEGER NOT NULL DEFAULT 40,
  "rampIncrement"   INTEGER NOT NULL DEFAULT 2,
  "rampCondition"   TEXT,
  "contentVariants" TEXT,
  "seedAddresses"   TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- rampCondition: JSON { maxBounceRate, minReplyRate, maxComplaintRate }
-- contentVariants: JSON array of { subject, body } pairs
-- seedAddresses: comma-separated email addresses

CREATE TABLE "WarmupJob" (
  "id"            TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "mailboxId"     TEXT NOT NULL REFERENCES "EmailAccount"("id") ON DELETE CASCADE,
  "profileId"     TEXT NOT NULL REFERENCES "WarmupProfile"("id") ON DELETE CASCADE,
  "status"        TEXT NOT NULL DEFAULT 'active',
  "currentVolume" INTEGER NOT NULL DEFAULT 0,
  "totalSent"     INTEGER NOT NULL DEFAULT 0,
  "totalReplies"  INTEGER NOT NULL DEFAULT 0,
  "totalBounces"  INTEGER NOT NULL DEFAULT 0,
  "lastRunAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: active, paused, completed, failed

CREATE INDEX "idx_warmupjob_mailboxId" ON "WarmupJob"("mailboxId");
CREATE INDEX "idx_warmupjob_profileId" ON "WarmupJob"("profileId");
CREATE INDEX "idx_warmupjob_status" ON "WarmupJob"("status");

CREATE TABLE "WarmupMessage" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "jobId"     TEXT NOT NULL REFERENCES "WarmupJob"("id") ON DELETE CASCADE,
  "mailboxId" TEXT NOT NULL REFERENCES "EmailAccount"("id") ON DELETE CASCADE,
  "toEmail"   TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'sent',
  "resendId"  TEXT,
  "sentAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: sent, delivered, opened, replied, bounced

CREATE INDEX "idx_warmupmessage_jobId" ON "WarmupMessage"("jobId");
CREATE INDEX "idx_warmupmessage_mailboxId" ON "WarmupMessage"("mailboxId");
CREATE INDEX "idx_warmupmessage_status" ON "WarmupMessage"("status");
CREATE INDEX "idx_warmupmessage_sentAt" ON "WarmupMessage"("sentAt");

CREATE TABLE "MailboxHealthSnapshot" (
  "id"            TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "mailboxId"     TEXT NOT NULL REFERENCES "EmailAccount"("id") ON DELETE CASCADE,
  "trustScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bounceRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "replyRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "openRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "complaintRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spamRiskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dailyVolume"   INTEGER NOT NULL DEFAULT 0,
  "dnsHealthy"    BOOLEAN NOT NULL DEFAULT true,
  "spfStatus"     TEXT NOT NULL DEFAULT 'unknown',
  "dkimStatus"    TEXT NOT NULL DEFAULT 'unknown',
  "dmarcStatus"   TEXT NOT NULL DEFAULT 'unknown',
  "metadata"      TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- spfStatus, dkimStatus, dmarcStatus: pass, fail, unknown

CREATE INDEX "idx_healthsnapshot_mailboxId" ON "MailboxHealthSnapshot"("mailboxId");
CREATE INDEX "idx_healthsnapshot_createdAt" ON "MailboxHealthSnapshot"("createdAt");

-- ============================================================
-- AUTOMATION / WORKFLOW MODELS
-- ============================================================

CREATE TABLE "Workflow" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'draft',
  "trigger"     TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: draft, active, paused
-- trigger: JSON { type, conditions }

CREATE TABLE "WorkflowNode" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "workflowId" TEXT NOT NULL REFERENCES "Workflow"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "config"     TEXT NOT NULL,
  "posX"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "posY"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- type: trigger, action, condition, delay, ai
-- config: JSON node-specific config

CREATE INDEX "idx_workflownode_workflowId" ON "WorkflowNode"("workflowId");

CREATE TABLE "WorkflowEdge" (
  "id"         TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "workflowId" TEXT NOT NULL REFERENCES "Workflow"("id") ON DELETE CASCADE,
  "sourceId"   TEXT NOT NULL,
  "targetId"   TEXT NOT NULL,
  "condition"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_workflowedge_workflowId" ON "WorkflowEdge"("workflowId");

CREATE TABLE "WorkflowRun" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "workflowId"  TEXT NOT NULL REFERENCES "Workflow"("id") ON DELETE CASCADE,
  "status"      TEXT NOT NULL DEFAULT 'running',
  "triggeredBy" TEXT,
  "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: running, completed, failed, cancelled

CREATE INDEX "idx_workflowrun_workflowId" ON "WorkflowRun"("workflowId");

CREATE TABLE "WorkflowRunLog" (
  "id"        TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "runId"     TEXT NOT NULL REFERENCES "WorkflowRun"("id") ON DELETE CASCADE,
  "nodeId"    TEXT,
  "action"    TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'success',
  "message"   TEXT,
  "metadata"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: success, failed, skipped

CREATE INDEX "idx_workflowrunlog_runId" ON "WorkflowRunLog"("runId");

-- ============================================================
-- DELIVERABILITY MODELS
-- ============================================================

CREATE TABLE "DeliverabilitySnapshot" (
  "id"              TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "domain"          TEXT NOT NULL,
  "overallScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spfStatus"       TEXT NOT NULL DEFAULT 'unknown',
  "dkimStatus"      TEXT NOT NULL DEFAULT 'unknown',
  "dmarcStatus"     TEXT NOT NULL DEFAULT 'unknown',
  "bounceRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "complaintRate"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unsubscribeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "replyRate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sendingVolume"   INTEGER NOT NULL DEFAULT 0,
  "blacklistStatus" TEXT,
  "riskAlerts"      TEXT,
  "metadata"        TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_deliverability_domain" ON "DeliverabilitySnapshot"("domain");
CREATE INDEX "idx_deliverability_createdAt" ON "DeliverabilitySnapshot"("createdAt");

-- ============================================================
-- AI ACTION LOG
-- ============================================================

CREATE TABLE "AiAction" (
  "id"          TEXT PRIMARY KEY DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  "type"        TEXT NOT NULL,
  "referenceId" TEXT,
  "input"       TEXT,
  "output"      TEXT,
  "confidence"  DOUBLE PRECISION,
  "status"      TEXT NOT NULL DEFAULT 'completed',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- type: classify, draft_reply, score_lead, summarize, personalize
-- status: completed, failed, pending

CREATE INDEX "idx_aiaction_type" ON "AiAction"("type");

-- ============================================================
-- AUTO-UPDATE TRIGGER FOR updatedAt
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updatedAt
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updatedAt'
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Optional, enable per table as needed
-- ============================================================

-- Example: Enable RLS on User table
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own data" ON "User"
--   FOR SELECT USING (auth.uid()::text = id);

-- ============================================================
-- SEED DATA — Default admin user (password: Koots@2026)
-- ============================================================
-- Note: Hash the password with bcrypt in your application before inserting.
-- This is a placeholder — the app's /api/auth/setup endpoint handles this.

-- INSERT INTO "User" ("email", "password", "name", "role")
-- VALUES ('jaryd@kootenaysignal.com', '$2b$10$HASH_HERE', 'Jaryd', 'admin');

-- ============================================================
-- DONE — All 30+ tables created with foreign keys, indexes,
-- and auto-updatedAt triggers. Ready for E2E operation.
-- ============================================================
