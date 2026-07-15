import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export interface CdrEvent {
  type: "call-start" | "call-update" | "call-end";
  organizationId: string;
  cdr: {
    id: string;
    callSid?: string;
    fromNumber: string;
    toNumber: string;
    direction: string;
    status: string;
    duration: number;
    cost: number;
    callDate: number;
    buyerName?: string;
    buyerNumber?: string;
    campaignName?: string;
    reason?: string;
    routingAttempt?: number;
    answeredAt?: number;
    endedAt?: number;
  };
}

export function broadcastCdrEvent(event: CdrEvent) {
  emitter.emit(`cdr:${event.organizationId}`, event);
}

export function onCdrEvent(
  organizationId: string,
  callback: (event: CdrEvent) => void
): () => void {
  const key = `cdr:${organizationId}`;
  emitter.on(key, callback);
  return () => emitter.off(key, callback);
}
