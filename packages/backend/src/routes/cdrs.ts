import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/customer/cdrs", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const { fromNumber, toNumber, direction, status } = req.query;

  const conditions: string[] = ["organization_id = ?"];
  const params: any[] = [orgId];

  if (fromNumber) { conditions.push("from_number LIKE ?"); params.push(`%${fromNumber}%`); }
  if (toNumber) { conditions.push("to_number LIKE ?"); params.push(`%${toNumber}%`); }
  if (direction) { conditions.push("direction = ?"); params.push(direction); }
  if (status) { conditions.push("status = ?"); params.push(status); }

  const where = conditions.join(" AND ");
  const cdrs = db.prepare(`SELECT * FROM cdrs WHERE ${where} ORDER BY call_date DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM cdrs WHERE ${where}`).get(...params) as any;

  return res.json({ cdrs, total: countRow?.count || 0, page, pageSize });
});

router.get("/customer/cdrs/:id/recording", (req: Request, res: Response) => {
  const cdr = db.prepare("SELECT recording_url FROM cdrs WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!cdr?.recording_url) return res.status(404).json({ error: "Recording not found" });
  return res.json({ url: cdr.recording_url });
});

export default router;
