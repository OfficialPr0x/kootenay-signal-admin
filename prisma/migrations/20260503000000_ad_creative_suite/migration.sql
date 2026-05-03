-- ── Ad Creative Suite ─────────────────────────────────────────────────────────
-- Paste this entire file into your Supabase SQL Editor and run it.

-- ── 1. Storage Buckets ────────────────────────────────────────────────────────
-- Brand reference images (logos, mockups, color swatches)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-brand-assets',
  'ad-brand-assets',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Generated ad creatives (persisted output images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-creatives',
  'ad-creatives',
  true,
  20971520,  -- 20 MB per file
  ARRAY['image/png','image/jpeg','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ── 2. Storage RLS Policies ───────────────────────────────────────────────────
-- Allow public read (images are served publicly)
CREATE POLICY "Public read ad-brand-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-brand-assets');

CREATE POLICY "Public read ad-creatives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-creatives');

-- Allow all operations from service role (server-side only access)
CREATE POLICY "Service write ad-brand-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ad-brand-assets');

CREATE POLICY "Service write ad-creatives"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ad-creatives');

CREATE POLICY "Service delete ad-brand-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ad-brand-assets');

CREATE POLICY "Service delete ad-creatives"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ad-creatives');

-- ── 3. AdBrandProfile ─────────────────────────────────────────────────────────
-- Stores Kootenay Signal brand knowledge — one active row drives every generation.
CREATE TABLE IF NOT EXISTS "AdBrandProfile" (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT        NOT NULL DEFAULT 'Kootenay Signal',
  tagline          TEXT,
  "brandVoice"     TEXT,
  "colorPalette"   TEXT,        -- JSON: [{ "name": "Signal Orange", "hex": "#e87f24" }]
  "visualStyle"    TEXT,
  "targetAudience" TEXT,
  "doList"         TEXT,        -- newline-separated rules (e.g. "Use dark backgrounds\nUse orange accents")
  "dontList"       TEXT,        -- newline-separated rules
  "extraContext"   TEXT,
  "isActive"       BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. AdBrandAsset ───────────────────────────────────────────────────────────
-- Reference images: logos, mockups, color swatches, inspiration
CREATE TABLE IF NOT EXISTS "AdBrandAsset" (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "brandProfileId" TEXT        NOT NULL REFERENCES "AdBrandProfile"(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  "fileUrl"        TEXT        NOT NULL,   -- Supabase Storage public URL
  "mimeType"       TEXT        NOT NULL DEFAULT 'image/png',
  "assetType"      TEXT        NOT NULL DEFAULT 'reference',  -- logo | reference | mockup | color-swatch
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. AdCreative ─────────────────────────────────────────────────────────────
-- History of every generated image (saved to Supabase Storage)
CREATE TABLE IF NOT EXISTS "AdCreative" (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prompt           TEXT        NOT NULL,
  "revisedPrompt"  TEXT,
  "brandedPrompt"  TEXT,        -- full prompt sent to API (brand context prepended)
  size             TEXT        NOT NULL DEFAULT '1024x1024',
  quality          TEXT        NOT NULL DEFAULT 'high',
  "imageUrl"       TEXT,        -- Supabase Storage public URL
  "brandProfileId" TEXT        REFERENCES "AdBrandProfile"(id) ON DELETE SET NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. updatedAt trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AdBrandProfile_updatedAt"
  BEFORE UPDATE ON "AdBrandProfile"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 7. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "AdBrandAsset_brandProfileId_idx" ON "AdBrandAsset" ("brandProfileId");
CREATE INDEX IF NOT EXISTS "AdCreative_brandProfileId_idx"   ON "AdCreative"   ("brandProfileId");
CREATE INDEX IF NOT EXISTS "AdCreative_createdAt_idx"        ON "AdCreative"   ("createdAt" DESC);

-- ── 8. Seed: Kootenay Signal Brand Profile ────────────────────────────────────
INSERT INTO "AdBrandProfile" (
  name,
  tagline,
  "brandVoice",
  "colorPalette",
  "visualStyle",
  "targetAudience",
  "doList",
  "dontList",
  "extraContext"
) VALUES (
  'Kootenay Signal',

  'Helping local businesses grow through smart digital marketing',

  'Bold, confident, and results-driven. Professional but approachable. Focused on growth and measurable ROI. Never overly salesy — we lead with value and expertise. Think Stripe or Linear in tone: clear, direct, premium.',

  '[{"name":"Signal Orange","hex":"#e87f24"},{"name":"Deep Black","hex":"#06080a"},{"name":"Card Dark","hex":"#0c0e12"},{"name":"Card Elevated","hex":"#141720"},{"name":"Foreground","hex":"#e8eaed"},{"name":"Muted","hex":"#5c6370"},{"name":"Border","hex":"#1a1e25"}]',

  'Dark near-black backgrounds (#06080a). Signal Orange (#e87f24) is the single primary accent colour — use it for highlights, glows, borders, and focal elements. High contrast. Clean and minimal layouts. Modern sans-serif typography. Tech-forward, premium aesthetic. Think Stripe, Vercel, and Linear — but with an orange accent instead of blue. Subtle glows and gradients are welcome; flat stock-photo styles are not.',

  'Small and medium-sized businesses in British Columbia and the Kootenay region of Canada. Business owners who want real, measurable growth — not fluff. Key industries: trades, retail, hospitality, professional services, local brands.',

  E'Use dark or near-black backgrounds\nUse #e87f24 Signal Orange as the primary accent\nKeep compositions minimal and uncluttered\nUse high contrast between foreground and background elements\nAdd subtle orange glow or light effects around key focal points\nMake the design feel premium and modern\nLeave adequate negative space\nUse clean geometric or abstract shapes',

  E'Use white or very light backgrounds\nUse other brand colours as the primary (no dominant red, blue, green)\nAdd excessive text overlays that clutter the image\nMake it look cheap, generic, or clip-art-ish\nUse gradients that clash with the dark theme\nUse outdated stock photography styles\nOvercrowd the composition',

  'Kootenay Signal is a boutique digital marketing agency based in British Columbia, Canada. Core services: SEO, Google/Meta paid ads, email marketing, web design, lead generation, and CRM automation. The brand identity revolves around signal strength, precision, and measurable results. The logo is an upward bar-chart signal icon in Signal Orange on dark. All brand assets should reinforce the "signal" metaphor — clarity, reach, strength.'
) ON CONFLICT DO NOTHING;
