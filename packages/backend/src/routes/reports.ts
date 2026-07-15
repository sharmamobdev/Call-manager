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

function generateCsvContent(orgId: string): string {
  const cdrs = db.prepare("SELECT * FROM cdrs WHERE organization_id = ? ORDER BY call_date DESC LIMIT 10000").all(orgId) as any[];
  const header = "CallSID,From,To,Direction,Duration,BillDuration,Cost,Rate,Status,Date\n";
  const rows = cdrs.map((c: any) =>
    `${c.call_sid || ""},${c.from_number},${c.to_number},${c.direction},${c.duration},${c.bill_duration},${c.cost},${c.rate},${c.status},${c.call_date}`
  ).join("\n");
  return header + rows;
}

router.post("/customer/daily-reports/generate-now", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const csv = generateCsvContent(orgId);
  const now = Date.now();
  const id = crypto.randomUUID();
  // Store CSV content as the file_url (inline)
  db.prepare("INSERT INTO generated_reports (id, organization_id, report_type, file_name, file_url, file_size, is_ready, generated_at, created_at, updated_at) VALUES (?, ?, 'campaign-summary', ?, ?, ?, 1, ?, ?, ?)")
    .run(id, orgId, `report-${now}.csv`, csv, Buffer.byteLength(csv, "utf8"), now, now, now);
  return res.json({ success: true, report: { id, fileName: `report-${now}.csv` } });
});

router.get("/customer/generated-reports", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM generated_reports WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId) as any[];
  const reports = rows.map((r) => ({
    id: r.id,
    reportType: r.report_type,
    fileName: r.file_name,
    fileSize: r.file_size,
    isReady: !!r.is_ready,
    generatedAt: r.generated_at,
    createdAt: r.created_at,
  }));
  return res.json({ reports });
});

router.post("/customer/generated-reports/create", (req: Request, res: Response) => {
  const { reportType, parameters } = req.body;
  const orgId = req.user!.organizationId;
  const now = Date.now();
  const id = crypto.randomUUID();
  const csv = generateCsvContent(orgId);
  db.prepare(`INSERT INTO generated_reports (id, organization_id, report_type, file_name, file_url, file_size, parameters, is_ready, generated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, '{}', 1, ?, ?, ?)`)
    .run(id, orgId, reportType || "custom", `report-${now}.csv`, csv, Buffer.byteLength(csv, "utf8"), now, now, now);
  return res.json({ report: { id, fileName: `report-${now}.csv` } });
});

router.get("/customer/generated-reports/:id/download", (req: Request, res: Response) => {
  const report = db.prepare("SELECT * FROM generated_reports WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${report.file_name}"`);
  return res.send(report.file_url || generateCsvContent(req.user!.organizationId));
});

export default router;
