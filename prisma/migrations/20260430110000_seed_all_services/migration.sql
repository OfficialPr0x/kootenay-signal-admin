-- ══════════════════════════════════════════════════════
-- Full Kootenay Signal Service Catalog
-- Run this in Supabase SQL Editor
-- Safe to re-run (ON CONFLICT DO UPDATE)
-- ══════════════════════════════════════════════════════

-- Ensure new columns exist (safe if already run)
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "isOneOff"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId"   TEXT;

-- Remove old placeholder services we don't sell anymore
DELETE FROM "Service" WHERE name IN ('SmartNav™');

-- ── ONE-TIME SETUP SERVICES ──────────────────────────

INSERT INTO "Service" (id, name, description, price, features, "isActive", "isOneOff")
VALUES
  (gen_random_uuid(),
   'Website Build',
   'Professional website built and handed off. One-time setup — no ongoing management included.',
   150,
   '["Mobile-responsive design","Up to 5 pages","Contact form","Google Analytics setup","Handed off to client","One-time setup · No ongoing management"]',
   true, true),

  (gen_random_uuid(),
   'Google Ranking Boost',
   'One-time SEO foundation setup. Keyword insertion, meta titles & descriptions, H1/H2 structure, schema, image alt tags, internal linking.',
   97,
   '["Keyword insertion (service + city)","Meta titles & descriptions","H1/H2 structure optimization","Local business schema markup","Image alt tag optimization","Internal linking setup","One-time setup · No ongoing management"]',
   true, true),

  (gen_random_uuid(),
   'Missed Call Text Back',
   'Auto-SMS reply when a call is missed. Twilio/Zapier integration, missed call trigger, custom message template.',
   147,
   '["Twilio or similar setup","Missed call trigger automation","Custom SMS message template","Zapier / webhook integration","Testing & go-live","One-time setup · No ongoing management"]',
   true, true),

  (gen_random_uuid(),
   'AI Quote Assistant',
   'Structured prompt system or mini tool for generating quotes and proposals. Inputs → outputs. One-time build.',
   97,
   '["Custom prompt engineering","Quote/inquiry workflow","Website embed or shareable link","Testing & refinement","Handoff documentation","One-time setup · No ongoing management"]',
   true, true),

  (gen_random_uuid(),
   'Google Business Optimization',
   'Full GBP audit and optimization. Categories, description, service areas, keyword injection, posting template, review strategy.',
   97,
   '["Category optimization","Business description rewrite","Service area configuration","Keyword injection","Posting template","Review strategy guide","One-time setup · No ongoing management"]',
   true, true)

ON CONFLICT (name) DO UPDATE SET
  description   = EXCLUDED.description,
  price         = EXCLUDED.price,
  features      = EXCLUDED.features,
  "isActive"    = EXCLUDED."isActive",
  "isOneOff"    = EXCLUDED."isOneOff";

-- ── MONTHLY RETAINER SERVICES ────────────────────────

INSERT INTO "Service" (id, name, description, price, features, "isActive", "isOneOff")
VALUES
  (gen_random_uuid(),
   'SEO Retainer',
   'Ongoing search visibility management. Backlinking, content strategy, ranking monitoring, technical SEO — fully managed monthly.',
   997,
   '["Ongoing backlink acquisition","Monthly content strategy","Keyword rank tracking","Technical SEO audits","Google Search Console monitoring","Monthly reporting"]',
   true, false),

  (gen_random_uuid(),
   'Automation Management',
   'Ongoing automation and workflow management. New automations, monitoring, optimization — your systems always running.',
   497,
   '["Workflow monitoring & optimization","New automation builds","Missed call / lead response systems","CRM integration maintenance","Monthly review call"]',
   true, false),

  (gen_random_uuid(),
   'Ads Management',
   'Fully managed Google and Meta advertising. Campaign build, optimization, reporting, and scaling — all done for you.',
   1000,
   '["Google Ads campaign management","Meta (Facebook/Instagram) ads","Ad copy & creative direction","Audience targeting & optimization","Weekly performance reporting","Monthly strategy review"]',
   true, false),

  (gen_random_uuid(),
   'SignalCore™',
   'Foundation retainer for regional search dominance. Google Business management, local citations, core SEO — all handled monthly.',
   1500,
   '["Google Business Profile management","Local citation building","Core SEO maintenance","Monthly reporting","Keyword tracking"]',
   true, false),

  (gen_random_uuid(),
   'SearchVault™',
   'Advanced search visibility retainer. Everything in SignalCore plus content strategy, backlink campaigns, and competitive analysis.',
   2500,
   '["Everything in SignalCore","Content strategy & creation","Backlink acquisition","Competitive analysis","Schema markup implementation","Technical SEO audits"]',
   true, false),

  (gen_random_uuid(),
   'SearchSync™',
   'Full multi-platform sync retainer. Consistent presence across all search platforms, directories, review sites, and social.',
   3000,
   '["Everything in SearchVault","Multi-platform sync","Social media integration","Review management","Local ads management","Priority support"]',
   true, false)

ON CONFLICT (name) DO UPDATE SET
  description   = EXCLUDED.description,
  price         = EXCLUDED.price,
  features      = EXCLUDED.features,
  "isActive"    = EXCLUDED."isActive",
  "isOneOff"    = EXCLUDED."isOneOff";
