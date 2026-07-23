import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResetToken } from "../_helpers/resetToken";
import { ipLimiter, emailLimiter } from "@/lib/rate-limit";

const GENERIC_ERROR = "Invalid request.";

const resetPasswordLimiter = emailLimiter("reset-password");

export async function POST(request: Request) {
  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const reset_token =
    typeof body.reset_token === "string" ? body.reset_token : "";
  const new_password =
    typeof body.new_password === "string" ? body.new_password : "";
  const new_salt = typeof body.new_salt === "string" ? body.new_salt : "";
  const new_iv = typeof body.new_iv === "string" ? body.new_iv : "";
  const new_wrapped_dek =
    typeof body.new_wrapped_dek === "string" ? body.new_wrapped_dek : "";

  if (
    !email ||
    !reset_token ||
    !new_password ||
    !new_salt ||
    !new_iv ||
    !new_wrapped_dek
  ) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();

  // --- Rate limiting ---
  const [ipResult, emailResult] = await Promise.all([
    ipLimiter.limit(request.headers.get("x-forwarded-for") ?? "anonymous"),
    resetPasswordLimiter.limit(normalizedEmail),
  ]);

  if (!ipResult.success || !emailResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // --- Verify proof token (extracts userId; may be a dummy UUID from
  //     recovery-data so we MUST check user_keys below before acting) ---
  const tokenPayload = verifyResetToken(reset_token);
  if (!tokenPayload) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Indexed lookup on user_keys by email ---
  const { data: keyRow, error: lookupError } = await admin
    .from("user_keys")
    .select("user_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  // If the user doesn't exist in user_keys, reject — even if the token
  // signature was valid (it could be a dummy token from a non-existent
  // email's recovery-data response).
  if (lookupError || !keyRow) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Verify the token's userId matches the actual user_id from user_keys.
  if (tokenPayload.userId !== keyRow.user_id) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // --- Update user_keys with new password-wrapped DEK ---
  const { error: keyError } = await admin
    .from("user_keys")
    .update({
      salt: new_salt,
      iv: new_iv,
      wrapped_dek: new_wrapped_dek,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", keyRow.user_id);

  if (keyError) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // --- Update Supabase auth password ---
  const { error: authError } = await admin.auth.admin.updateUserById(
    keyRow.user_id,
    { password: new_password }
  );

  if (authError) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
