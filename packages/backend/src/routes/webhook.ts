import { Router, Request, Response } from "express";
import { db } from "../db/index.js";

const router = Router();

function uid(): string {
  return crypto.randomUUID();
}

// Dial result callback — called after the <Dial> leg completes (answered, no-answer, busy…).
// MUST be registered before the :numberId param route to avoid Express matching "dial-result" as :numberId.
router.post("/webhook/voice/dial-result", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const dialCallStatus = req.body.DialCallStatus;
  const dialCallDuration = req.body.DialCallDuration;

  console.log(`[Webhook] Dial result — CallSid: ${callSid}, Status: ${dialCallStatus}, Duration: ${dialCallDuration}s`);

  if (callSid) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      db.prepare("UPDATE cdrs SET status = ?, duration = ?, bill_duration = ?, updated_at = ? WHERE id = ?")
        .run(dialCallStatus?.toLowerCase() || "completed", parseInt(dialCallDuration || "0"), parseInt(dialCallDuration || "0"), Date.now(), existing.id);
    }
  }

  res.setHeader("Content-Type", "text/xml");
  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// Main voice webhook — called when an incoming call arrives from SignalWire.
// The :numberId param is the SignalWire SID (e.g. 642b1b13-...) which we store as signalwire_sid.
router.all("/webhook/voice/:numberId", (req: Request, res: Response) => {
  const callSid = req.body?.CallSid || req.query?.CallSid;
  const from = req.body?.From || req.query?.From;
  const to = req.body?.To || req.query?.To;
  const numberId = req.params.numberId;

  console.log(`[Webhook] Incoming call — From: ${from}, To: ${to}, CallSid: ${callSid}, NumberID: ${numberId}`);

  // Look up by signalwire_sid (from URL), fallback to e164
  let number = db.prepare("SELECT * FROM numbers WHERE signalwire_sid = ?").get(numberId) as any;
  if (!number) {
    number = db.prepare("SELECT * FROM numbers WHERE e164 = ?").get(to) as any;
  }
  if (!number) {
    console.error(`[Webhook] Number not found — numberId=${numberId}, e164=${to}`);
    res.setHeader("Content-Type", "text/xml");
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="male">The number is not configured.</Say></Response>`);
  }

  const orgId = number.organization_id;
  const campaignId = number.campaign_id;
  const now = Date.now();

  // Create CDR for this inbound call
  const cdrId = uid();
  db.prepare(`INSERT INTO cdrs (id, organization_id, call_sid, from_number, to_number, direction, status, call_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'inbound', 'ringing', ?, ?, ?)`)
    .run(cdrId, orgId, callSid || null, from, to, now, now, now);
  console.log(`[Webhook] CDR created ${cdrId} for call ${callSid}`);

  // Find buyers linked to this campaign who have phone numbers
  let buyers: any[] = [];
  if (campaignId) {
    buyers = db.prepare(`
      SELECT b.id, b.name, b.phone
      FROM buyers b
      INNER JOIN campaign_buyers cb ON cb.buyer_id = b.id
      WHERE cb.campaign_id = ?
        AND b.phone IS NOT NULL AND b.phone != ''
    `).all(campaignId) as any[];
    console.log(`[Webhook] Found ${buyers.length} buyer(s) for campaign ${campaignId}`);
  }

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

  if (buyers.length > 0) {
    const buyer = buyers[0];
    twiml += `<Dial timeout="30" callerId="${escapeXml(number.e164)}" action="/v1/webhook/voice/dial-result">`;
    twiml += `<Number>${escapeXml(buyer.phone)}</Number>`;
    twiml += `</Dial>`;
  } else {
    twiml += `<Say voice="male">Hello, you have reached DialClear. No one is available to take your call. Please try again later.</Say>`;
  }

  twiml += `</Response>`;
  return res.send(twiml);
});

// Call status callback from SignalWire (configured at the number level)
router.post("/webhook/status", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const duration = req.body.CallDuration;
  const from = req.body.From;
  const to = req.body.To;

  console.log(`[Webhook] Call status — SID: ${callSid}, Status: ${callStatus}, Duration: ${duration}s, From: ${from}, To: ${to}`);

  if (callSid) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      db.prepare("UPDATE cdrs SET status = ?, duration = ?, bill_duration = ?, updated_at = ? WHERE id = ?")
        .run(callStatus?.toLowerCase() || "completed", parseInt(duration || "0"), parseInt(duration || "0"), Date.now(), existing.id);
    } else {
      const number = db.prepare("SELECT organization_id FROM numbers WHERE e164 = ?").get(to) as any;
      const now = Date.now();
      db.prepare(`INSERT INTO cdrs (id, organization_id, call_sid, from_number, to_number, direction, status, duration, bill_duration, call_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'inbound', ?, ?, ?, ?, ?, ?)`)
        .run(uid(), number?.organization_id || null, callSid, from, to, callStatus?.toLowerCase() || "completed", parseInt(duration || "0"), parseInt(duration || "0"), now, now, now);
    }
  }

  return res.sendStatus(200);
});

// SMS webhook
router.post("/webhook/sms/:numberId", (req: Request, res: Response) => {
  const from = req.body?.From || req.query?.From;
  const to = req.body?.To || req.query?.To;
  const body = req.body?.Body || req.query?.Body;
  const messageSid = req.body?.MessageSid || req.query?.MessageSid;

  console.log(`[Webhook] Incoming SMS — From: ${from}, To: ${to}, Body: ${body}, MessageSid: ${messageSid}`);

  res.setHeader("Content-Type", "text/xml");
  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// IVR menu handler (kept for backward compatibility)
router.post("/webhook/voice/:numberId/menu", (req: Request, res: Response) => {
  const digit = req.body.Digits;
  const from = req.body.From;
  console.log(`[Webhook] IVR menu — From: ${from}, Pressed: ${digit}`);

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
  twiml += `<Say voice="male">You pressed ${digit}. Goodbye.</Say>`;
  twiml += `</Response>`;
  return res.send(twiml);
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default router;
