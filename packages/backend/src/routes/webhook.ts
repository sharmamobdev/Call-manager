import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { broadcastCdrEvent } from "../services/events.js";

const router = Router();

function uid(): string {
  return crypto.randomUUID();
}

function twilioBaseUrl(req: Request): string {
  return `https://${req.get("host")}/v1`;
}

// ── dial-result handles one <Dial> leg and chains to the next buyer if needed ──
// Update CDR status and chain to next buyer if the leg was not answered.
router.post("/webhook/voice/dial-result", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const dialCallStatus = req.body.DialCallStatus;
  const dialCallDuration = req.body.DialCallDuration;
  const answeredBy = req.body.AnsweredBy;
  const cdrId = req.query.cdrId as string;
  const currentBuyerIndex = Math.max(0, parseInt((req.query.currentBuyerIndex as string) || "0") || 0);
  const campaignId = req.query.campaignId as string;
  const orgId = req.query.orgId as string;
  const status = dialCallStatus?.toLowerCase() || "no-answer";
  const reason = dialCallStatus || "unknown";
  const routingAttempt = currentBuyerIndex + 1;

  console.log(`[Webhook] Dial result — CallSid: ${callSid}, Status: ${status}, AnsweredBy: ${answeredBy || "-"}, Duration: ${dialCallDuration}s, BuyerIndex: ${currentBuyerIndex}`);

  // Treat machine detection (voicemail) as no-answer so we retry the next buyer
  const isMachine = answeredBy === "machine_start" || answeredBy === "machine_end";
  const resolvedStatus = isMachine ? "no-answer" : status;

  // Compute answered_at: set when call is first answered
  const answeredAt = resolvedStatus === "completed" ? Date.now() : null;

  // Update CDR via callSid or fallback to cdrId
  let updated = false;
  let resolvedOrgId = orgId || "";
  if (callSid) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      const durationNum = parseInt(dialCallDuration || "0");
      db.prepare(`UPDATE cdrs SET status = ?, reason = ?, routing_attempt = ?, 
        answered_at = COALESCE(?, answered_at), ended_at = ?,
        duration = ?, bill_duration = ?, updated_at = ? WHERE id = ?`)
        .run(resolvedStatus, reason, routingAttempt, answeredAt, Date.now(), durationNum, durationNum, Date.now(), existing.id);
      resolvedOrgId = existing.organization_id;
      updated = true;
    }
  }
  if (!updated && cdrId) {
    const durationNum = parseInt(dialCallDuration || "0");
    db.prepare(`UPDATE cdrs SET status = ?, reason = ?, routing_attempt = ?,
      answered_at = COALESCE(?, answered_at), ended_at = ?,
      duration = ?, bill_duration = ?, updated_at = ? WHERE id = ?`)
      .run(resolvedStatus, reason, routingAttempt, answeredAt, Date.now(), durationNum, durationNum, Date.now(), cdrId);
    if (!resolvedOrgId) {
      const cdr = db.prepare("SELECT organization_id FROM cdrs WHERE id = ?").get(cdrId) as any;
      if (cdr) resolvedOrgId = cdr.organization_id;
    }
  }

  if (resolvedOrgId) {
    const isTerminal = ["completed", "no-answer", "busy", "failed"].includes(resolvedStatus);
    broadcastCdrEvent({
      type: isTerminal ? "call-end" : "call-update",
      organizationId: resolvedOrgId,
      cdr: { id: cdrId || "", callSid, fromNumber: "", toNumber: "", direction: "inbound", status: resolvedStatus, duration: parseInt(dialCallDuration || "0"), cost: 0, callDate: Date.now(), reason, routingAttempt, answeredAt: answeredAt || undefined },
    });
  }

  res.setHeader("Content-Type", "text/xml");

  // If no-answer/busy/failed/machine and there are more buyers, chain to the next one
  const shouldRetry = ["no-answer", "busy", "failed"].includes(resolvedStatus);
  if (shouldRetry && campaignId) {
    const nextIndex = currentBuyerIndex + 1;
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${escapeXml(twilioBaseUrl(req) + `/webhook/voice/retry/${campaignId}/${nextIndex}/${cdrId || ""}`)}</Redirect></Response>`
    );
  }

  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// ── Sequential failover retry endpoint ──
router.post("/webhook/voice/retry/:campaignId/:buyerIndex/:cdrId", (req: Request, res: Response) => {
  const campaignId = req.params.campaignId;
  const buyerIndex = Math.max(0, parseInt(req.params.buyerIndex) || 0);
  const cdrId = req.params.cdrId;
  const callSid = req.body.CallSid;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as any;

  const allBuyers = db.prepare(`
    SELECT b.id, b.name, b.phone, b.daily_cap, b.max_concurrent
    FROM buyers b
    INNER JOIN campaign_buyers cb ON cb.buyer_id = b.id
    WHERE cb.campaign_id = ?
      AND b.phone IS NOT NULL AND b.phone != ''
    ORDER BY cb.routing_order ASC, b.name ASC
  `).all(campaignId) as any[];

  // Apply same filtering as main webhook
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  // Duplicate handling
  let excludedBuyerPhones: string[] = [];
  if (campaign?.duplicate_handling === "different_buyer" && cdrId) {
    const existingCdr = db.prepare("SELECT from_number FROM cdrs WHERE id = ?").get(cdrId) as any;
    if (existingCdr?.from_number) {
      const prevCdr = db.prepare(`SELECT buyer_number FROM cdrs WHERE from_number = ? AND campaign_name = ? AND buyer_number IS NOT NULL ORDER BY call_date DESC LIMIT 1`).get(existingCdr.from_number, campaign.name) as any;
      if (prevCdr?.buyer_number) excludedBuyerPhones.push(prevCdr.buyer_number);
    }
  }

  const buyers = allBuyers.filter((b) => {
    if (excludedBuyerPhones.includes(b.phone)) return false;
    if (b.daily_cap > 0) {
      const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM cdrs WHERE buyer_number = ? AND status = 'completed' AND call_date >= ?`).get(b.phone, startOfDayMs) as any;
      if (cnt && cnt.cnt >= b.daily_cap) return false;
    }
    if (b.max_concurrent > 0) {
      const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM cdrs WHERE buyer_number = ? AND status IN ('ringing', 'in-progress') AND call_date >= ?`).get(b.phone, startOfDayMs) as any;
      if (cnt && cnt.cnt >= b.max_concurrent) return false;
    }
    return true;
  });

  const number = db.prepare("SELECT e164, organization_id FROM numbers WHERE campaign_id = ?").get(campaignId) as any;

  res.setHeader("Content-Type", "text/xml");

  if (buyerIndex < buyers.length) {
    const buyer = buyers[buyerIndex];
    const twiml =
      `<?xml version="1.0" encoding="UTF-8"?><Response>` +
      `<Say voice="male">Please hold while we connect you.</Say>` +
      `<Dial timeout="25" answerOnBridge="true" machineDetection="DetectMessageEnd" record="record-from-ringing" recordingStatusCallback="${escapeXml(twilioBaseUrl(req) + "/webhook/recording-status")}" action="${escapeXml(twilioBaseUrl(req) + `/webhook/voice/dial-result?cdrId=${cdrId}&currentBuyerIndex=${buyerIndex}&campaignId=${campaignId}&orgId=${number?.organization_id || ""}`)}">` +
      `<Number>${escapeXml(buyer.phone)}</Number></Dial></Response>`;
    return res.send(twiml);
  }

  // No more buyers — mark CDR as no-answer
  if (cdrId) {
    db.prepare("UPDATE cdrs SET status = 'no-answer', duration = 0, bill_duration = 0, updated_at = ? WHERE id = ?")
      .run(Date.now(), cdrId);
    if (number?.organization_id) {
      broadcastCdrEvent({
        type: "call-end",
        organizationId: number.organization_id,
        cdr: { id: cdrId, callSid: req.body.CallSid, fromNumber: "", toNumber: "", direction: "inbound", status: "no-answer", duration: 0, cost: 0, callDate: Date.now(), reason: "no-answer", routingAttempt: buyerIndex + 1 },
      });
    }
  }

  return res.send(
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say voice="male">We are sorry, no one is available to take your call. Please try again later.</Say></Response>`
  );
});

