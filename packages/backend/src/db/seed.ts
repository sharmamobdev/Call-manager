import { db, createTables } from "./index.js";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");
  createTables();

  const now = Date.now();

  const adminOrgId = crypto.randomUUID();
  const customerOrgId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const customerUserId = crypto.randomUUID();

  const adminHash = await bcrypt.hash("admin123", 10);
  const customerHash = await bcrypt.hash("customer123", 10);

  db.prepare(`INSERT INTO organizations (id, name, type, is_active, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run(adminOrgId, "DialClear Admin", "admin", 1, "{}", now, now);

  db.prepare(`INSERT INTO organizations (id, name, type, parent_org_id, is_active, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(customerOrgId, "Demo Customer", "customer", adminOrgId, 1, "{}", now, now);

  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, role, organization_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(adminUserId, "admin@dialclear.com", adminHash, "Admin", "User", "Admin User", "admin", adminOrgId, 1, now, now);

  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, role, organization_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(customerUserId, "customer@dialclear.com", customerHash, "Customer", "User", "Customer User", "customer", customerOrgId, 1, now, now);

  const invId = crypto.randomUUID();
  db.prepare(`INSERT INTO invoices (id, invoice_number, organization_id, status, total_amount, due_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(invId, "INV-2024-001", customerOrgId, "paid", 49.99, now + 7 * 86400000, "Monthly DID rentals", now, now);

  db.prepare(`INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, item_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), invId, "DID Rental - +12125551234", 1, 4.99, 4.99, "did_rental", now, now);

  db.prepare(`INSERT INTO billing_ledger (id, organization_id, type, description, amount, balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), customerOrgId, "payment", "Invoice payment INV-2024-001", -49.99, 100.00, now, now);

  console.log("Seed complete!");
  console.log("  Admin login:    admin@dialclear.com / admin123");
  console.log("  Customer login: customer@dialclear.com / customer123");
}

async function main() {
  try {
    await seed();
    if (process.env.RAILWAY_SERVICE_NAME || !process.listeners("request").length) {
      process.exit(0);
    }
  } catch (err) {
    console.error("Seed failed:", err);
    if (process.env.RAILWAY_SERVICE_NAME || !process.listeners("request").length) {
      process.exit(1);
    }
  }
}

if (process.argv[1]?.includes("seed")) {
  main();
}

export default seed;
