import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getSecret(): string {
  const s = process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return s;
}

/**
 * Generate a stateless proof token for password reset.
 * Format: base64url({userId}:{exp}:{hmacSig})
 */
export function generateResetToken(userId: string): string {
  const exp = (Date.now() + TOKEN_TTL_MS).toString();
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Verify a reset token. Returns { userId } if valid, null otherwise.
 * Uses timing-safe comparison to prevent timing side-channel attacks.
 */
export function verifyResetToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    // Payload is everything except the last ':sig' segment
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const expectedSig = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    // Parse payload: {userId}:{exp}
    const parts = payload.split(":");
    const exp = parseInt(parts[parts.length - 1], 10);
    const userId = parts.slice(0, parts.length - 1).join(":");
    if (!userId || isNaN(exp) || Date.now() > exp) return null;
    return { userId };
  } catch {
    return null;
  }
}
