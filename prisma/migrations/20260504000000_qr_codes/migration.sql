-- ── QR Code Tracking System ───────────────────────────────────────────────────
-- Paste this into your Supabase SQL Editor and run it.

-- ── 1. QrCode table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "QrCode" (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              TEXT        NOT NULL,
  destination       TEXT        NOT NULL,
  "trackingCode"    TEXT        NOT NULL UNIQUE,
  "logoUrl"         TEXT,
  "foregroundColor" TEXT        NOT NULL DEFAULT '#e87f24',
  "backgroundColor" TEXT        NOT NULL DEFAULT '#06080a',
  "dotStyle"        TEXT        NOT NULL DEFAULT 'rounded',
  "cornerStyle"     TEXT        NOT NULL DEFAULT 'extra-rounded',
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "totalClicks"     INTEGER     NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. QrCodeClick table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "QrCodeClick" (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "qrCodeId"    TEXT        NOT NULL REFERENCES "QrCode"(id) ON DELETE CASCADE,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  referer       TEXT,
  country       TEXT,
  city          TEXT,
  region        TEXT,
  "clickedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. updatedAt trigger ──────────────────────────────────────────────────────
-- (reuses the function from the ad creative migration if it already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "QrCode_updatedAt"
  BEFORE UPDATE ON "QrCode"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 4. Increment clicks RPC (called by the tracking route) ───────────────────
CREATE OR REPLACE FUNCTION increment_qr_clicks(qr_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE "QrCode" SET "totalClicks" = "totalClicks" + 1 WHERE id = qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "QrCode_trackingCode_idx"  ON "QrCode"        ("trackingCode");
CREATE INDEX IF NOT EXISTS "QrCodeClick_qrCodeId_idx" ON "QrCodeClick"   ("qrCodeId");
CREATE INDEX IF NOT EXISTS "QrCodeClick_clickedAt_idx" ON "QrCodeClick"  ("clickedAt" DESC);
