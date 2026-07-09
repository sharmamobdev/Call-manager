import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { signalwire } from "../services/signalwire.js";

const router = Router();
router.use(authenticate);

router.get("/customer/numbers", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM numbers WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId) as any[];
  const numbers = rows.map((r) => ({
    id: r.id,
    e164: r.e164,
    friendlyName: r.friendly_name,
    organizationId: r.organization_id,
    campaignId: r.campaign_id,
    callVendorId: r.call_vendor_id,
    isActive: !!r.is_active,
    isTollFree: !!r.is_toll_free,
    monthlyRental: r.monthly_rental,
    ivrConfig: r.ivr_config ? JSON.parse(r.ivr_config) : null,
    signalwireSid: r.signalwire_sid,
    purchasedAt: r.purchased_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ numbers, allow_tfn: true });
});

router.get("/customer/available-numbers", async (req: Request, res: Response) => {
  try {
    const areaCode = req.query.area_code as string | undefined;
    const tollFree = req.query.toll_free === "true";
    const data = await signalwire.searchAvailable(areaCode, tollFree);
    const numbers = (data.available_phone_numbers || []).map((n: any) => ({
      phone_number: n.phone_number,
      price: parseFloat(n.cost || "1.00"),
      locality: n.locality || "",
      region: n.region || "",
    }));
    return res.json({ numbers, allow_tfn: true });
  } catch (err: any) {
    console.error("Available numbers error:", err.message);
    return res.status(502).json({ error: "Failed to fetch available numbers from carrier" });
  }
});

router.post("/customer/numbers/buy", async (req: Request, res: Response) => {
  try {
    const { area_code, phone_number, friendly_name, monthly_rental } = req.body;
    let result: any;

    if (phone_number) {
      result = await signalwire.purchaseNumber(phone_number, friendly_name);
    } else {
      const search = await signalwire.searchAvailable(area_code || undefined, false, 1);
      const available = search.available_phone_numbers || [];
      if (available.length === 0) {
        return res.status(400).json({ error: "No numbers available in that area code" });
      }
      result = await signalwire.purchaseNumber(available[0].phone_number, friendly_name);
    }

    const e164 = result.phone_number;
    const sid = result.sid || crypto.randomUUID();
    const price = parseFloat(result.cost || monthly_rental || "1.00");
    const id = crypto.randomUUID();

    db.prepare(`INSERT INTO numbers (id, e164, friendly_name, organization_id, is_active, is_toll_free, monthly_rental, signalwire_sid, purchased_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`).run(id, e164, friendly_name || e164, req.user!.organizationId, price, sid, Date.now(), Date.now(), Date.now());

    return res.json({ number: { id, e164, monthlyRental: price, signalwireSid: sid } });
  } catch (err: any) {
    console.error("Buy number error:", err.message);
    return res.status(502).json({ error: `Failed to purchase number: ${err.message}` });
  }
});

router.patch("/customer/numbers/:id", (req: Request, res: Response) => {
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    sets.push(`${col} = ?`);
    params.push(value);
  }
  sets.push("updated_at = ?");
  params.push(Date.now(), req.params.id, req.user!.organizationId);
  db.prepare(`UPDATE numbers SET ${sets.join(", ")} WHERE id = ? AND organization_id = ?`).run(...params);
  return res.json({ success: true });
});

router.post("/customer/numbers/:id/assign-campaign", (req: Request, res: Response) => {
  db.prepare("UPDATE numbers SET campaign_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(req.body.campaign_id, Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.post("/customer/numbers/:id/assign-vendor", (req: Request, res: Response) => {
  db.prepare("UPDATE numbers SET call_vendor_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(req.body.call_vendor_id, Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.post("/customer/numbers/:id/ivr", (req: Request, res: Response) => {
  db.prepare("UPDATE numbers SET ivr_config = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(JSON.stringify(req.body), Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.post("/customer/numbers/:id/test", (_req: Request, res: Response) => {
  return res.json({ success: true, message: "Test initiated" });
});

router.get("/customer/numbers/:id/test-runs", (_req: Request, res: Response) => {
  return res.json({ test_runs: [] });
});

router.get("/customer/campaigns", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM campaigns WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId) as any[];
  const campaigns = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    useCase: r.use_case,
    sampleMessages: r.sample_messages ? JSON.parse(r.sample_messages) : [],
    monthlyVolume: r.monthly_volume,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ campaigns });
});

