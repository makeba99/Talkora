/**
 * Security Middleware & Threat Detection
 *
 * Provides:
 *  - Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
 *  - Privacy-preserving headers (no tracking, Referrer-Policy)
 *  - Rate limiting keyed by session ID (not IP — no PII stored)
 *  - Threat detection for XSS and SQL injection patterns
 *  - Security event logging without any PII (no IP addresses)
 *  - Real-time admin alert bus (securityBus EventEmitter)
 */

import { type Express, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import EventEmitter from "events";
import { db } from "./db";
import { securityEvents } from "@shared/schema";
import type { InsertSecurityEvent } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export const securityBus = new EventEmitter();

export type SecurityEventData = {
  userId?: string | null;
  eventType: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  requestPath?: string | null;
};

export async function logSecurityEvent(data: SecurityEventData): Promise<void> {
  try {
    const [event] = await db
      .insert(securityEvents)
      .values({
        userId: data.userId ?? null,
        eventType: data.eventType,
        severity: data.severity,
        description: data.description,
        userAgent: null,
        requestPath: data.requestPath
          ? data.requestPath.slice(0, 255)
          : null,
      })
      .returning();
    if (event && (data.severity === "critical" || data.severity === "high")) {
      securityBus.emit("security:event", event);
    }
  } catch {
  }
}

function sessionKey(req: Request): string {
  return req.sessionID || "anon";
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: sessionKey,
  handler: async (req: Request, res: Response) => {
    await logSecurityEvent({
      userId: (req as any).user?.id ?? null,
      eventType: "rate_limit_exceeded",
      severity: "high",
      description: `Auth endpoint rate limit exceeded on ${req.path}`,
      requestPath: req.path,
    });
    res.status(429).json({
      message: "Too many requests. Please wait before trying again.",
    });
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: sessionKey,
  handler: async (req: Request, res: Response) => {
    await logSecurityEvent({
      userId: (req as any).user?.id ?? null,
      eventType: "rate_limit_exceeded",
      severity: "medium",
      description: `API rate limit exceeded on ${req.path}`,
      requestPath: req.path,
    });
    res.status(429).json({
      message: "Too many requests. Please slow down.",
    });
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: sessionKey,
  handler: async (req: Request, res: Response) => {
    await logSecurityEvent({
      userId: (req as any).user?.id ?? null,
      eventType: "rate_limit_exceeded",
      severity: "medium",
      description: `Upload rate limit exceeded`,
      requestPath: req.path,
    });
    res.status(429).json({
      message: "Upload limit reached. Try again in an hour.",
    });
  },
});

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /onclick\s*=/i,
  /<iframe[\s>]/i,
  /eval\s*\(/i,
  /document\.cookie/i,
  /\bwindow\.location\b/i,
];

const SQLI_PATTERNS = [
  /\bUNION\b.{0,30}\bSELECT\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b.*\bVALUES\b/i,
  /\bEXEC\s*\(/i,
  /\bxp_cmdshell\b/i,
  /'\s*(OR|AND)\s*'?\d+'?\s*=\s*'?\d+/i,
  /;\s*(DROP|DELETE|UPDATE|INSERT)\b/i,
];

function scanValue(val: unknown, depth = 0): "xss" | "sqli" | null {
  if (depth > 5) return null;
  if (typeof val === "string") {
    for (const p of XSS_PATTERNS) if (p.test(val)) return "xss";
    for (const p of SQLI_PATTERNS) if (p.test(val)) return "sqli";
    return null;
  }
  if (val && typeof val === "object") {
    for (const v of Object.values(val as Record<string, unknown>)) {
      const hit = scanValue(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

export function threatDetectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const combined: Record<string, unknown> = {
    ...(req.query as Record<string, unknown>),
    ...(typeof req.body === "object" ? req.body : {}),
  };
  const threat = scanValue(combined);
  if (threat) {
    logSecurityEvent({
      userId: (req as any).user?.id ?? null,
      eventType: threat === "xss" ? "xss_attempt" : "sqli_attempt",
      severity: "high",
      description: `${threat === "xss" ? "XSS" : "SQL injection"} pattern detected in request to ${req.path}`,
      requestPath: req.path,
    }).catch(() => {});
  }
  next();
}

export function privilegeCheckMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as any).user;
  if (!user) {
    next();
    return;
  }
  const isAdminPath = req.path.startsWith("/api/admin");
  const isAdmin =
    user.role === "admin" ||
    user.role === "superadmin" ||
    user.email === "dj55jggg@gmail.com";
  if (isAdminPath && !isAdmin) {
    logSecurityEvent({
      userId: user.id,
      eventType: "privilege_escalation",
      severity: "high",
      description: `Non-admin user attempted to access admin endpoint: ${req.method} ${req.path}`,
      requestPath: req.path,
    }).catch(() => {});
  }
  next();
}

export function applySecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.youtube.com", "https://s.ytimg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
          mediaSrc: ["'self'", "blob:", "https:", "http:"],
          connectSrc: ["'self'", "wss:", "ws:", "https:"],
          frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      originAgentCluster: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("Accept-CH");
    res.setHeader(
      "Permissions-Policy",
      [
        "geolocation=()",
        "accelerometer=()",
        "attribution-reporting=()",
        "browsing-topics=()",
        "ch-ua=()",
        "ch-ua-arch=()",
        "ch-ua-bitness=()",
        "ch-ua-full-version=()",
        "ch-ua-full-version-list=()",
        "ch-ua-mobile=()",
        "ch-ua-model=()",
        "ch-ua-platform=()",
        "ch-ua-platform-version=()",
        "ch-ua-wow64=()",
        "gyroscope=()",
        "interest-cohort=()",
        "magnetometer=()",
        "payment=()",
        "usb=()",
      ].join(", ")
    );
    res.setHeader("Critical-CH", "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    next();
  });
}
