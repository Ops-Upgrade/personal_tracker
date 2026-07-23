import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateResetToken } from "../_helpers/resetToken";
import { ipLimiter, emailLimiter } from "@/lib/rate-limit";
import crypto from "crypto";

const GENERIC_ERROR =
  "If this account exists and has a recovery key, you may reset your password.";

const recoveryDataLimiter = emailLimiter("recovery-data");

// Simple email format check: must contain @ with something on either side and a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSecret(): string {
  const s = process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return s;
}

/**
 * Generate deterministic dummy recovery data for a non-existent user.
 * Uses HKDF with SUPABASE_SECRET_KEY + email so the output is consistent
 * across repeated requests for the same email but indistinguishable
 * from real encrypted data.
 */
function makeDummyRecoveryData(normalizedEmail: string): {
  recovery_salt: string;
  recovery_iv: string;
  recovery_wrapped_dek: string;
  reset_token: string;
} {
  const secret = getSecret();
  const infoPrefix = normalizedEmail;

  const saltBytes = Buffer.from(
    crypto.hkdfSync("sha256", secret, infoPrefix, "recovery-salt", 16)
  );
  const ivBytes = Buffer.from(
    crypto.hkdfSync("sha256", secret, infoPrefix, "recovery-iv", 12)
  );
  const dekBytes = Buffer.from(
    crypto.hkdfSync("sha256", secret, infoPrefix, "recovery-dek", 48)
  );
  const uuidBytes = Buffer.from(
    crypto.hkdfSync("sha256", secret, infoPrefix, "recovery-uuid", 16)
  );

  // Manipulate to form a valid UUID v4
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  // Format as standard UUID string
  const hex = Array.from(uuidBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const dummyUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  const dummyToken = generateResetToken(dummyUuid);

  return {
    recovery_salt: saltBytes.toString("base64"),
    recovery_iv: ivBytes.toString("base64"),
    recovery_wrapped_dek: dekBytes.toString("base64"),
    reset_token: dummyToken,
  };
}

export async function POST(request: Request) {
  // --- Parse body ---
  let email: string;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // --- Fail fast for malformed emails (no DB touch) ---
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();

  // --- Rate limiting ---
  const [ipResult, emailResult] = await Promise.all([
    ipLimiter.limit(request.headers.get("x-forwarded-for") ?? "anonymous"),
    recoveryDataLimiter.limit(normalizedEmail),
  ]);

  if (!ipResult.success || !emailResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const admin = createAdminClient();

  // --- Indexed lookup on user_keys by email ---
  const { data: keyRow, error: keyError } = await admin
    .from("user_keys")
    .select("user_id, recovery_salt, recovery_iv, recovery_wrapped_dek")
    .eq("email", normalizedEmail)
    .maybeSingle();

  // If query succeeded and row has recovery data, return real payload.
  if (!keyError && keyRow?.recovery_wrapped_dek) {
    const resetToken = generateResetToken(keyRow.user_id);
    return NextResponse.json({
      recovery_salt: keyRow.recovery_salt,
      recovery_iv: keyRow.recovery_iv,
      recovery_wrapped_dek: keyRow.recovery_wrapped_dek,
      reset_token: resetToken,
    });
  }

  // --- Return deterministic dummy data for non-existent users (or users
  //     without recovery keys) to prevent email enumeration. ---
  const dummy = makeDummyRecoveryData(normalizedEmail);
  return NextResponse.json(dummy);
}
