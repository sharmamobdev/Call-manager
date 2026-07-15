import { useState, useEffect, useRef, useCallback } from "react";

export interface LiveCall {
  id: string;
  callSid?: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  status: string;
  duration: number;
  cost: number;
  callDate: number;
}

interface CdrEvent {
  type: "call-start" | "call-update" | "call-end";
  organizationId: string;
  cdr: LiveCall;
}

const SSE_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 20;

export function useLiveCalls(): LiveCall[] {
  const [calls, setCalls] = useState<Map<string, LiveCall>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const attemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL || "";
    const apiUrl = baseUrl || "https://call-manager-backend-production.up.railway.app";
    const url = `${apiUrl}/v1/realtime/live-calls?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: CdrEvent = JSON.parse(event.data);
        if (data.type === "connected") return;

        setCalls((prev) => {
          const next = new Map(prev);
          if (data.type === "call-end") {
            next.delete(data.cdr.id);
          } else {
            next.set(data.cdr.id, data.cdr);
          }
          return next;
        });
      } catch { /* ignore parse errors */ }
    };

    es.onopen = () => {
      attemptsRef.current = 0;
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (mountedRef.current && attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current++;
        setTimeout(connect, SSE_RECONNECT_DELAY);
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);

  return Array.from(calls.values()).sort((a, b) => b.callDate - a.callDate);
}
