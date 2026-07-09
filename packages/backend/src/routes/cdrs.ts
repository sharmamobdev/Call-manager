import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

// camelCase column map for sorting
const SORT_COLUMNS: Record<string, string> = {
  callDate: "call_date",
  fromNumber: "from_number",
  toNumber: "to_number",
  direction: "direction",
  duration: "duration",
  cost: "cost",
  status: "status",
};

function mapCdr(r: any) {
  return {
    id: r.id,
    organizationId: r.organization_id,
    callSid: r.call_sid,
    fromNumber: r.from_number,
    toNumber: r.to_number,
    direction: r.direction,
    duration: r.duration,
    billDuration: r.bill_duration,
    cost: r.cost,
    rate: r.rate,
    status: r.status,
    recordingUrl: r.recording_url,
    recordingDuration: r.recording_duration,
    answeredAt: r.answered_at,
    endedAt: r.ended_at,
    callDate: r.call_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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

  // Sort
  const sortBy = SORT_COLUMNS[(req.query.sortBy as string) || "callDate"] || "call_date";
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === "asc" ? "ASC" : "DESC";

  const where = conditions.join(" AND ");
  const cdrs = db.prepare(`SELECT * FROM cdrs WHERE ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM cdrs WHERE ${where}`).get(...params) as any;

  return res.json({ cdrs: cdrs.map(mapCdr), total: countRow?.count || 0, page, pageSize });
});

// Live calls — calls currently in ringing or in-progress status
router.get("/customer/live-calls", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const cdrs = db.prepare("SELECT * FROM cdrs WHERE organization_id = ? AND status IN ('ringing', 'in-progress') ORDER BY call_date DESC LIMIT 20").all(orgId) as any[];
  return res.json({ calls: cdrs.map(mapCdr) });
});

router.get("/customer/cdrs/:id/recording", (req: Request, res: Response) => {
  const cdr = db.prepare("SELECT recording_url FROM cdrs WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!cdr?.recording_url) return res.status(404).json({ error: "Recording not found" });
  return res.json({ url: cdr.recording_url });
});

export default router;