// ── Main voice webhook ──
// Called when an incoming call arrives from SignalWire.
// The :numberId param is the SignalWire SID which we store as signalwire_sid.
router.all("/webhook/voice/:numberId", (req: Request, res: Response) => {
  const callSid = req.body?.CallSid || req.query?.CallSid;
  const from = req.body?.From || req.query?.From;
  const to = req.body?.To || req.query?.To;
  const numberId = req.params.numberId;

  console.log(`[Webhook] Incoming call — From: ${from}, To: ${to}, CallSid: ${callSid}, NumberID: ${numberId}`);

  // Look up number
  let number = db.prepare("SELECT * FROM numbers WHERE signalwire_sid = ?").get(numberId) as any;
  if (!number) number = db.prepare("SELECT * FROM numbers WHERE e164 = ?").get(to) as any;
  if (!number) {
    console.error(`[Webhook] Number not found — numberId=${numberId}, e164=${to}`);
    res.setHeader("Content-Type", "text/xml");
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="male">The number is not configured.</Say></Response>`);
  }

  const orgId = number.organization_id;
  const campaignId = number.campaign_id;
  const now = Date.now();

  // Find campaign + routing strategy
  let campaign: any = null;
  if (campaignId) {
    campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as any;
  }

  // Check campaign daily cap
  if (campaign && campaign.daily_cap > 0) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const capRow = db.prepare(`SELECT COUNT(*) as cnt FROM cdrs WHERE campaign_name = ? AND status = 'completed' AND call_date >= ?`).get(campaign.name, startOfDay.getTime()) as any;
    if (capRow && capRow.cnt >= campaign.daily_cap) {
      console.log(`[Webhook] Campaign daily cap reached — campaign=${campaign.name}, cap=${campaign.daily_cap}`);
      res.setHeader("Content-Type", "text/xml");
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="male">Sorry, this campaign has reached its daily call limit. Please try again tomorrow.</Say><Hangup/></Response>`);
    }
  }

  // Find buyers ordered by routing_order
  let buyers: any[] = [];
  if (campaignId) {
    buyers = db.prepare(`
      SELECT b.id, b.name, b.phone, b.daily_cap, b.max_concurrent
      FROM buyers b
      INNER JOIN campaign_buyers cb ON cb.buyer_id = b.id
      WHERE cb.campaign_id = ?
        AND b.phone IS NOT NULL AND b.phone != ''
      ORDER BY cb.routing_order ASC, b.name ASC
    `).all(campaignId) as any[];
  }

  // Duplicate handling: if different_buyer, find previous buyer and exclude
  let excludedBuyerPhones: string[] = [];
  if (campaign && campaign.duplicate_handling === "different_buyer" && from) {
    const prevCdr = db.prepare(`SELECT buyer_number FROM cdrs WHERE from_number = ? AND campaign_name = ? AND buyer_number IS NOT NULL ORDER BY call_date DESC LIMIT 1`).get(from, campaign.name) as any;
    if (prevCdr?.buyer_number) {
      excludedBuyerPhones.push(prevCdr.buyer_number);
      console.log(`[Webhook] Duplicate handling — excluding previous buyer ${prevCdr.buyer_number} for caller ${from}`);
    }
  }

  // Filter buyers by daily cap, max concurrent, and duplicate handling
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const eligibleBuyers = buyers.filter((b) => {
    // Exclude previous buyer for duplicate handling
    if (excludedBuyerPhones.includes(b.phone)) return false;

    // Check daily cap
    if (b.daily_cap > 0) {
      const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM cdrs WHERE buyer_number = ? AND status = 'completed' AND call_date >= ?`).get(b.phone, startOfDayMs) as any;
      if (cnt && cnt.cnt >= b.daily_cap) {
        console.log(`[Webhook] Buyer daily cap reached — buyer=${b.name}, phone=${b.phone}, cap=${b.daily_cap}`);
        return false;
      }
    }

    // Check max concurrent
    if (b.max_concurrent > 0) {
      const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM cdrs WHERE buyer_number = ? AND status IN ('ringing', 'in-progress') AND call_date >= ?`).get(b.phone, startOfDayMs) as any;
      if (cnt && cnt.cnt >= b.max_concurrent) {
        console.log(`[Webhook] Buyer max concurrent reached — buyer=${b.name}, phone=${b.phone}, max=${b.max_concurrent}`);
        return false;
      }
    }

    return true;
  });

  const campaignName = campaign?.name || null;
  const firstBuyerName = eligibleBuyers[0]?.name || null;

  // Create CDR
  const cdrId = uid();
  db.prepare(`INSERT INTO cdrs (id, organization_id, call_sid, from_number, to_number, direction, status, call_date, created_at, updated_at, buyer_name, campaign_name)
    VALUES (?, ?, ?, ?, ?, 'inbound', 'ringing', ?, ?, ?, ?, ?)`)
    .run(cdrId, orgId, callSid || null, from, to, now, now, now, firstBuyerName, campaignName);

  broadcastCdrEvent({
    type: "call-start",
    organizationId: orgId,
    cdr: { id: cdrId, callSid, fromNumber: from || "", toNumber: to || "", direction: "inbound", status: "ringing", duration: 0, cost: 0, callDate: now, buyerName: firstBuyerName || undefined, buyerNumber: eligibleBuyers[0]?.phone || undefined, campaignName: campaignName || undefined },
  });

  const strategy = campaign?.routing_strategy || "sequential";

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

  if (eligibleBuyers.length > 0) {
    if (strategy === "concurrent") {
      // Store first buyer number in CDR for display
      if (eligibleBuyers[0]?.phone) {
        db.prepare("UPDATE cdrs SET buyer_number = ? WHERE id = ?").run(eligibleBuyers[0].phone, cdrId);
      }
      twiml += `<Dial timeout="25" answerOnBridge="true" machineDetection="DetectMessageEnd" record="record-from-ringing" recordingStatusCallback="${escapeXml(twilioBaseUrl(req) + "/webhook/recording-status")}" action="${escapeXml(twilioBaseUrl(req) + `/webhook/voice/dial-result?cdrId=${cdrId}&currentBuyerIndex=0&campaignId=${campaignId || ""}&orgId=${orgId}`)}">`;
      for (const buyer of eligibleBuyers) {
        twiml += `<Number>${escapeXml(buyer.phone)}</Number>`;
      }
      twiml += `</Dial>`;
    } else {
      // Sequential or round-robin: dial the first buyer
      let buyerIndex = 0;
      if (strategy === "round_robin") {
        const key = `rr_${campaignId}`;
        const lastIndex = parseInt(req.body[key] || "0");
        buyerIndex = lastIndex % eligibleBuyers.length;
      }
      const buyer = eligibleBuyers[buyerIndex];
      // Store buyer number in CDR for display
      if (buyer?.phone) {
        db.prepare("UPDATE cdrs SET buyer_number = ? WHERE id = ?").run(buyer.phone, cdrId);
      }
      twiml += `<Say voice="male">Please hold while we connect your call.</Say>`;
      twiml += `<Dial timeout="25" answerOnBridge="true" machineDetection="DetectMessageEnd" record="record-from-ringing" recordingStatusCallback="${escapeXml(twilioBaseUrl(req) + "/webhook/recording-status")}" action="${escapeXml(twilioBaseUrl(req) + `/webhook/voice/dial-result?cdrId=${cdrId}&currentBuyerIndex=${buyerIndex}&campaignId=${campaignId || ""}&orgId=${orgId}`)}">`;
      twiml += `<Number>${escapeXml(buyer.phone)}</Number>`;
      twiml += `</Dial>`;
    }
  } else {
    twiml += `<Say voice="male">Hello, you have reached DialClear. No one is available to take your call. Please try again later.</Say>`;
  }

  twiml += `</Response>`;
  return res.send(twiml);
});

