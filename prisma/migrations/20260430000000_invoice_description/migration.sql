-- AlterTable: add optional description to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "description" TEXT;
