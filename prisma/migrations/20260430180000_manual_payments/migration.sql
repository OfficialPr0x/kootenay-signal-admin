-- Add paymentSource to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentSource" TEXT;

-- Create Payment table for manual (and tracked Stripe) payments
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"        TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  "method"    TEXT NOT NULL DEFAULT 'cash',
  "reference" TEXT,
  "notes"     TEXT,
  "paidAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId")
    REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
