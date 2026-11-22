# BarcodeHub PostgreSQL Database

BarcodeHub now supports direct PostgreSQL storage alongside the Cloudflare R2 object storage.

---

## 🏗️ Architecture

```
                                  ┌──────────────────────────────┐
                                  │   Cloudflare R2 (Storage)    │
                                  │   (Logos, Product Images)    │
                                  └──────────────▲───────────────┘
                                                 │ Presigned URLs
┌───────────────────────┐         ┌──────────────┴───────────────┐
│     Client App        │ ──────► │   BarcodeHub Backend / API   │
│  (React 18 + Vite)    │         │      (src/api/*.ts)          │
└───────────────────────┘         └──────────────┬───────────────┘
                                                 │
                                                 │ SQL / Relational Queries
                                  ┌──────────────▼───────────────┐
                                  │     PostgreSQL Database      │
                                  │   (Neon, Supabase, Local)    │
                                  └──────────────────────────────┘
```

---

## 🗄️ Relational Schema (`database/schema.sql`)

### Tables

| Table Name | Description | Key Columns |
|---|---|---|
| `"Packages"` | SaaS subscription plans | `id`, `name`, `monthlyPrice`, `yearlyPrice`, `productLimit`, `analyticsEnabled`, `isActive`, `sortOrder` |
| `"Tenants"` | Registered brands & manufacturers | `id`, `companyName`, `slug` (unique), `owner`, `logo`, `gs1CompanyPrefix`, `status`, `package`, `subscriptionEnds` |
| `"Products"` | Product catalog & barcode registry | `id`, `tenant`, `title`, `barcodeNumber` (unique), `barcodeType`, `brand`, `mrp`, `images`, `status` |
| `"Payments"` | Subscription payments (MFS / Manual) | `id`, `tenant`, `package`, `transactionId` (unique), `method`, `amount`, `status`, `reviewedBy`, `reviewedAt` |
| `"ProductViews"` | Analytics event log | `id`, `viewNumber`, `product`, `tenant`, `source`, `created_at` |
| `"Admins"` | SaaS owner & admin allowlist | `id`, `email` (unique), `name`, `created_at` |
| `"ziteUsers"` | User profile accounts | `id`, `email` (unique), `name`, `firstName`, `lastName`, `image` |

### Automated Junction Sync Triggers
The schema includes PostgreSQL PL/pgSQL triggers that automatically maintain relational junction tables:
- `sync_products_tenants()` ➔ Keeps `"ProductsTenants"` (`productsId`, `tenantsId`) in sync.
- `sync_packages_tenants()` ➔ Keeps `"PackagesTenants"` (`packagesId`, `tenantsId`) in sync.
- `sync_payments_junctions()` ➔ Keeps `"PaymentsTenants"` and `"PackagesPayments"` in sync.
- `sync_productviews_junctions()` ➔ Keeps `"ProductViewsProducts"` and `"ProductViewsTenants"` in sync.

---

## 🚀 Setup & Migration

### 1. Configure Connection String
Create `.env` or set environment variable:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barcodehub"
```

*Works with local PostgreSQL, Supabase, Neon, AWS RDS, Railway, Render, etc.*

### 2. Apply Migrations
Run the automated schema migration script:

```bash
npm run db:migrate
```

This will:
1. Connect to PostgreSQL
2. Execute `database/schema.sql` (creates all extensions, tables, indexes, triggers)
3. Seed default packages (`Free Starter`, `Growth Brand`, `Enterprise Manufacturer`)