router.get("/customer/campaigns/:id", (req: Request, res: Response) => {
  const r = db.prepare("SELECT * FROM campaigns WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!r) return res.status(404).json({ error: "Not found" });
  return res.json({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    useCase: r.use_case,
    a2pBrandId: r.a2p_brand_id,
    a2pCampaignId: r.a2p_campaign_id,
    sampleMessages: r.sample_messages ? JSON.parse(r.sample_messages) : [],
    monthlyVolume: r.monthly_volume,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
});

router.post("/customer/campaigns", (req: Request, res: Response) => {
  const { name, description, useCase, sampleMessages, monthlyVolume } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO campaigns (id, name, description, organization_id, use_case, sample_messages, monthly_volume, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, description || null, req.user!.organizationId, useCase || null, JSON.stringify(sampleMessages || []), monthlyVolume || 0, now, now);
  return res.json({ campaign: { id, name, description, useCase } });
});

router.patch("/customer/campaigns/:id", (req: Request, res: Response) => {
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (value === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(value);
  }
  if (!sets.length) return res.status(400).json({ error: "No fields to update" });
  sets.push("updated_at = ?");
  params.push(Date.now(), req.params.id, req.user!.organizationId);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ? AND organization_id = ?`).run(...params);
  return res.json({ success: true });
});

router.delete("/customer/campaigns/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM campaigns WHERE id = ? AND organization_id = ?").run(req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.get("/customer/campaigns/:id/analytics", (req: Request, res: Response) => {
  return res.json({ totalCalls: 0, answeredCalls: 0, avgDuration: 0, totalCost: "0", daily: [] });
});

function mapBuyer(r: any) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    description: r.description,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get("/customer/buyers", (req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM buyers WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId) as any[];
  return res.json({ buyers: rows.map(mapBuyer) });
});

router.get("/customer/buyers/:id", (req: Request, res: Response) => {
  const r = db.prepare("SELECT * FROM buyers WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!r) return res.status(404).json({ error: "Not found" });

  const campaigns = db.prepare(`
    SELECT cb.id as link_id, c.id as campaign_id, c.name as campaign_name
    FROM campaign_buyers cb
    JOIN campaigns c ON c.id = cb.campaign_id
    WHERE cb.buyer_id = ?
  `).all(req.params.id) as any[];

  const groups = db.prepare(`
    SELECT bgm.id as membership_id, bg.id as group_id, bg.name as group_name
    FROM buyer_group_members bgm
    JOIN buyer_groups bg ON bg.id = bgm.group_id
    WHERE bgm.buyer_id = ?
  `).all(req.params.id) as any[];

  return res.json({ ...mapBuyer(r), campaigns, groups });
});

router.post("/customer/buyers", (req: Request, res: Response) => {
  const { name, email, phone, description } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO buyers (id, name, email, phone, description, organization_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, email || null, phone || null, description || null, req.user!.organizationId, now, now);
  return res.json({ buyer: { id, name, email, phone } });
});

router.patch("/customer/buyers/:id", (req: Request, res: Response) => {
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (value === undefined) continue;
    sets.push(`${col} = ?`);
    params.push(value);
  }
  if (!sets.length) return res.status(400).json({ error: "No fields to update" });
  sets.push("updated_at = ?");
  params.push(Date.now(), req.params.id, req.user!.organizationId);
  db.prepare(`UPDATE buyers SET ${sets.join(", ")} WHERE id = ? AND organization_id = ?`).run(...params);
  return res.json({ success: true });
});

router.delete("/customer/buyers/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM campaign_buyers WHERE buyer_id = ?").run(req.params.id);
  db.prepare("DELETE FROM buyer_group_members WHERE buyer_id = ?").run(req.params.id);
  db.prepare("DELETE FROM buyers WHERE id = ? AND organization_id = ?").run(req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.get("/customer/campaign-buyers", (_req: Request, res: Response) => {
  const list = db.prepare(`
    SELECT cb.*, c.name as campaign_name, b.name as buyer_name
    FROM campaign_buyers cb
    JOIN campaigns c ON c.id = cb.campaign_id
    JOIN buyers b ON b.id = cb.buyer_id
  `).all();
  return res.json({ campaign_buyers: list });
});

router.post("/customer/campaign-buyers", (req: Request, res: Response) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO campaign_buyers (id, campaign_id, buyer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, req.body.campaign_id, req.body.buyer_id, now, now);
  const buyer = db.prepare("SELECT name FROM buyers WHERE id = ?").get(req.body.buyer_id) as any;
  return res.json({ campaign_buyer: { id, campaign_id: req.body.campaign_id, buyer_id: req.body.buyer_id, buyer_name: buyer?.name } });
});

router.delete("/customer/campaign-buyers/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM campaign_buyers WHERE id = ?").run(req.params.id);
  return res.json({ success: true });
});

// Buyer Groups
router.get("/customer/buyer-groups", (req: Request, res: Response) => {
  const groups = db.prepare("SELECT * FROM buyer_groups WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId);
  return res.json({ buyer_groups: groups });
});

router.get("/customer/buyer-groups/:id", (req: Request, res: Response) => {
  const group = db.prepare("SELECT * FROM buyer_groups WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!group) return res.status(404).json({ error: "Not found" });
  const members = db.prepare(`
    SELECT bgm.id as membership_id, b.id as buyer_id, b.name as buyer_name, b.email, b.phone
    FROM buyer_group_members bgm
    JOIN buyers b ON b.id = bgm.buyer_id
    WHERE bgm.group_id = ?
  `).all(req.params.id);
  return res.json({ id: group.id, name: group.name, members });
});

router.get("/customer/buyer-groups/:id/members", (req: Request, res: Response) => {
  const members = db.prepare(`
    SELECT bgm.*, b.name as buyer_name FROM buyer_group_members bgm
    LEFT JOIN buyers b ON b.id = bgm.buyer_id
    WHERE bgm.group_id = ?
  `).all(req.params.id);
  return res.json({ members });
});

router.post("/customer/buyer-groups", (req: Request, res: Response) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO buyer_groups (id, name, organization_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.body.name, req.user!.organizationId, now, now);
  return res.json({ buyer_group: { id, name: req.body.name } });
});

router.delete("/customer/buyer-groups/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM buyer_group_members WHERE group_id = ?").run(req.params.id);
  db.prepare("DELETE FROM buyer_groups WHERE id = ? AND organization_id = ?").run(req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.post("/customer/buyer-groups/:id/members", (req: Request, res: Response) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO buyer_group_members (id, group_id, buyer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.params.id, req.body.buyer_id, now, now);
  return res.json({ member: { id } });
});

router.delete("/customer/buyer-groups/:id/members/:memberId", (req: Request, res: Response) => {
  db.prepare("DELETE FROM buyer_group_members WHERE id = ? AND group_id = ?").run(req.params.memberId, req.params.id);
  return res.json({ success: true });
});

router.get("/customer/call-vendors", (req: Request, res: Response) => {
  const vendors = db.prepare("SELECT * FROM call_vendors WHERE organization_id = ?").all(req.user!.organizationId);
  return res.json({ call_vendors: vendors });
});

export default router;
