/**
 * Typed database access for API endpoints: one client per table plus raw SQL, all on the
 * local Postgres / PGlite connection (src/server/pgClient.ts).
 *
 * Table clients (each takes one params object):
 *   .findAll({ filters?, sort?, offset?, limit?, fields? }) -> { records, hasMore }   (limit defaults to 500)
 *   .findOne({ id?, filters?, fields? })                   -> record | undefined
 *   .create({ record }) / .update({ id, record }) / .delete({ id })
 * Filters: { field: value } for equality, or { field: { contains | not | in | notIn | lt | lte | gt | gte: value } }.
 * Raw SQL: db.sql({ query, params }) -> { rows }
 */
import { createPgTableClient, createPgSqlClient } from "./pgClient";

export type Attachment = {
  /** Original filename as uploaded. */
  filename: string;
  /** Display name — may differ from `filename`. */
  originalName: string;
  /** File size in bytes. */
  size: number;
  mimeType: string;
  /** Publicly accessible URL. */
  url: string;
  /** ISO timestamp of the upload. */
  uploadedAt: string;
  metadata?: Record<string, unknown>;
};

/** What you may write to an attachments field: a URL, a URL with a name, or an attachment you read earlier. */
export type AttachmentInput =
  | string
  | { url: string; filename?: string }
  | Attachment;

/** A record in the "Packages" table, as it is read back. */
export type PackagesRecordType = {
  id: string;
  /** Primary field. "Name" */
  name?: string;
  /** "Monthly Price". Value is a raw number; display as currency with symbol "৳", 0 decimal places, format: local (e.g. 1,000,000.50) */
  monthlyPrice?: number;
  /** "Yearly Price". Value is a raw number; display as currency with symbol "৳", 0 decimal places, format: local (e.g. 1,000,000.50) */
  yearlyPrice?: number;
  /** "Product Limit". 0 decimal places, format: local (e.g. 1,000,000.50) */
  productLimit?: number;
  features?: string;
  analyticsEnabled?: boolean;
  isActive?: boolean;
  /** "Sort Order". 0 decimal places, format: local (e.g. 1,000,000.50) */
  sortOrder?: number;
  /** Links to tenants ("Tenants"). "Tenants" */
  tenants?: string | string[];
  /** Links to payments ("Payments"). "Payments" */
  payments?: string | string[];
};

/** What you may write when creating or updating a record in the "Packages" table. */
export type PackagesRecordInput = {
  name: string | null;
  monthlyPrice: string | number | null;
  yearlyPrice: string | number | null;
  productLimit: string | number | null;
  features: string | null;
  analyticsEnabled: string | boolean | null;
  isActive: string | boolean | null;
  sortOrder: string | number | null;
  tenants: string | string[] | null;
  payments: string | string[] | null;
};

/** A record in the "Tenants" table, as it is read back. */
export type TenantsRecordType = {
  id: string;
  /** Primary field. "Company Name" */
  companyName?: string;
  slug?: string;
  owner?: string | string[];
  logo?: Attachment[];
  website?: string;
  phone?: string;
  address?: string;
  gs1CompanyPrefix?: string;
  status?: "Active" | "Suspended" | string;
  /** Links to packages ("Packages"). "Package" */
  package?: string | string[];
  /** "Subscription Ends". Date-only field (YYYY-MM-DD string), null when unset, display as "local" format */
  subscriptionEnds?: string;
  /** Read-only. "Created At". Auto-set when record was created (ISO 8601) */
  createdAt?: string;
  /** Links to products ("Products"). "Products" */
  products?: string | string[];
  /** Links to payments ("Payments"). "Payments" */
  payments?: string | string[];
  /** Links to productViews ("Product Views"). "Product Views" */
  productViews?: string | string[];
};

/** What you may write when creating or updating a record in the "Tenants" table. */
export type TenantsRecordInput = {
  companyName: string | null;
  slug: string | null;
  owner: string | string[] | null;
  logo: AttachmentInput[] | AttachmentInput | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  gs1CompanyPrefix: string | null;
  status: "Active" | "Suspended" | string | null;
  package: string | string[] | null;
  subscriptionEnds: string | Date | null;
  products: string | string[] | null;
  payments: string | string[] | null;
  productViews: string | string[] | null;
};

