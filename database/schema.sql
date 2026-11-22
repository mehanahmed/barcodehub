-- ============================================================================
-- BarcodeHub PostgreSQL Database Schema
-- Complete relational schema matching BarcodeHub SaaS architecture
-- ============================================================================

-- Enable pgcrypto / uuid extension for primary key generation (if supported)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
    -- pgcrypto not available in this environment; gen_random_uuid() is built-in in Postgres 13+
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Users table (ziteUsers / platform auth accounts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ziteUsers" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "name" VARCHAR(255),
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "image" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Sign-in by phone: stored normalized (+8801XXXXXXXXX or E.164), unique; NULL for accounts made before phone sign-up.
ALTER TABLE "ziteUsers" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20) UNIQUE;

-- Password hashes live apart from ziteUsers so `SELECT *` on users never exposes them.
CREATE TABLE IF NOT EXISTS "UserPasswords" (
    "userId" VARCHAR(64) PRIMARY KEY REFERENCES "ziteUsers"("id") ON DELETE CASCADE,
    "hash" TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. Packages table (SaaS subscription plans)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Packages" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" VARCHAR(100) NOT NULL,
    "monthlyPrice" NUMERIC DEFAULT 0,
    "yearlyPrice" NUMERIC DEFAULT 0,
    "productLimit" INT DEFAULT 0,
    "features" TEXT,
    "analyticsEnabled" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "sortOrder" INT DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Tenants table (Brands & Manufacturers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tenants" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "companyName" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) UNIQUE NOT NULL,
    "owner" JSONB, -- Stored as JSON array/string e.g. ["usr_123"] or "usr_123"
    "logo" JSONB,  -- Array of { url: string, filename?: string }
    "website" TEXT,
    "phone" VARCHAR(50),
    "address" TEXT,
    "gs1CompanyPrefix" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'Active', -- 'Active', 'Suspended'
    "package" VARCHAR(64),
    "subscriptionEnds" VARCHAR(30),        -- YYYY-MM-DD
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Products table (Barcode catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Products" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant" VARCHAR(64),
    "title" VARCHAR(255) NOT NULL,
    "barcodeNumber" VARCHAR(50) UNIQUE NOT NULL,
    "barcodeType" VARCHAR(30) NOT NULL, -- 'EAN-13', 'UPC-A', 'System Code128'
    "description" TEXT,
    "brand" VARCHAR(255),
    "manufacturer" VARCHAR(255),
    "category" VARCHAR(100),
    "netWeight" VARCHAR(100),
    "countryOfOrigin" VARCHAR(100),
    "ingredients" TEXT,
    "certifications" TEXT,
    "mrp" NUMERIC,
    "images" JSONB DEFAULT '[]'::jsonb, -- Array of { url: string }
    "status" VARCHAR(20) DEFAULT 'Draft', -- 'Draft', 'Published'
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Payments table (Manual MFS / Card subscriptions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Payments" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant" VARCHAR(64),
    "package" VARCHAR(64),
    "transactionId" VARCHAR(100) UNIQUE NOT NULL,
    "method" VARCHAR(50) NOT NULL,       -- 'bKash', 'Nagad', 'Rocket', 'Bank Transfer'
    "billingPeriod" VARCHAR(20) NOT NULL, -- 'Monthly', 'Yearly'
    "amount" NUMERIC NOT NULL,
    "senderNumber" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    "adminNote" TEXT,
    "reviewedBy" VARCHAR(64),
    "reviewedAt" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Product Views table (Analytics events)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ProductViews" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "viewNumber" SERIAL,
    "product" VARCHAR(64),
    "tenant" VARCHAR(64),
    "source" VARCHAR(50), -- 'Search', 'Direct', 'QR Scan', 'Lookup'
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Admins table (Allowlist of platform admins)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Admins" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "name" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Admin rights follow the account (user id), not the email: emails are not verified,
-- so an email-only row could be claimed by whoever signs up with that address first.
ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "userId" VARCHAR(64) UNIQUE REFERENCES "ziteUsers"("id") ON DELETE CASCADE;
-- Older email-only rows: keep those whose account already exists, drop the rest (e.g. the old seeded admin).
UPDATE "Admins" a SET "userId" = u.id FROM "ziteUsers" u WHERE a."userId" IS NULL AND lower(u.email) = lower(a.email);
DELETE FROM "Admins" WHERE "userId" IS NULL;

-- ============================================================================
-- Junction & Relationship Tables (used for SQL Joins)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "PackagesTenants" (
    "packagesId" VARCHAR(64) REFERENCES "Packages"("id") ON DELETE CASCADE,
    "tenantsId" VARCHAR(64) REFERENCES "Tenants"("id") ON DELETE CASCADE,
    PRIMARY KEY ("packagesId", "tenantsId")
);

CREATE TABLE IF NOT EXISTS "ProductsTenants" (
    "productsId" VARCHAR(64) REFERENCES "Products"("id") ON DELETE CASCADE,
    "tenantsId" VARCHAR(64) REFERENCES "Tenants"("id") ON DELETE CASCADE,
    PRIMARY KEY ("productsId", "tenantsId")
);

CREATE TABLE IF NOT EXISTS "PaymentsTenants" (
    "paymentsId" VARCHAR(64) REFERENCES "Payments"("id") ON DELETE CASCADE,
    "tenantsId" VARCHAR(64) REFERENCES "Tenants"("id") ON DELETE CASCADE,
    PRIMARY KEY ("paymentsId", "tenantsId")
);

CREATE TABLE IF NOT EXISTS "PackagesPayments" (
    "packagesId" VARCHAR(64) REFERENCES "Packages"("id") ON DELETE CASCADE,
    "paymentsId" VARCHAR(64) REFERENCES "Payments"("id") ON DELETE CASCADE,
    PRIMARY KEY ("packagesId", "paymentsId")
);

CREATE TABLE IF NOT EXISTS "ProductViewsProducts" (
    "productViewsId" VARCHAR(64) REFERENCES "ProductViews"("id") ON DELETE CASCADE,
    "productsId" VARCHAR(64) REFERENCES "Products"("id") ON DELETE CASCADE,
    PRIMARY KEY ("productViewsId", "productsId")
);

CREATE TABLE IF NOT EXISTS "ProductViewsTenants" (
    "productViewsId" VARCHAR(64) REFERENCES "ProductViews"("id") ON DELETE CASCADE,
    "tenantsId" VARCHAR(64) REFERENCES "Tenants"("id") ON DELETE CASCADE,
    PRIMARY KEY ("productViewsId", "tenantsId")
);

-- ============================================================================
-- Indexes for High Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON "Tenants"("slug");
CREATE INDEX IF NOT EXISTS idx_products_barcode ON "Products"("barcodeNumber");
CREATE INDEX IF NOT EXISTS idx_products_status ON "Products"("status");
CREATE INDEX IF NOT EXISTS idx_payments_status ON "Payments"("status");
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON "Payments"("transactionId");
CREATE INDEX IF NOT EXISTS idx_productviews_created ON "ProductViews"("created_at");
CREATE INDEX IF NOT EXISTS idx_admins_email ON "Admins"("email");

-- ============================================================================
-- Triggers to maintain junction tables automatically
-- ============================================================================

-- Sync ProductsTenants
CREATE OR REPLACE FUNCTION sync_products_tenants() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "ProductsTenants" WHERE "productsId" = NEW."id";
    IF NEW."tenant" IS NOT NULL AND NEW."tenant" <> '' THEN
        INSERT INTO "ProductsTenants" ("productsId", "tenantsId")
        VALUES (NEW."id", NEW."tenant")
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_products_tenants ON "Products";
CREATE TRIGGER trg_sync_products_tenants
AFTER INSERT OR UPDATE ON "Products"
FOR EACH ROW EXECUTE FUNCTION sync_products_tenants();

-- Sync PackagesTenants
CREATE OR REPLACE FUNCTION sync_packages_tenants() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "PackagesTenants" WHERE "tenantsId" = NEW."id";
    IF NEW."package" IS NOT NULL AND NEW."package" <> '' THEN
        INSERT INTO "PackagesTenants" ("packagesId", "tenantsId")
        VALUES (NEW."package", NEW."id")
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_packages_tenants ON "Tenants";
CREATE TRIGGER trg_sync_packages_tenants
AFTER INSERT OR UPDATE ON "Tenants"
FOR EACH ROW EXECUTE FUNCTION sync_packages_tenants();

-- Sync Payments Junctions
CREATE OR REPLACE FUNCTION sync_payments_junctions() RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "PaymentsTenants" WHERE "paymentsId" = NEW."id";
    IF NEW."tenant" IS NOT NULL AND NEW."tenant" <> '' THEN
        INSERT INTO "PaymentsTenants" ("paymentsId", "tenantsId")
        VALUES (NEW."id", NEW."tenant")
        ON CONFLICT DO NOTHING;
    END IF;

    DELETE FROM "PackagesPayments" WHERE "paymentsId" = NEW."id";
    IF NEW."package" IS NOT NULL AND NEW."package" <> '' THEN
        INSERT INTO "PackagesPayments" ("packagesId", "paymentsId")
        VALUES (NEW."package", NEW."id")
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_payments_junctions ON "Payments";
CREATE TRIGGER trg_sync_payments_junctions
AFTER INSERT OR UPDATE ON "Payments"
FOR EACH ROW EXECUTE FUNCTION sync_payments_junctions();

-- Sync ProductViews Junctions
CREATE OR REPLACE FUNCTION sync_productviews_junctions() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."product" IS NOT NULL AND NEW."product" <> '' THEN
        INSERT INTO "ProductViewsProducts" ("productViewsId", "productsId")
        VALUES (NEW."id", NEW."product")
        ON CONFLICT DO NOTHING;
    END IF;
    IF NEW."tenant" IS NOT NULL AND NEW."tenant" <> '' THEN
        INSERT INTO "ProductViewsTenants" ("productViewsId", "tenantsId")
        VALUES (NEW."id", NEW."tenant")
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_productviews_junctions ON "ProductViews";
CREATE TRIGGER trg_sync_productviews_junctions
AFTER INSERT OR UPDATE ON "ProductViews"
FOR EACH ROW EXECUTE FUNCTION sync_productviews_junctions();

-- ============================================================================
-- Initial Seed Data
-- ============================================================================

INSERT INTO "Packages" ("id", "name", "monthlyPrice", "yearlyPrice", "productLimit", "features", "analyticsEnabled", "isActive", "sortOrder")
VALUES
    ('pkg_free', 'Free Starter', 0, 0, 5, 'Up to 5 products\nSystem Code128 barcodes\nPublic product verification page\nCommunity support', false, true, 1),
    ('pkg_growth', 'Growth Brand', 999, 9990, 50, 'Up to 50 products\nOfficial GS1 EAN-13 & UPC-A\nDirect QR code label printing\nBasic view & scan analytics\nPriority email support', true, true, 2),
    ('pkg_enterprise', 'Enterprise Manufacturer', 2999, 29990, 500, 'Up to 500 products\nEAN-13, UPC-A & Code128 barcodes\nCustom branded landing page\nAdvanced real-time analytics & charts\nBulk CSV export & label printing\nDedicated account manager', true, true, 3)
ON CONFLICT ("id") DO NOTHING;

-- No seeded admin. The first signed-in user claims admin from /admin ("Make me admin"),
-- which works only while the Admins table is empty.
