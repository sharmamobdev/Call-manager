import { Router, Request, Response } from "express";
import { db } from "../../db/index.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { signalwire } from "../../services/signalwire.js";

const router = Router();
router.use(authenticate);
router.use(authorize("admin", "reseller"));

// ── Numbers ──────────────────────────────────────────
router.get("/admin/numbers", (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT n.*, o.name as organization_name
    FROM numbers n
    LEFT JOIN organizations o ON o.id = n.organization_id
    ORDER BY n.created_at DESC
  `).all() as any[];
  const numbers = rows.map((r) => ({
    id: r.id,
    e164: r.e164,
    friendlyName: r.friendly_name,
    organizationId: r.organization_id,
    organizationName: r.organization_name,
    campaignId: r.campaign_id,
    callVendorId: r.call_vendor_id,
    isActive: !!r.is_active,
    isTollFree: !!r.is_toll_free,
    monthlyRental: r.monthly_rental,
    signalwireSid: r.signalwire_sid,
    purchasedAt: r.purchased_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ numbers });
});

router.post("/admin/numbers/sync", async (_req: Request, res: Response) => {
  try {
    let allNumbers: any[] = [];
    let pageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const data = await signalwire.listNumbers({ pageSize: 100, pageToken });
      const swNumbers: any[] = data.incoming_phone_numbers || [];
      allNumbers = allNumbers.concat(swNumbers);
      pageToken = data.next_page_token || undefined;
      hasMore = !!pageToken && swNumbers.length > 0;
    }

    let synced = 0;
    let updated = 0;
    for (const sw of allNumbers) {
      const existing = db.prepare("SELECT id, organization_id FROM numbers WHERE e164 = ?").get(sw.phone_number) as any;
      if (existing) {
        if (!existing.organization_id) {
          db.prepare("UPDATE numbers SET organization_id = ?, signalwire_sid = ?, friendly_name = COALESCE(?, friendly_name), updated_at = ? WHERE e164 = ?")
            .run(_req.user!.organizationId, sw.sid, sw.friendly_name || null, Date.now(), sw.phone_number);
          updated++;
        }
        continue;
      }
      const id = crypto.randomUUID();
      const orgId = _req.user!.organizationId;
      db.prepare(`INSERT INTO numbers (id, e164, friendly_name, organization_id, is_active, monthly_rental, signalwire_sid, purchased_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`)
        .run(id, sw.phone_number, sw.friendly_name || null, orgId, parseFloat(sw.cost || "1.00"), sw.sid, Date.now(), Date.now(), Date.now());
      synced++;
    }
    return res.json({ synced, updated, total: allNumbers.length });
  } catch (err: any) {
    console.error("Sync numbers error:", err.message);
    return res.status(502).json({ error: `Failed to sync numbers: ${err.message}` });
  }
});

router.get("/admin/customers", (req: Request, res: Response) => {
  let query = "SELECT * FROM organizations WHERE type = 'customer'";
  const params: any[] = [];
  if (req.user!.role === "reseller") {
    query += " AND parent_org_id = ?";
    params.push(req.user!.organizationId);
  }
  const customers = db.prepare(query).all(...params);
  return res.json({ customers });
});

router.get("/admin/customers/:id", (req: Request, res: Response) => {
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(req.params.id) as any;
  if (!org) return res.status(404).json({ error: "Not found" });
  org.users = db.prepare("SELECT id, email, first_name, last_name, display_name, role FROM users WHERE organization_id = ?").all(req.params.id);
  return res.json(org);
});

router.post("/admin/customers", async (req: Request, res: Response) => {
  const bcrypt = await import("bcryptjs");
  const { name, email, password, firstName, lastName } = req.body;

  const orgId = crypto.randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO organizations (id, name, type, parent_org_id, is_active, settings, created_at, updated_at) VALUES (?, ?, 'customer', ?, 1, '{}', ?, ?)")
    .run(orgId, name, req.user!.organizationId, now, now);

  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, role, organization_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'customer', ?, 1, ?, ?)`)
    .run(crypto.randomUUID(), email, passwordHash, firstName || null, lastName || null, `${firstName || ""} ${lastName || ""}`.trim() || name, orgId, now, now);

  return res.json({ organization: { id: orgId, name } });
});

router.get("/admin/users", (_req: Request, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.display_name, u.role, u.organization_id, u.is_active, u.last_login_at, u.created_at,
           o.name as organization_name
    FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
  `).all();
  return res.json({ users });
});

router.get("/admin/resellers", (_req: Request, res: Response) => {
  const resellers = db.prepare("SELECT * FROM organizations WHERE type = 'reseller'").all();
  return res.json({ resellers });
});

router.post("/admin/resellers", (req: Request, res: Response) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO organizations (id, name, type, is_active, settings, created_at, updated_at) VALUES (?, ?, 'reseller', 1, '{}', ?, ?)")
    .run(id, req.body.name, now, now);
  return res.json({ reseller: { id, name: req.body.name } });
});

router.get("/admin/stats", (_req: Request, res: Response) => {
  const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as any;
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  const numberCount = db.prepare("SELECT COUNT(*) as count FROM numbers").get() as any;
  const cdrCount = db.prepare("SELECT COUNT(*) as count FROM cdrs").get() as any;

  return res.json({
    organizations: orgCount?.count || 0,
    users: userCount?.count || 0,
    numbers: numberCount?.count || 0,
    cdrs: cdrCount?.count || 0,
  });
});

export default router;
