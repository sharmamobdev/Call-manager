import { Router, Request, Response } from "express";
import { db } from "../../db/index.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();
router.use(authenticate);
router.use(authorize("admin", "reseller"));

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
