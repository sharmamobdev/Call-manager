import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { signalwire } from "../services/signalwire.js";
import { parsePhoneNumber } from "libphonenumber-js";

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  try {
    const num = parsePhoneNumber(phone, "US");
    if (num && num.isValid()) return num.format("E.164");
  } catch { /* ignore */ }
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
  if (cleaned.startsWith("+")) return phone;
  return phone || null;
}

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
    const data = await signalwire.searchAvailable(areaCode, tollFree, 20);
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

    // Auto-configure webhook on SignalWire so calls route to our backend
    const baseUrl = `https://${req.get("host")}`.replace(/\/+$/, "");
    await signalwire.updateNumber(sid, {
      VoiceUrl: `${baseUrl}/v1/webhook/voice/${sid}`,
      VoiceMethod: "POST",
      StatusCallback: `${baseUrl}/v1/webhook/status`,
      StatusCallbackMethod: "POST",
      SmsUrl: `${baseUrl}/v1/webhook/sms/${sid}`,
      SmsMethod: "POST",
    }).catch((err: any) => console.error("Auto-configure webhook failed:", err.message));

    return res.json({ number: { id, e164, monthlyRental: price, signalwireSid: sid } });
  } catch (err: any) {
    console.error("Buy number error:", err.message);
    return res.status(502).json({ error: `Failed to purchase number: ${err.message}` });
  }
});