/** A record in the "Products" table, as it is read back. */
export type ProductsRecordType = {
  id: string;
  /** Primary field. "Title" */
  title?: string;
  /** Links to tenants ("Tenants"). "Tenant" */
  tenant?: string | string[];
  barcodeNumber?: string;
  barcodeType?: "EAN-13" | "UPC-A" | "System Code128" | string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  netWeight?: string;
  countryOfOrigin?: string;
  ingredients?: string;
  certifications?: string;
  /** "MRP". Value is a raw number; display as currency with symbol "৳", 0 decimal places, format: local (e.g. 1,000,000.50) */
  mrp?: number;
  images?: Attachment[];
  status?: "Draft" | "Published" | string;
  /** Read-only. "Created At". Auto-set when record was created (ISO 8601) */
  createdAt?: string;
  /** Read-only. "Updated At". Auto-set when record was last modified (ISO 8601) */
  updatedAt?: string;
  /** Links to productViews ("Product Views"). "Product Views" */
  productViews?: string | string[];
};

/** What you may write when creating or updating a record in the "Products" table. */
export type ProductsRecordInput = {
  title: string | null;
  tenant: string | string[] | null;
  barcodeNumber: string | null;
  barcodeType: "EAN-13" | "UPC-A" | "System Code128" | string | null;
  description: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  netWeight: string | null;
  countryOfOrigin: string | null;
  ingredients: string | null;
  certifications: string | null;
  mrp: string | number | null;
  images: AttachmentInput[] | AttachmentInput | null;
  status: "Draft" | "Published" | string | null;
  productViews: string | string[] | null;
};

/** A record in the "Payments" table, as it is read back. */
export type PaymentsRecordType = {
  id: string;
  /** Primary field. "Transaction ID" */
  transactionId?: string;
  /** Links to tenants ("Tenants"). "Tenant" */
  tenant?: string | string[];
  /** Links to packages ("Packages"). "Package" */
  package?: string | string[];
  method?: "bKash" | "Nagad" | "Rocket" | "Bank Transfer" | string;
  billingPeriod?: "Monthly" | "Yearly" | string;
  /** "Amount". Value is a raw number; display as currency with symbol "৳", 0 decimal places, format: local (e.g. 1,000,000.50) */
  amount?: number;
  senderNumber?: string;
  status?: "Pending" | "Approved" | "Rejected" | string;
  adminNote?: string;
  reviewedBy?: string | string[];
  /** "Reviewed At". Date+time field (ISO 8601 timestamp), null when unset, date: "local" format, time: 12h */
  reviewedAt?: string;
  /** Read-only. "Submitted At". Auto-set when record was created (ISO 8601) */
  submittedAt?: string;
};

/** What you may write when creating or updating a record in the "Payments" table. */
export type PaymentsRecordInput = {
  transactionId: string | null;
  tenant: string | string[] | null;
  package: string | string[] | null;
  method: "bKash" | "Nagad" | "Rocket" | "Bank Transfer" | string | null;
  billingPeriod: "Monthly" | "Yearly" | string | null;
  amount: string | number | null;
  senderNumber: string | null;
  status: "Pending" | "Approved" | "Rejected" | string | null;
  adminNote: string | null;
  reviewedBy: string | string[] | null;
  reviewedAt: string | Date | null;
};

/** A record in the "Product Views" table, as it is read back. */
export type ProductViewsRecordType = {
  id: string;
  /** Primary field. Read-only. "View Number" */
  viewNumber?: number;
  /** Links to products ("Products"). "Product" */
  product?: string | string[];
  /** Links to tenants ("Tenants"). "Tenant" */
  tenant?: string | string[];
  source?: "Search" | "Direct" | "QR Scan" | "Lookup" | string;
  /** Read-only. "Viewed At". Auto-set when record was created (ISO 8601) */
  viewedAt?: string;
};

/** What you may write when creating or updating a record in the "Product Views" table. */
export type ProductViewsRecordInput = {
  product: string | string[] | null;
  tenant: string | string[] | null;
  source: "Search" | "Direct" | "QR Scan" | "Lookup" | string | null;
};

/** A record in the "Admins" table, as it is read back. */
export type AdminsRecordType = {
  id: string;
  /** Primary field. "Email" */
  email?: string;
  name?: string;
  userId?: string;
};

/** What you may write when creating or updating a record in the "Admins" table. */
export type AdminsRecordInput = {
  email: string | null;
  name: string | null;
  userId: string | null;
};

export const db = {
  packages: createPgTableClient<PackagesRecordType, PackagesRecordInput>("Packages"),
  tenants: createPgTableClient<TenantsRecordType, TenantsRecordInput>("Tenants"),
  products: createPgTableClient<ProductsRecordType, ProductsRecordInput>("Products"),
  payments: createPgTableClient<PaymentsRecordType, PaymentsRecordInput>("Payments"),
  productViews: createPgTableClient<ProductViewsRecordType, ProductViewsRecordInput>("ProductViews"),
  admins: createPgTableClient<AdminsRecordType, AdminsRecordInput>("Admins"),
  sql: createPgSqlClient(),
};
