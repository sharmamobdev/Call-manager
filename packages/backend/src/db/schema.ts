import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const bool = (col: string) => integer(col, { mode: "boolean" }).notNull().default(false);
const createdAt = () => integer("created_at").notNull().$defaultFn(() => Date.now());
const updatedAt = () => integer("updated_at").notNull().$defaultFn(() => Date.now());

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  type: text("type").notNull().default("customer"),
  parentOrgId: text("parent_org_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  settings: text("settings").default("{}"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_org_parent").on(t.parentOrgId),
]);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("customer"),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: integer("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_user_email").on(t.email),
  index("idx_user_org").on(t.organizationId),
]);

export const numbers = sqliteTable("numbers", {
  id: id(),
  e164: text("e164").notNull().unique(),
  friendlyName: text("friendly_name"),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  campaignId: text("campaign_id"),
  callVendorId: text("call_vendor_id"),
  ivrConfig: text("ivr_config").default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isTollFree: integer("is_toll_free", { mode: "boolean" }).notNull().default(false),
  monthlyRental: real("monthly_rental").default(0),
  purchasedAt: integer("purchased_at").notNull().$defaultFn(() => Date.now()),
  assignedAt: integer("assigned_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_num_org").on(t.organizationId),
  index("idx_num_e164").on(t.e164),
]);

export const campaigns = sqliteTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  status: text("status").notNull().default("draft"),
  a2pBrandId: text("a2p_brand_id"),
  a2pCampaignId: text("a2p_campaign_id"),
  useCase: text("use_case"),
  sampleMessages: text("sample_messages").default("[]"),
  monthlyVolume: integer("monthly_volume").default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_campaign_org").on(t.organizationId),
]);

export const buyers = sqliteTable("buyers", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"),
  description: text("description"),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_buyer_org").on(t.organizationId),
]);

export const campaignBuyers = sqliteTable("campaign_buyers", {
  id: id(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  buyerId: text("buyer_id").notNull().references(() => buyers.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const buyerGroups = sqliteTable("buyer_groups", {
  id: id(),
  name: text("name").notNull(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_buyer_group_org").on(t.organizationId),
]);

export const buyerGroupMembers = sqliteTable("buyer_group_members", {
  id: id(),
  groupId: text("group_id").notNull().references(() => buyerGroups.id),
  buyerId: text("buyer_id").notNull().references(() => buyers.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const callVendors = sqliteTable("call_vendors", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  settings: text("settings").default("{}"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_vendor_org").on(t.organizationId),
]);

export const cdrs = sqliteTable("cdrs", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  callSid: text("call_sid"),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  direction: text("direction").notNull(),
  duration: integer("duration").notNull().default(0),
  billDuration: integer("bill_duration").notNull().default(0),
  cost: real("cost").default(0),
  rate: real("rate").default(0),
  status: text("status").default("completed"),
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration").default(0),
  answeredAt: integer("answered_at"),
  endedAt: integer("ended_at"),
  callDate: integer("call_date").notNull().$defaultFn(() => Date.now()),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_cdr_org").on(t.organizationId),
  index("idx_cdr_date").on(t.callDate),
]);

export const invoices = sqliteTable("invoices", {
  id: id(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  status: text("status").notNull().default("pending"),
  totalAmount: real("total_amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  dueDate: integer("due_date").notNull(),
  paidAt: integer("paid_at"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_invoice_org").on(t.organizationId),
]);

export const invoiceItems = sqliteTable("invoice_items", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  totalPrice: real("total_price").notNull().default(0),
  itemType: text("item_type").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const billingLedger = sqliteTable("billing_ledger", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull().default(0),
  balance: real("balance").notNull().default(0),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_ledger_org").on(t.organizationId),
]);

export const dailyReports = sqliteTable("daily_reports", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  campaignId: text("campaign_id"),
  scheduleType: text("schedule_type").notNull().default("daily"),
  recipients: text("recipients").default("[]"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_report_org").on(t.organizationId),
]);

export const generatedReports = sqliteTable("generated_reports", {
  id: id(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  reportType: text("report_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  parameters: text("parameters").default("{}"),
  isReady: integer("is_ready", { mode: "boolean" }).notNull().default(false),
  generatedAt: integer("generated_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_gen_report_org").on(t.organizationId),
]);

export const notifications = sqliteTable("notifications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("idx_notif_user").on(t.userId),
]);
