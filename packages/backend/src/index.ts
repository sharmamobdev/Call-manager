import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { createTables, db } from "./db/index.js";
import { errorHandler, notFound } from "./middleware/error.js";

import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import customerRoutes from "./routes/customer.js";
import billingRoutes from "./routes/billing.js";
import cdrRoutes, { recordingRouter } from "./routes/cdrs.js";
import reportRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin/index.js";
import webhookRoutes from "./routes/webhook.js";
import realtimeRoutes from "./routes/realtime.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/v1/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook routes MUST be registered before authenticated routes
// so SignalWire callbacks don't hit the authenticate middleware
app.use("/v1", webhookRoutes);

// Recording proxy uses JWT in query string (no auth header — for <audio>/<a> tags)
app.use("/v1", recordingRouter);

app.use("/v1", authRoutes);
app.use("/v1", customerRoutes);
app.use("/v1", billingRoutes);
app.use("/v1", cdrRoutes);
app.use("/v1", reportRoutes);
app.use("/v1", adminRoutes);
app.use("/v1", organizationRoutes);
app.use("/v1", realtimeRoutes);

app.use(notFound);
app.use(errorHandler);

createTables();

// Auto-seed on fresh database
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
if (!userCount?.count) {
  import("./db/seed.js").then((m) => m.default()).catch((e) => console.error("Seed error:", e));
}

app.listen(config.port, config.host, () => {
  console.log(`DialClear API server running on http://${config.host}:${config.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

