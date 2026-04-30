-- Add Stripe integration fields and isOneOff flag to Service table
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "isOneOff"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId"   TEXT;

-- Seed all Kootenay Signal products
-- One-off setup services
INSERT INTO "Service" (id, name, description, price, features, "isActive", "isOneOff")
VALUES
  (gen_random_uuid(), 'Website Build',
   'Professional website built and handed off. One-time setup — no ongoing management.',
   150, '["Mobile-responsive design","Up to 5 pages","Contact form","Google Analytics","Handed off to client"]',
   true, true),

  (gen_random_uuid(), 'Google Ranking Boost',
   'One-time SEO foundation setup. Keywords, meta tags, schema markup, alt tags.',
   97, '["Keyword research","Meta title & description","Schema markup","Alt tag optimization","Google Search Console setup"]',
   true, true),

  (gen_random_uuid(), 'Missed Call Text Back',
   'Automated SMS reply when a call is missed. One-time setup.',
   147, '["Auto-SMS on missed call","Custom message template","GHL/GoHighLevel integration","Testing & go-live","Setup documentation"]',
   true, true),

  (gen_random_uuid(), 'AI Quote Assistant',
   'AI-powered quote or inquiry system for your business. One-time setup.',
   97, '["Custom prompt engineering","Quote/inquiry workflow","Website embed or link","Testing & refinement","Handoff docs"]',
   true, true),

  (gen_random_uuid(), 'Google Business Optimization',
   'Full GBP audit and optimization. Categories, description, photos, keywords.',
   97, '["Category optimization","Business description rewrite","Photo audit & uploads","Q&A seeding","Keyword-rich content"]',
   true, true)
ON CONFLICT (name) DO NOTHING;

-- Ensure existing recurring services have isOneOff = false (default)
UPDATE "Service" SET "isOneOff" = false WHERE "isOneOff" IS NULL;