// ── Call status callback ──
// Computes per-second cost and auto-debits from the wallet.
router.post("/webhook/status", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const duration = req.body.CallDuration;
  const from = req.body.From;
  const to = req.body.To;
  const recordingUrl = req.body.RecordingUrl || null;
  const recordingDuration = parseInt(req.body.RecordingDuration || "0");

  console.log(`[Webhook] Call status — SID: ${callSid}, Status: ${callStatus}, Duration: ${duration}s, From: ${from}, To: ${to}, Recording: ${recordingUrl ? "yes" : "no"}`);

  if (callSid) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      const dur = parseInt(duration || "0");
      const orgId = existing.organization_id;
      const status = callStatus?.toLowerCase() || "completed";

      // Look up rate from the number's ivr_config
      let ratePerMinute = 0.015; // default $0.015/min
      const number = db.prepare("SELECT ivr_config FROM numbers WHERE organization_id = ? AND e164 = ?").get(orgId, to) as any;
      if (number?.ivr_config) {
        try {
          const cfg = JSON.parse(number.ivr_config);
          if (cfg.ratePerMinute) ratePerMinute = parseFloat(cfg.ratePerMinute);
        } catch { /* ignore */ }
      }
      const ratePerSecond = ratePerMinute / 60;
      const cost = +(dur * ratePerSecond).toFixed(6);

      db.prepare(`UPDATE cdrs SET status = ?, duration = ?, bill_duration = ?, cost = ?, rate = ?, 
        recording_url = COALESCE(?, recording_url), 
        recording_duration = CASE WHEN ? > 0 THEN ? ELSE recording_duration END,
        ended_at = ?, updated_at = ? WHERE id = ?`)
        .run(status, dur, dur, cost, ratePerSecond, recordingUrl, recordingDuration, recordingDuration, Date.now(), Date.now(), existing.id);

      broadcastCdrEvent({
        type: status === "completed" ? "call-end" : "call-update",
        organizationId: orgId,
        cdr: { id: existing.id, callSid, fromNumber: from || "", toNumber: to || "", direction: "inbound", status, duration: dur, cost, callDate: existing.call_date, buyerName: existing.buyer_name || undefined, buyerNumber: existing.buyer_number || undefined, campaignName: existing.campaign_name || undefined, reason: callStatus || undefined, endedAt: Date.now() },
      });

      // Auto-debit from wallet if call is completed
      if (status === "completed" && cost > 0) {
        const lastLedger = db.prepare("SELECT balance FROM billing_ledger WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1").get(orgId) as any;
        const currentBalance = lastLedger?.balance || 0;
        const newBalance = +(currentBalance - cost).toFixed(6);
        db.prepare(`INSERT INTO billing_ledger (id, organization_id, type, description, amount, balance, reference_type, reference_id, created_at, updated_at)
          VALUES (?, ?, 'debit', ?, ?, ?, 'cdr', ?, ?, ?)`)
          .run(uid(), orgId, `Call cost ${from} → ${to} (${dur}s)`, -cost, newBalance, existing.id, Date.now(), Date.now());
      }
    } else {
      const number = db.prepare("SELECT organization_id FROM numbers WHERE e164 = ?").get(to) as any;
      const now = Date.now();
      const newCdrId = uid();
      db.prepare(`INSERT INTO cdrs (id, organization_id, call_sid, from_number, to_number, direction, status, duration, bill_duration, call_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'inbound', ?, ?, ?, ?, ?, ?)`)
        .run(newCdrId, number?.organization_id || null, callSid, from, to, callStatus?.toLowerCase() || "completed", parseInt(duration || "0"), parseInt(duration || "0"), now, now, now);
      if (number?.organization_id) {
        broadcastCdrEvent({
          type: "call-end",
          organizationId: number.organization_id,
          cdr: { id: newCdrId, callSid, fromNumber: from || "", toNumber: to || "", direction: "inbound", status: callStatus?.toLowerCase() || "completed", duration: parseInt(duration || "0"), cost: 0, callDate: now, reason: callStatus || undefined, endedAt: Date.now() },
        });
      }
    }
  }

  return res.sendStatus(200);
});

