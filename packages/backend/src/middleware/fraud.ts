import { db } from "../db/index.js";

const COUNTRY_CODES: Record<string, string> = {
  "1": "US", "20": "EG", "212": "MA", "213": "DZ", "216": "TN",
  "218": "LY", "220": "GM", "221": "SN", "222": "MR", "223": "ML",
  "224": "GN", "225": "CI", "226": "BF", "227": "NE", "228": "TG",
  "229": "BJ", "230": "MU", "231": "LR", "232": "SL", "233": "GH",
  "234": "NG", "235": "TD", "236": "CF", "237": "CM", "238": "CV",
  "239": "ST", "240": "GQ", "241": "GA", "242": "CG", "243": "CD",
  "244": "AO", "245": "GW", "246": "IO", "247": "AC", "248": "SC",
  "249": "SD", "250": "RW", "251": "ET", "252": "SO", "253": "DJ",
  "254": "KE", "255": "TZ", "256": "UG", "257": "BI", "258": "MZ",
  "260": "ZM", "261": "MG", "262": "RE", "263": "ZW", "264": "NA",
  "265": "MW", "266": "LS", "267": "BW", "268": "SZ", "269": "KM",
  "27": "ZA", "290": "SH", "291": "ER", "297": "AW", "298": "FO",
  "299": "GL", "30": "GR", "31": "NL", "32": "BE", "33": "FR",
  "34": "ES", "350": "GI", "351": "PT", "352": "LU", "353": "IE",
  "354": "IS", "355": "AL", "356": "MT", "357": "CY", "358": "FI",
  "359": "BG", "36": "HU", "370": "LT", "371": "LV", "372": "EE",
  "373": "MD", "374": "AM", "375": "BY", "376": "AD", "377": "MC",
  "378": "SM", "379": "VA", "380": "UA", "381": "RS", "382": "ME",
  "385": "HR", "386": "SI", "387": "BA", "389": "MK", "39": "IT",
  "40": "RO", "41": "CH", "420": "CZ", "421": "SK", "423": "LI",
  "43": "AT", "44": "GB", "45": "DK", "46": "SE", "47": "NO",
  "48": "PL", "49": "DE", "500": "FK", "501": "BZ", "502": "GT",
  "503": "SV", "504": "HN", "505": "NI", "506": "CR", "507": "PA",
  "508": "PM", "509": "HT", "51": "PE", "52": "MX", "53": "CU",
  "54": "AR", "55": "BR", "56": "CL", "57": "CO", "58": "VE",
  "590": "GP", "591": "BO", "592": "GY", "593": "EC", "594": "GF",
  "595": "PY", "596": "MQ", "597": "SR", "598": "UY", "599": "AN",
  "60": "MY", "61": "AU", "62": "ID", "63": "PH", "64": "NZ",
  "65": "SG", "66": "TH", "670": "TL", "672": "NF", "673": "BN",
  "674": "NR", "675": "PG", "676": "TO", "677": "SB", "678": "VU",
  "679": "FJ", "680": "PW", "681": "WF", "682": "CK", "683": "NU",
  "685": "WS", "686": "KI", "687": "NC", "688": "TV", "689": "PF",
  "690": "TK", "691": "FM", "692": "MH", "7": "RU", "81": "JP",
  "82": "KR", "84": "VN", "850": "KP", "852": "HK", "853": "MO",
  "855": "KH", "856": "LA", "86": "CN", "870": "PN", "880": "BD",
  "886": "TW", "90": "TR", "91": "IN", "92": "PK", "93": "AF",
  "94": "LK", "95": "MM", "960": "MV", "961": "LB", "962": "JO",
  "963": "SY", "964": "IQ", "965": "KW", "966": "SA", "967": "YE",
  "968": "OM", "970": "PS", "971": "AE", "972": "IL", "973": "BH",
  "974": "QA", "975": "BT", "976": "MN", "977": "NP", "98": "IR",
  "992": "TJ", "993": "TM", "994": "AZ", "995": "GE", "996": "KG",
  "998": "UZ",
};

function getCountryCode(e164: string): string | null {
  const num = e164.replace(/\D/g, "");
  for (let i = 1; i <= 4; i++) {
    const prefix = num.substring(0, i);
    if (COUNTRY_CODES[prefix]) return COUNTRY_CODES[prefix];
  }
  return null;
}

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
}

