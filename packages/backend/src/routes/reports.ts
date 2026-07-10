import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/customer/reports/campaign-summary", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const row = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as answered_calls,
      COALESCE(SUM(duration), 0) as total_duration,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(AVG(duration), 0) as avg_duration
    FROM cdrs WHERE organization_id = ?
  `).get(orgId) as any;

  return res.json({
    totalCalls: row?.total_calls || 0,
    answeredCalls: row?.answered_calls || 0,
    totalDuration: row?.total_duration || 0,
    totalCost: (row?.total_cost || 0).toFixed(2),
    avgDuration: row?.avg_duration || 0,
  });
});

router.get("/customer/reports/campaign-summary/export.csv", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const cdrs = db.prepare("SELECT * FROM cdrs WHERE organization_id = ? LIMIT 1000").all(orgId) as any[];

  const header = "CallSID,From,To,Direction,Duration,Cost,Status,Date\n";
  const rows = cdrs.map((c: any) => `${c.call_sid},${c.from_number},${c.to_number},${c.direction},${c.duration},${c.cost},${c.status},${c.call_date}`).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=campaign-summary.csv");
  return res.send(header + rows);
});

router.get("/customer/reports/consolidated-campaigns", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE organization_id = ?").all(orgId) as any[];

  const reports = campaigns.map((camp: any) => {
    const stats = db.prepare("SELECT COUNT(*) as total_calls, COALESCE(SUM(cost), 0) as total_cost FROM cdrs WHERE organization_id = ?").get(orgId) as any;
    return { campaignId: camp.id, campaignName: camp.name, totalCalls: stats?.total_calls || 0, totalCost: stats?.total_cost || 0 };
  });

  return res.json({ campaigns: reports });
});

router.get("/customer/daily-reports/settings", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM daily_reports WHERE organization_id = ?").all(req.user!.organizationId) as any[];
  const settings = rows.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    scheduleType: r.schedule_type,
    recipients: r.recipients ? JSON.parse(r.recipients) : [],
    isActive: !!r.is_active,
    createdAt: r.created_at,
  }));
  return res.json({ settings });
});

router.post("/customer/daily-reports/settings", (req: Request, res: Response) => {
  const { campaignId, scheduleType, recipients, isActive } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO daily_reports (id, organization_id, campaign_id, schedule_type, recipients, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.user!.organizationId, campaignId || null, scheduleType || "daily", JSON.stringify(recipients || []), isActive !== false ? 1 : 0, now, now);
  return res.json({ setting: { id } });
});

router.post("/customer/daily-reports/generate-now", (_req: Request, res: Response) => {
  return res.json({ success: true, message: "Report generation queued" });
});

router.get("/customer/generated-reports", (req: Request, res: Response) => {
  const reports = db.prepare("SELECT * FROM generated_reports WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId);
  return res.json({ reports });
});

router.post("/customer/generated-reports/create", (req: Request, res: Response) => {
  const { reportType, parameters } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO generated_reports (id, organization_id, report_type, file_name, file_url, parameters, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.user!.organizationId, reportType || "custom", `report-${now}.csv`, "", JSON.stringify(parameters || {}), now, now);
  return res.json({ report: { id } });
});

router.get("/customer/generated-reports/:id/download", (_req: Request, res: Response) => {
  return res.status(501).json({ error: "Download not implemented" });
});

export default router;
