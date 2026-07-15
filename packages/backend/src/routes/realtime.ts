import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { onCdrEvent, CdrEvent } from "../services/events.js";

const router = Router();

router.get("/realtime/live-calls", (req: Request, res: Response) => {
  const token = (req.query.token as string) || "";
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let organizationId = "";
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    organizationId = decoded.organizationId;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (!organizationId) {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  const cleanup = onCdrEvent(organizationId, (event: CdrEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    cleanup();
  });
});

export default router;
