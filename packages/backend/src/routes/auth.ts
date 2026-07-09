import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db } from "../db/index.js";
import { config } from "../config/index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as any;
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: "Account is disabled" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.totp_enabled) {
      if (!twoFactorCode) {
        return res.status(401).json({ error: "totp_required" });
      }
      const verified = speakeasy.totp.verify({
        secret: user.totp_secret!,
        encoding: "base32",
        token: twoFactorCode,
        window: 1,
      });
      if (!verified) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }
    }

    const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(user.organization_id) as any;

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      organizationType: org?.type || "customer",
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), user.id);

    return res.json({
      token,
      me: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", authenticate, async (req: Request, res: Response) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(user.organization_id) as any;

  return res.json({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    organizationId: user.organization_id,
    organization: org,
  });
});

router.get("/auth/users", authenticate, async (_req: Request, res: Response) => {
  const allUsers = db.prepare(
    "SELECT id, email, first_name, last_name, display_name, role, organization_id, is_active, last_login_at, created_at FROM users"
  ).all();
  return res.json({ users: allUsers });
});

router.post("/auth/2fa/setup", authenticate, async (req: Request, res: Response) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  const secret = speakeasy.generateSecret({ name: `DialClear (${user.email})` });
  db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret.base32, user.id);

  const qrUrl = await qrcode.toDataURL(secret.otpauth_url!);

  return res.json({
    secret: secret.base32,
    qrCode: qrUrl,
  });
});

router.post("/auth/2fa/verify", authenticate, async (req: Request, res: Response) => {
  const { code } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!user || !user.totp_secret) {
    return res.status(400).json({ error: "2FA not set up" });
  }

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!verified) {
    return res.status(400).json({ error: "Invalid code" });
  }

  db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(user.id);

  return res.json({ success: true });
});

router.post("/auth/2fa/disable", authenticate, async (req: Request, res: Response) => {
  db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(req.user!.id);
  return res.json({ success: true });
});

export default router;
