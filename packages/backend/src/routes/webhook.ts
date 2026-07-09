import { Router, Request, Response } from "express";
import { db } from "../db/index.js";

const router = Router();

// SignalWire Voice Webhook — called when an incoming call arrives
// Respond with TwiML (LAML XML) to control the call
router.all("/webhook/voice/:numberId", (req: Request, res: Response) => {
  const callSid = req.body.CallSid || req.query.CallSid;
  const from = req.body.From || req.query.From;
  const to = req.body.To || req.query.To;

  console.log(`Incoming call — From: ${from}, To: ${to}, CallSid: ${callSid}`);

  // Look up IVR config for this number
  const number = db.prepare("SELECT * FROM numbers WHERE e164 = ?").get(to) as any;
  let ivrConfig: any = {};
  if (number?.ivr_config) {
    try { ivrConfig = JSON.parse(number.ivr_config); } catch { ivrConfig = {}; }
  }

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;

  if (ivrConfig.welcome_message) {
    twiml += `<Say voice="male">${escapeXml(ivrConfig.welcome_message)}</Say>`;
  } else {
    twiml += `<Say voice="male">Hello, you have reached DialClear. No one is available to take your call. Please try again later.</Say>`;
  }

  if (ivrConfig.menu && Array.isArray(ivrConfig.menu)) {
    twiml += `<Gather numDigits="1" action="/v1/webhook/voice/${req.params.numberId}/menu" method="POST">`;
    for (const item of ivrConfig.menu) {
      if (item.digit && item.message) {
        twiml += `<Say voice="male">Press ${item.digit} for ${item.message}</Say>`;
      }
    }
    twiml += `</Gather>`;
  }

  twiml += `</Response>`;
  return res.send(twiml);
});

// IVR menu action handler
router.post("/webhook/voice/:numberId/menu", (req: Request, res: Response) => {
  const digit = req.body.Digits;
  const from = req.body.From;
  console.log(`IVR menu — From: ${from}, Pressed: ${digit}`);

  res.setHeader("Content-Type", "text/xml");
  let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
  twiml += `<Say voice="male">You pressed ${digit}. Goodbye.</Say>`;
  twiml += `</Response>`;
  return res.send(twiml);
});

// SignalWire SMS Webhook — called when an SMS arrives
router.post("/webhook/sms/:numberId", (req: Request, res: Response) => {
  const from = req.body.From || req.query.From;
  const to = req.body.To || req.query.To;
  const body = req.body.Body || req.query.Body;
  const messageSid = req.body.MessageSid || req.query.MessageSid;

  console.log(`Incoming SMS — From: ${from}, To: ${to}, Body: ${body}, MessageSid: ${messageSid}`);

  // Respond with empty TwiML to acknowledge
  res.setHeader("Content-Type", "text/xml");
  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

// Call status callback
router.post("/webhook/status", (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const duration = req.body.CallDuration;
  const from = req.body.From;
  const to = req.body.To;

  console.log(`Call status — SID: ${callSid}, Status: ${callStatus}, Duration: ${duration}s, From: ${from}, To: ${to}`);

  // Update the CDR record in the database
  if (callSid) {
    const existing = db.prepare("SELECT * FROM cdrs WHERE call_sid = ?").get(callSid) as any;
    if (existing) {
      db.prepare("UPDATE cdrs SET status = ?, duration = ?, bill_duration = ?, updated_at = ? WHERE id = ?")
        .run(callStatus?.toLowerCase() || "completed", parseInt(duration || "0"), parseInt(duration || "0"), Date.now(), existing.id);
    }
  }

  return res.sendStatus(200);
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default router;
