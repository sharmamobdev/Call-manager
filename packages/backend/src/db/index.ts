import { initDatabase, prepare, exec, saveDatabase } from "./better-sqlite3-shim.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/dialclear.db");

await initDatabase(dbPath);

function wrapPrepare(sql: string) {
  const stmt = prepare(sql);
  const origRun = stmt.run.bind(stmt);
  stmt.run = (...params: any[]) => {
    const result = origRun(...params);
    saveDatabase();
    return result;
  };
  return stmt;
}

export const db = { prepare: wrapPrepare, exec };

export function createTables() {
  const createStmts = `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'customer',
      parent_org_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_parent ON organizations(parent_org_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      display_name TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_org ON users(organization_id);

    CREATE TABLE IF NOT EXISTS numbers (
      id TEXT PRIMARY KEY,
      e164 TEXT NOT NULL UNIQUE,
      friendly_name TEXT,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      campaign_id TEXT,
      call_vendor_id TEXT,
      ivr_config TEXT DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_toll_free INTEGER NOT NULL DEFAULT 0,
      monthly_rental REAL DEFAULT 0,
      purchased_at INTEGER NOT NULL,
      assigned_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_num_org ON numbers(organization_id);
    CREATE INDEX IF NOT EXISTS idx_num_e164 ON numbers(e164);

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      status TEXT NOT NULL DEFAULT 'draft',
      a2p_brand_id TEXT,
      a2p_campaign_id TEXT,
      use_case TEXT,
      sample_messages TEXT DEFAULT '[]',
      monthly_volume INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_org ON campaigns(organization_id);

    CREATE TABLE IF NOT EXISTS buyers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      description TEXT,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_buyer_org ON buyers(organization_id);

    CREATE TABLE IF NOT EXISTS campaign_buyers (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      buyer_id TEXT NOT NULL REFERENCES buyers(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS buyer_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_buyer_group_org ON buyer_groups(organization_id);

    CREATE TABLE IF NOT EXISTS buyer_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES buyer_groups(id),
      buyer_id TEXT NOT NULL REFERENCES buyers(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vendor_org ON call_vendors(organization_id);

    CREATE TABLE IF NOT EXISTS cdrs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      call_sid TEXT,
      from_number TEXT NOT NULL,
      to_number TEXT NOT NULL,
      direction TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      bill_duration INTEGER NOT NULL DEFAULT 0,
      cost REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      recording_url TEXT,
      recording_duration INTEGER DEFAULT 0,
      answered_at INTEGER,
      ended_at INTEGER,
      call_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cdr_org ON cdrs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_cdr_date ON cdrs(call_date);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      status TEXT NOT NULL DEFAULT 'pending',
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      due_date INTEGER NOT NULL,
      paid_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_org ON invoices(organization_id);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id),
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      item_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_ledger (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_org ON billing_ledger(organization_id);

    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      campaign_id TEXT,
      schedule_type TEXT NOT NULL DEFAULT 'daily',
      recipients TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_report_org ON daily_reports(organization_id);

    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      report_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER,
      parameters TEXT DEFAULT '{}',
      is_ready INTEGER NOT NULL DEFAULT 0,
      generated_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gen_report_org ON generated_reports(organization_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
  `;

  exec(createStmts);

  // Migrations (safe to re-run)
  try { db.prepare("ALTER TABLE numbers ADD COLUMN signalwire_sid TEXT").run(); } catch (_) {}
  try { db.prepare("ALTER TABLE numbers ADD COLUMN assigned_at INTEGER").run(); } catch (_) {}

  saveDatabase();
  console.log("Database tables created successfully");
}
