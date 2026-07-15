import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { signalwire } from "../services/signalwire.js";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

// ── Public recording proxy (no auth middleware — token in query string) ──
export const recordingRouter = Router();

recordingRouter.get("/recordings/:cdrId", async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(401).json({ error: "Missing token" });

    let user: any;
    try {
      user = jwt.verify(token, config.jwtSecret) as any;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const cdr = db.prepare("SELECT recording_url, call_sid, organization_id FROM cdrs WHERE id = ? AND organization_id = ?").get(req.params.cdrId, user.organizationId) as any;
    if (!cdr?.recording_url) return res.status(404).json({ error: "Recording not found" });

    const accountId = process.env.SIGNALWIRE_PROJECT_ID || "";
    const authToken = process.env.SIGNALWIRE_TOKEN || "";
    const auth = Buffer.from(`${accountId}:${authToken}`).toString("base64");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(cdr.recording_url, {
      signal: controller.signal,
      headers: { Authorization: `Basic ${auth}` },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(`[Recording Proxy] SignalWire error ${upstream.status}: ${text}`);
      return res.status(502).json({ error: "Failed to fetch recording from SignalWire" });
    }

    const contentType = upstream.headers.get("content-type") || "audio/wav";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", `inline; filename="recording-${cdr.call_sid}.wav"`);

    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error(`[Recording Proxy] Error:`, err?.message);
    return res.status(500).json({ error: "Recording proxy failed" });
  }
});

// ── Authenticated CDR routes ──
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
    buyerNumber: r.buyer_number,
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
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));
  const { fromNumber, toNumber, direction, status } = req.query;

  const conditions: string[] = ["organization_id = ?", "status NOT IN ('ringing', 'in-progress')"];
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

// ── SignalWire Voice Logs (realtime from SignalWire API) ──
router.get("/customer/signalwire-calls", async (req: Request, res: Response) => {
  try {
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const data = await signalwire.getCalls({ pageSize, page });
    const calls = (data.calls || []).map((c: any) => ({
      id: c.sid,
      callSid: c.sid,
      fromNumber: c.from,
      toNumber: c.to,
      direction: c.direction,
      duration: parseInt(c.duration || "0"),
      cost: c.price ? parseFloat(c.price) : null,
      status: c.status,
      startTime: c.start_time,
      endTime: c.end_time,
      answeredBy: c.answered_by,
      callerName: c.caller_name,
      forwardingNumber: c.forwarding_number,
      errorCode: c.error_code,
      errorMessage: c.error_message,
    }));
    return res.json({ calls, total: data.num_calls || calls.length, page, pageSize });
  } catch (err: any) {
    console.error("Failed to fetch SignalWire voice logs:", err?.message);
    return res.status(502).json({ error: "Failed to fetch voice logs from SignalWire" });
  }
});

export default router;
