import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

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

router.get("/customer/billing/ledger", (req: Request, res: Response) => {
  const entries = db.prepare("SELECT * FROM billing_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100").all(req.user!.organizationId);
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
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const invoices = db.prepare("SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(req.user!.organizationId, pageSize, (page - 1) * pageSize);
  return res.json({ invoices });
});

router.get("/customer/invoices/:id", (req: Request, res: Response) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!invoice) return res.status(404).json({ error: "Not found" });
  invoice.items = db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").all(req.params.id);
  return res.json(invoice);
});

router.get("/customer/invoices/:id/html", (req: Request, res: Response) => {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id) as any;
  if (!invoice) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/html");
  return res.send(`<html><body><h1>Invoice ${invoice.invoice_number}</h1><p>Amount: $${invoice.total_amount}</p></body></html>`);
});

router.get("/customer/invoices/:id/pdf", (_req: Request, res: Response) => {
  return res.status(501).json({ error: "PDF generation not implemented" });
});

export default router;
