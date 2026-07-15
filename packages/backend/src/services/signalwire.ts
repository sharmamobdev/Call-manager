import { config } from "../config/index.js";

const ACCOUNT_SID = config.signalwire.projectId;
const AUTH_TOKEN = config.signalwire.token;
const SPACE_URL = config.signalwire.spaceUrl;
const BASE = `https://${SPACE_URL}/api/laml/2010-04-01/Accounts/${ACCOUNT_SID}`;
const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");

async function swFetch(path: string, options: RequestInit = {}) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`SignalWire error ${res.status}: ${error}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const signalwire = {
  // ── Available Numbers (search) ──
  async searchAvailable(areaCode?: string, tollFree = false, count = 5) {
    const type = tollFree ? "TollFree" : "Local";
    const params: Record<string, string | number> = { Limit: count };
    if (areaCode) params.AreaCode = areaCode;
    return swFetch(`/AvailablePhoneNumbers/US/${type}.json${toQueryString(params)}`);
  },

  // ── Purchase a number ──
  async purchaseNumber(phoneNumber: string, friendlyName?: string) {
    return swFetch("/IncomingPhoneNumbers.json", {
      method: "POST",
      body: JSON.stringify({
        PhoneNumber: phoneNumber,
        FriendlyName: friendlyName || phoneNumber,
      }),
    });
  },

  // ── Purchase by area code ──
  async purchaseByAreaCode(areaCode: string, friendlyName?: string) {
    return swFetch("/IncomingPhoneNumbers.json", {
      method: "POST",
      body: JSON.stringify({
        AreaCode: areaCode,
        FriendlyName: friendlyName || `DID ${areaCode}`,
      }),
    });
  },

  // ── List owned numbers ──
  async listNumbers(args?: { pageSize?: number; pageToken?: string }) {
    const params: Record<string, string | number> = {};
    if (args?.pageSize) params.PageSize = args.pageSize;
    if (args?.pageToken) params.PageToken = args.pageToken;
    return swFetch(`/IncomingPhoneNumbers.json${toQueryString(params)}`);
  },

  // ── Update a number (voice URL, SMS URL, etc.) ──
  async updateNumber(phoneNumberSid: string, params: Record<string, string>) {
    return swFetch(`/IncomingPhoneNumbers/${phoneNumberSid}.json`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  },

  // ── Release a number ──
  async releaseNumber(phoneNumberSid: string) {
    return swFetch(`/IncomingPhoneNumbers/${phoneNumberSid}.json`, {
      method: "DELETE",
    });
  },

  // ── Make a call ──
  async makeCall(params: { from: string; to: string; url: string; method?: string; statusCallback?: string }) {
    return swFetch("/Calls.json", {
      method: "POST",
      body: JSON.stringify({
        From: params.from,
        To: params.to,
        Url: params.url,
        Method: params.method || "GET",
        StatusCallback: params.statusCallback,
      }),
    });
  },

  // ── Send SMS ──
  async sendSms(params: { from: string; to: string; body: string; statusCallback?: string }) {
    return swFetch("/Messages.json", {
      method: "POST",
      body: JSON.stringify({
        From: params.from,
        To: params.to,
        Body: params.body,
        StatusCallback: params.statusCallback,
      }),
    });
  },

  // ── List calls ──
  async getCalls(args?: { pageSize?: number; page?: number }) {
    const params: Record<string, string | number> = {};
    if (args?.pageSize) params.PageSize = args.pageSize;
    if (args?.page) params.Page = Math.max(0, args.page - 1);
    return swFetch(`/Calls.json${toQueryString(params)}`);
  },

  // ── Call recordings ──
  async getCallRecording(callSid: string) {
    return swFetch(`/Calls/${callSid}/Recordings.json`);
  },

  // ── Hang up a call ──
  async hangupCall(callSid: string) {
    return swFetch(`/Calls/${callSid}.json`, {
      method: "POST",
      body: JSON.stringify({ Status: "completed" }),
    });
  },

  // ── List messages ──
  async getMessages(args?: { pageSize?: number; page?: number }) {
    const params: Record<string, string | number> = {};
    if (args?.pageSize) params.PageSize = args.pageSize;
    if (args?.page) params.Page = args.page;
    return swFetch(`/Messages.json${toQueryString(params)}`);
  },

  // ── Account balance ──
  async getBalance() {
    return swFetch("/Balance.json");
  },
};