export function checkFraud(orgId: string, fromNumber: string): FraudCheckResult {
  // 1. Check blocklist
  const blocked = db.prepare(`
    SELECT reason FROM blocklists
    WHERE organization_id = ? AND (
      (type = 'number' AND value = ?) OR
      (type = 'prefix' AND SUBSTR(?, 1, LENGTH(value)) = value)
    )
    LIMIT 1
  `).get(orgId, fromNumber, fromNumber) as any;
  if (blocked) return { blocked: true, reason: `Blocked: ${blocked.reason || "number blocked"}` };

  // 2. Rate-limit check
  const org = db.prepare("SELECT settings FROM organizations WHERE id = ?").get(orgId) as any;
  let maxCallsPerMinute = 100;
  let blockAnonymized = true;
  let businessHoursOnly = false;
  let maxCountriesPerHour = 3;
  if (org?.settings) {
    try {
      const s = JSON.parse(org.settings);
      if (s.maxCallsPerMinute) maxCallsPerMinute = s.maxCallsPerMinute;
      if (s.blockAnonymized !== undefined) blockAnonymized = s.blockAnonymized;
      if (s.businessHoursOnly !== undefined) businessHoursOnly = s.businessHoursOnly;
      if (s.maxCountriesPerHour) maxCountriesPerHour = s.maxCountriesPerHour;
    } catch { /* ignore */ }
  }
  const now = Date.now();
  const windowStart = now - 60000;
  const recent = db.prepare("SELECT SUM(call_count) as total FROM call_rate_limits WHERE organization_id = ? AND from_number = ? AND window_start > ?")
    .get(orgId, fromNumber, windowStart) as any;
  console.log(`[Fraud] Rate check — org=${orgId.slice(0,8)} from=${fromNumber} total=${recent?.total} max=${maxCallsPerMinute} blocked=${recent ? ((recent.total || 0) >= maxCallsPerMinute) : false}`);
  if (recent && (recent.total || 0) >= maxCallsPerMinute) {
    return { blocked: true, reason: `Rate limit exceeded (${maxCallsPerMinute}/min)` };
  }

  // 3. Upsert rate limit counter
  const existing = db.prepare("SELECT id, call_count FROM call_rate_limits WHERE organization_id = ? AND from_number = ? AND window_start > ?")
    .get(orgId, fromNumber, windowStart) as any;
  if (existing) {
    db.prepare("UPDATE call_rate_limits SET call_count = call_count + 1 WHERE id = ?").run(existing.id);
  } else {
    db.prepare("INSERT INTO call_rate_limits (id, organization_id, from_number, call_count, window_start) VALUES (?, ?, ?, 1, ?)")
      .run(crypto.randomUUID(), orgId, fromNumber, now);
  }

  // 4. Country check (fraud prevention: lots of calls to different countries)
  const country = getCountryCode(fromNumber);
  if (!country && blockAnonymized) {
    return { blocked: true, reason: "Anonymous caller ID blocked" };
  }

  // 5. Business hours check
  if (businessHoursOnly && fromNumber.startsWith("+")) {
    const hours = getBusinessHours(org);
    const nowDate = new Date();
    const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const startParts = hours.start.split(":").map(Number);
    const endParts = hours.end.split(":").map(Number);
    const startMin = startParts[0] * 60 + (startParts[1] || 0);
    const endMin = endParts[0] * 60 + (endParts[1] || 0);
    const day = nowDate.getDay();
    if (day === 0 || day === 6) return { blocked: true, reason: "Weekend — business hours only" };
    if (currentMinutes < startMin || currentMinutes > endMin) {
      return { blocked: true, reason: `Outside business hours (${hours.start}-${hours.end})` };
    }
  }

  return { blocked: false };
}

function getBusinessHours(org: any): { start: string; end: string } {
  try {
    const s = org?.settings ? JSON.parse(org.settings) : {};
    return { start: s.businessHoursStart || "09:00", end: s.businessHoursEnd || "17:00" };
  } catch {
    return { start: "09:00", end: "17:00" };
  }
}