// ── Recording status callback ──
// SignalWire sends this when a recording is ready (more reliable than status callback).
router.post("/webhook/recording-status", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl;
  const recordingDuration = parseInt(req.body.RecordingDuration || "0");
  const recordingStatus = req.body.RecordingStatus;

  console.log(`[Webhook] Recording status — SID: ${callSid}, Status: ${recordingStatus}, Duration: ${recordingDuration}s, URL: ${recordingUrl ? "yes" : "no"}`);

  if (callSid && recordingUrl) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      db.prepare("UPDATE cdrs SET recording_url = COALESCE(?, recording_url), recording_duration = CASE WHEN ? > 0 THEN ? ELSE recording_duration END, updated_at = ? WHERE id = ?")
        .run(recordingUrl, recordingDuration, recordingDuration, Date.now(), existing.id);

      broadcastCdrEvent({
        type: "call-update",
        organizationId: existing.organization_id,
        cdr: { id: existing.id, callSid, fromNumber: existing.from_number, toNumber: existing.to_number, direction: "inbound", status: existing.status, duration: existing.duration, cost: existing.cost, callDate: existing.call_date, buyerName: existing.buyer_name || undefined, buyerNumber: existing.buyer_number || undefined, campaignName: existing.campaign_name || undefined },
      });
    }
  }

  return res.sendStatus(200);
});

// ── SMS webhook ──
router.post("/webhook/sms/:numberId", (req: Request, res: Response) => {
  const from = req.body?.From || req.query?.From;
  const to = req.body?.To || req.query?.To;
  const body = req.body?.Body || req.query?.Body;
  const messageSid = req.body?.MessageSid || req.query?.MessageSid;

  console.log(`[Webhook] Incoming SMS — From: ${from}, To: ${to}, Body: ${body}, MessageSid: ${messageSid}`);

  res.setHeader("Content-Type", "text/xml");
  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// ── IVR menu handler ──
router.post("/webhook/voice/:numberId/menu", (req: Request, res: Response) => {
  const digit = req.body.Digits;
  const from = req.body.From;
  console.log(`[Webhook] IVR menu — From: ${from}, Pressed: ${digit}`);

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
  twiml += `<Say voice="male">You pressed ${escapeXml(digit || "")}. Goodbye.</Say>`;
  twiml += `</Response>`;
  return res.send(twiml);
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default router;
