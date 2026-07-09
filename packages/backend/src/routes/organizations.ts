import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/organizations", (_req: Request, res: Response) => {
  const orgs = db.prepare("SELECT * FROM organizations WHERE is_active = 1 ORDER BY name ASC").all();
  return res.json({ organizations: orgs });
});

router.get("/organizations/:id", (req: Request, res: Response) => {
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(req.params.id) as any;
  if (!org) return res.status(404).json({ error: "Not found" });
  org.users = db.prepare("SELECT id, email, first_name, last_name, display_name, role FROM users WHERE organization_id = ?").all(req.params.id);
  return res.json(org);
});

router.post("/organizations", (req: Request, res: Response) => {
  const { name, type } = req.body;
  const existing = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name) as any;
  if (existing) return res.status(409).json({ error: "Organization already exists" });

  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO organizations (id, name, type, is_active, settings, created_at, updated_at) VALUES (?, ?, ?, 1, '{}', ?, ?)")
    .run(id, name, type || "customer", now, now);
  return res.json({ organization: { id, name, type } });
});

router.patch("/organizations/:id", (req: Request, res: Response) => {
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    sets.push(`${col} = ?`);
    params.push(value);
  }
  sets.push("updated_at = ?");
  params.push(Date.now(), req.params.id);
  db.prepare(`UPDATE organizations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return res.json({ success: true });
});

router.delete("/organizations/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM organizations WHERE id = ?").run(req.params.id);
  return res.json({ success: true });
});

export default router;