router.patch("/customer/numbers/:id", (req: Request, res: Response) => {
  const allowed = new Set(["friendlyName", "campaignId", "callVendorId", "isActive", "ivrConfig"]);
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.has(key)) continue;
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

router.post("/customer/numbers/:id/configure-webhook", async (req: Request, res: Response) => {
  try {
    const number = db.prepare("SELECT * FROM numbers WHERE id = ? AND organization_id = ?")
      .get(req.params.id, req.user!.organizationId) as any;
    if (!number) return res.status(404).json({ error: "Number not found" });
    if (!number.signalwire_sid) return res.status(400).json({ error: "Number has no SignalWire SID — sync it first" });

    const baseUrl = (req.body.base_url || `https://${req.get("host")}`).replace(/\/+$/, "");

    await signalwire.updateNumber(number.signalwire_sid, {
      VoiceUrl: `${baseUrl}/v1/webhook/voice/${number.signalwire_sid}`,
      VoiceMethod: "POST",
      StatusCallback: `${baseUrl}/v1/webhook/status`,
      StatusCallbackMethod: "POST",
      SmsUrl: `${baseUrl}/v1/webhook/sms/${number.signalwire_sid}`,
      SmsMethod: "POST",
    });

    return res.json({ success: true, message: "Webhook configured on SignalWire" });
  } catch (err: any) {
    console.error("Configure webhook error:", err.message);
    return res.status(502).json({ error: `Failed to configure webhook: ${err.message}` });
  }
});

router.get("/customer/campaigns", (req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const rows = db.prepare(`
    SELECT c.*,
      GROUP_CONCAT(DISTINCT b.name) as buyer_names,
      GROUP_CONCAT(DISTINCT b.phone) as buyer_phones,
      GROUP_CONCAT(DISTINCT n.e164) as did_numbers
    FROM campaigns c
    LEFT JOIN campaign_buyers cb ON cb.campaign_id = c.id
    LEFT JOIN buyers b ON b.id = cb.buyer_id
    LEFT JOIN numbers n ON n.campaign_id = c.id
    WHERE c.organization_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.user!.organizationId) as any[];

  const campaigns = rows.map((r) => {
    // Compute todayCC: sum of active calls across linked buyers
    let todayCC = 0;
    if (r.buyer_phones) {
      const phones = r.buyer_phones.split(",").filter(Boolean);
      if (phones.length > 0) {
        const placeholders = phones.map(() => "?").join(",");
        const ccRow = db.prepare(`SELECT COUNT(*) as cc FROM cdrs WHERE buyer_number IN (${placeholders}) AND status IN ('ringing', 'in-progress') AND call_date >= ?`).get(...phones, startOfDayMs) as any;
        todayCC = ccRow?.cc || 0;
      }
    }

    // Compute totalCap: sum of linked buyers' daily_caps (>0 only)
    let totalCap = 0;
    if (r.buyer_phones) {
      const phones = r.buyer_phones.split(",").filter(Boolean);
      if (phones.length > 0) {
        const placeholders = phones.map(() => "?").join(",");
        const capRow = db.prepare(`SELECT COALESCE(SUM(daily_cap), 0) as cap FROM buyers WHERE phone IN (${placeholders}) AND daily_cap > 0`).get(...phones) as any;
        totalCap = capRow?.cap || 0;
      }
    }
    // If campaign has its own daily_cap, use min of campaign cap and buyer sum
    if (r.daily_cap > 0) {
      totalCap = totalCap > 0 ? Math.min(r.daily_cap, totalCap) : r.daily_cap;
    }

    // Compute totalMaxConcurrent: sum of linked buyers' max_concurrent (>0 only)
    let totalMaxConcurrent = 0;
    if (r.buyer_phones) {
      const phones = r.buyer_phones.split(",").filter(Boolean);
      if (phones.length > 0) {
        const placeholders = phones.map(() => "?").join(",");
        const mcRow = db.prepare(`SELECT COALESCE(SUM(max_concurrent), 0) as mc FROM buyers WHERE phone IN (${placeholders}) AND max_concurrent > 0`).get(...phones) as any;
        totalMaxConcurrent = mcRow?.mc || 0;
      }
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      useCase: r.use_case,
      sampleMessages: r.sample_messages ? JSON.parse(r.sample_messages) : [],
      monthlyVolume: r.monthly_volume,
      isActive: !!r.is_active,
      buyerNames: r.buyer_names || null,
      buyerPhones: r.buyer_phones || null,
      didNumbers: r.did_numbers || null,
      duplicateHandling: r.duplicate_handling || "same_buyer",
      dailyCap: r.daily_cap || 0,
      todayCC,
      totalCap,
      totalMaxConcurrent,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
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
  const { name, description, useCase, sampleMessages, monthlyVolume, duplicateHandling, dailyCap } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO campaigns (id, name, description, organization_id, use_case, sample_messages, monthly_volume, duplicate_handling, daily_cap, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, description || null, req.user!.organizationId, useCase || null, JSON.stringify(sampleMessages || []), monthlyVolume || 0, duplicateHandling || "same_buyer", dailyCap || 0, now, now);
  return res.json({ campaign: { id, name, description, useCase } });
});

router.patch("/customer/campaigns/:id", (req: Request, res: Response) => {
  const allowed = new Set(["name", "description", "status", "useCase", "duplicateHandling", "dailyCap"]);
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.has(key)) continue;
    if (value === undefined) continue;
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
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
  const orgId = req.user!.organizationId;
  const campId = req.params.id;
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as answered_calls,
      COALESCE(AVG(duration), 0) as avg_duration,
      COALESCE(SUM(cost), 0) as total_cost
    FROM cdrs
    WHERE organization_id = ?
      AND to_number IN (SELECT e164 FROM numbers WHERE campaign_id = ?)
  `).get(orgId, campId) as any;

  const dailyRows = db.prepare(`
    SELECT strftime('%Y-%m-%d', call_date / 1000, 'unixepoch') as date,
           COUNT(*) as count,
           COALESCE(SUM(cost), 0) as cost
    FROM cdrs
    WHERE organization_id = ?
      AND to_number IN (SELECT e164 FROM numbers WHERE campaign_id = ?)
    GROUP BY date ORDER BY date DESC LIMIT 30
  `).all(orgId, campId) as any[];

  return res.json({
    totalCalls: row?.total_calls || 0,
    answeredCalls: row?.answered_calls || 0,
    avgDuration: Math.round(row?.avg_duration || 0),
    totalCost: (row?.total_cost || 0).toFixed(2),
    daily: dailyRows || [],
  });
});

function mapBuyer(r: any) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    description: r.description,
    isActive: !!r.is_active,
    dailyCap: r.daily_cap || 0,
    maxConcurrent: r.max_concurrent || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get("/customer/buyers", (req: Request, res: Response) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const rows = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM campaign_buyers cb WHERE cb.buyer_id = b.id) as campaign_count,
      (SELECT COUNT(*) FROM cdrs WHERE buyer_number = b.phone AND status IN ('ringing', 'in-progress') AND call_date >= ?) as today_cc
    FROM buyers b
    WHERE b.organization_id = ?
    ORDER BY b.created_at DESC
  `).all(startOfDayMs, req.user!.organizationId) as any[];
  if (rows.length > 0) {
    const sample = rows[0];
    console.log(`[GET /customer/buyers] org=${req.user!.organizationId} count=${rows.length} sample: id=${sample.id} daily_cap=${sample.daily_cap} max_concurrent=${sample.max_concurrent} today_cc=${sample.today_cc}`);
  }
  return res.json({ buyers: rows.map((r) => ({ ...mapBuyer(r), campaignCount: r.campaign_count || 0, todayCC: r.today_cc || 0 })) });
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
  const { name, email, phone, description, dailyCap, maxConcurrent } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO buyers (id, name, email, phone, description, daily_cap, max_concurrent, organization_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name, email || null, normalizedPhone, description || null, dailyCap || 0, maxConcurrent || 0, req.user!.organizationId, now, now);
  return res.json({ buyer: { id, name, email, phone: normalizedPhone } });
});

router.patch("/customer/buyers/:id", (req: Request, res: Response) => {
  const allowed = new Set(["name", "email", "phone", "description", "dailyCap", "maxConcurrent"]);
  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.has(key)) continue;
    if (value === undefined) continue;
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (col === "phone") {
      params.push(normalizePhone(value as string));
    } else {
      params.push(value);
    }
    sets.push(`${col} = ?`);
  }
  if (!sets.length) return res.status(400).json({ error: "No fields to update" });
  sets.push("updated_at = ?");
  params.push(Date.now(), req.params.id, req.user!.organizationId);
  const result = db.prepare(`UPDATE buyers SET ${sets.join(", ")} WHERE id = ? AND organization_id = ?`).run(...params);
  console.log(`[PATCH /customer/buyers/${req.params.id}] sets=${sets.join(", ")} result.changes=${result.changes}`);
  return res.json({ success: true });
});

router.delete("/customer/buyers/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM campaign_buyers WHERE buyer_id = ?").run(req.params.id);
  db.prepare("DELETE FROM buyer_group_members WHERE buyer_id = ?").run(req.params.id);
  db.prepare("DELETE FROM buyers WHERE id = ? AND organization_id = ?").run(req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

router.get("/customer/campaign-buyers", (req: Request, res: Response) => {
  const list = db.prepare(`
    SELECT cb.*, c.name as campaign_name, b.name as buyer_name
    FROM campaign_buyers cb
    JOIN campaigns c ON c.id = cb.campaign_id AND c.organization_id = ?
    JOIN buyers b ON b.id = cb.buyer_id AND b.organization_id = ?
  `).all(req.user!.organizationId, req.user!.organizationId);
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
  const result = db.prepare("DELETE FROM campaign_buyers WHERE id = ? AND campaign_id IN (SELECT id FROM campaigns WHERE organization_id = ?)").run(req.params.id, req.user!.organizationId);
  return res.json({ success: !!result.changes });
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

router.patch("/customer/buyer-groups/:id", (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  db.prepare("UPDATE buyer_groups SET name = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(name, Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true });
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
  const rows = db.prepare("SELECT * FROM call_vendors WHERE organization_id = ?").all(req.user!.organizationId) as any[];
  const vendors = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return res.json({ call_vendors: vendors });
});

// ── Campaign Routing Strategy ──
router.patch("/customer/campaigns/:id/routing", (req: Request, res: Response) => {
  const { strategy } = req.body;
  if (!["sequential", "round_robin", "concurrent"].includes(strategy)) {
    return res.status(400).json({ error: "Invalid strategy. Use: sequential, round_robin, concurrent" });
  }
  db.prepare("UPDATE campaigns SET routing_strategy = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(strategy, Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true, strategy });
});

// ── Blocklist ──
router.get("/customer/blocklist", (req: Request, res: Response) => {
  const list = db.prepare("SELECT * FROM blocklists WHERE organization_id = ? ORDER BY created_at DESC").all(req.user!.organizationId);
  return res.json({ blocklist: list });
});

router.post("/customer/blocklist", (req: Request, res: Response) => {
  const { type, value, reason } = req.body;
  if (!["number", "prefix", "country"].includes(type)) {
    return res.status(400).json({ error: "type must be number, prefix, or country" });
  }
  if (!value) return res.status(400).json({ error: "value is required" });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO blocklists (id, organization_id, type, value, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, req.user!.organizationId, type, value, reason || null, Date.now());
  return res.json({ blocklist_entry: { id, type, value, reason } });
});

router.delete("/customer/blocklist/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM blocklists WHERE id = ? AND organization_id = ?").run(req.params.id, req.user!.organizationId);
  return res.json({ success: true });
});

// ── Fraud / Rate-limit Settings ──
router.get("/customer/settings/fraud", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  const settings = org?.settings ? (() => { try { return JSON.parse(org.settings); } catch { return {}; } })() : {};
  return res.json({
    maxCallsPerMinute: settings.maxCallsPerMinute || 10,
    maxCountriesPerHour: settings.maxCountriesPerHour || 3,
    blockAnonymized: settings.blockAnonymized ?? true,
    businessHoursOnly: settings.businessHoursOnly ?? false,
    businessHoursStart: settings.businessHoursStart || "09:00",
    businessHoursEnd: settings.businessHoursEnd || "17:00",
    timezone: settings.timezone || "America/New_York",
  });
});

router.patch("/customer/settings/fraud", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  const current = org?.settings ? (() => { try { return JSON.parse(org.settings); } catch { return {}; } })() : {};
  const merged = { ...current, ...req.body };
  db.prepare("UPDATE organizations SET settings = ? WHERE id = ?").run(JSON.stringify(merged), req.user!.organizationId);
  return res.json({ success: true });
});

// ── SMTP Settings ──
router.get("/customer/organization/smtp", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  const s = org?.settings ? (() => { try { return JSON.parse(org.settings); } catch { return {}; } })() : {};
  return res.json({ host: s.smtpHost || "", port: parseInt(s.smtpPort || "587"), user: s.smtpUser || "", fromEmail: s.smtpFrom || "" });
});

router.post("/customer/organization/smtp", (req: Request, res: Response) => {
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(req.user!.organizationId) as any;
  const current = org?.settings ? (() => { try { return JSON.parse(org.settings); } catch { return {}; } })() : {};
  const merged = { ...current, smtpHost: req.body.host, smtpPort: String(req.body.port || "587"), smtpUser: req.body.user || "", smtpPass: req.body.pass || current.smtpPass, smtpFrom: req.body.fromEmail };
  db.prepare("UPDATE organizations SET settings = ? WHERE id = ?").run(JSON.stringify(merged), req.user!.organizationId);
  return res.json({ success: true });
});

// ── Number Call Rate ──
router.patch("/customer/numbers/:id/rate", (req: Request, res: Response) => {
  const { ratePerMinute } = req.body;
  if (ratePerMinute === undefined) return res.status(400).json({ error: "ratePerMinute is required" });
  const number = db.prepare("SELECT * FROM numbers WHERE id = ? AND organization_id = ?").get(req.params.id, req.user!.organizationId) as any;
  if (!number) return res.status(404).json({ error: "Number not found" });
  const ivrConfig = number.ivr_config ? (() => { try { return JSON.parse(number.ivr_config); } catch { return {}; } })() : {};
  ivrConfig.ratePerMinute = parseFloat(ratePerMinute);
  db.prepare("UPDATE numbers SET ivr_config = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(JSON.stringify(ivrConfig), Date.now(), req.params.id, req.user!.organizationId);
  return res.json({ success: true, ratePerMinute: parseFloat(ratePerMinute) });
});

export default router;
