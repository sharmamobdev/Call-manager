import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import PDFDocument from "pdfkit";

const router = Router();
router.use(authenticate);

router.get("/customer/billing/summary", (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const activeNumbers = db.prepare("SELECT COUNT(*) as count FROM numbers WHERE organization_id = ? AND is_active = 1").get(orgId) as any;
  const rentals = db.prepare("SELECT COALESCE(SUM(monthly_rental), 0) as total FROM numbers WHERE organization_id = ? AND is_active = 1").get(orgId) as any;
  const lastInvoice = db.prepare("SELECT created_at FROM invoices WHERE organization_id = ? AND status = 'paid' ORDER BY created_at DESC LIMIT 1").get(orgId) as any;
  const pending = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE organization_id = ? AND status = 'pending'").get(orgId) as any;
  const ledger = db.prepare("SELECT balance FROM billing_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1").get(orgId) as any;

  return res.json({
    total_dids: activeNumbers?.count || 0,
    monthly_rental: (rentals?.total || 0).toFixed(2),
    current_balance: (ledger?.balance || 0).toFixed(2),
    pending_amount: (pending?.total || 0).toFixed(2),
    last_invoice_date: lastInvoice?.created_at || null,
  });
});

// ── Wallet: Deposit ──
router.post("/customer/wallet/deposit", (req: Request, res: Response) => {
  const { amount, description } = req.body;
  const deposit = parseFloat(amount);
  if (!deposit || deposit <= 0) return res.status(400).json({ error: "Amount must be > 0" });
  const orgId = req.user!.organizationId;
  const lastLedger = db.prepare("SELECT balance FROM billing_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1").get(orgId) as any;
  const currentBalance = lastLedger?.balance || 0;
  const newBalance = +(currentBalance + deposit).toFixed(2);
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO billing_ledger (id, organization_id, type, description, amount, balance, created_at, updated_at)
    VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?)`)
    .run(id, orgId, description || "Wallet deposit", deposit, newBalance, Date.now(), Date.now());
  return res.json({ deposit: { id, amount: deposit, balance: newBalance } });
});

// ── Wallet: Auto-topup settings ──
router.get("/customer/wallet/auto-topup", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  try {
    const s = org?.settings ? JSON.parse(org.settings) : {};
    return res.json({ enabled: !!s.autoTopupEnabled, threshold: s.autoTopupThreshold || 5, amount: s.autoTopupAmount || 20 });
  } catch {
    return res.json({ enabled: false, threshold: 5, amount: 20 });
  }
});

router.post("/customer/wallet/auto-topup", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  const current = org?.settings ? (() => { try { return JSON.parse(org.settings); } catch { return {}; } })() : {};
  const merged = { ...current, autoTopupEnabled: !!req.body.enabled, autoTopupThreshold: parseFloat(req.body.threshold || 5), autoTopupAmount: parseFloat(req.body.amount || 20) };
  db.prepare("UPDATE organizations SET settings = ? WHERE id = ?").run(JSON.stringify(merged), req.user!.organizationId);
  return res.json({ success: true });
});

router.get("/customer/billing/ledger", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM billing_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100").all(req.user!.organizationId) as any[];
  const entries = rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    amount: r.amount,
    balance: r.balance,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ entries });
});

router.get("/customer/billing/did-rentals", (req: Request, res: Response) => {
  const numbers = db.prepare("SELECT e164, monthly_rental, purchased_at, updated_at FROM numbers WHERE organization_id = ?").all(req.user!.organizationId);
  const charges = (numbers as any[]).map((n: any) => ({
    number: n.e164,
    rental: n.monthly_rental,
    from: n.purchased_at,
    to: n.updated_at,
  }));
  return res.json({ charges });
});

router.get("/customer/billing/dvnet-transactions", (_req: Request, res: Response) => {
  return res.json({ transactions: [] });
});

router.get("/customer/invoices", (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const rows = db.prepare("SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(req.user!.organizationId, pageSize, (page - 1) * pageSize) as any[];
  const invoices = rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    status: r.status,
    totalAmount: r.total_amount,
    currency: r.currency,
    dueDate: r.due_date || r.created_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ invoices });
});

router.get("/customer/invoices/:id", (req: Request, res: Response) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!invoice) return res.status(404).json({ error: "Not found" });
  invoice.items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id);
  return res.json(invoice);
});

router.get("/customer/invoices/:id/html", (req: Request, res: Response) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!invoice) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/html");
  return res.send(`<html><body><h1>Invoice ${invoice.invoice_number}</h1><p>Amount: $${invoice.total_amount}</p></body></html>`);
});

router.get("/customer/invoices/:id/pdf", (req: Request, res: Response) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id) as any[];
  const org = db.prepare("SELECT name FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
  doc.pipe(res);

  doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#666")
    .text(`Invoice #${invoice.invoice_number}`, { align: "center" })
    .text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, { align: "center" })
    .text(`Organization: ${org?.name || "N/A"}`, { align: "center" });
  doc.moveDown(1);

  doc.fillColor("#333").fontSize(10);
  doc.text(`Status: ${invoice.status}`);
  doc.text(`Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}`);
  if (invoice.paid_at) doc.text(`Paid: ${new Date(invoice.paid_at).toLocaleDateString()}`);
  doc.moveDown(0.5);

  // Items table
  doc.fontSize(8).fillColor("#999").text("Description", 50, doc.y, { width: 250 });
  doc.text("Qty", 310, doc.y - doc.currentLineHeight(), { width: 40, align: "right" });
  doc.text("Unit Price", 360, doc.y, { width: 80, align: "right" });
  doc.text("Total", 450, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.3);

  const lineY = doc.y;
  doc.strokeColor("#ccc").moveTo(50, lineY).lineTo(550, lineY).stroke();
  doc.moveDown(0.3);
  doc.fillColor("#333").fontSize(9);

  for (const item of items) {
    doc.text(item.description || "-", 50, doc.y, { width: 250 });
    doc.text(String(item.quantity || 1), 310, doc.y - doc.currentLineHeight(), { width: 40, align: "right" });
    doc.text(`$${(item.unit_price || 0).toFixed(2)}`, 360, doc.y, { width: 80, align: "right" });
    doc.text(`$${(item.total_price || 0).toFixed(2)}`, 450, doc.y, { width: 100, align: "right" });
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  const totalY = doc.y;
  doc.strokeColor("#ccc").moveTo(50, totalY).lineTo(550, totalY).stroke();
  doc.moveDown(0.3);
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#000");
  doc.text(`Total: $${(invoice.total_amount || 0).toFixed(2)}`, { align: "right" });

  doc.end();
});

export default router;
