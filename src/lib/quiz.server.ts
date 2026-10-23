import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-only security helpers for the Harsh Quiz Portal.
 * PINs and the admin signing secret never leave the server.
 */

export function safeEqualSecret(input: string, secret: string | undefined): boolean {
  if (!secret || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function signAdminToken(secret: string | undefined, now: number = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ r: "admin", exp: Math.floor(now / 1000) + ADMIN_TOKEN_TTL_SECONDS }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret ?? "").update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | undefined, secret: string | undefined): boolean {
  if (!token || !secret || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      r?: string;
      exp?: number;
    };
    return data.r === "admin" && typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function normalizeRollNo(rollNo: string): string {
  return rollNo.trim().toUpperCase();
}

export function syntheticEmail(rollNo: string): string {
  const slug = normalizeRollNo(rollNo).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `${slug}@students.rdxquiz.app`;
}
