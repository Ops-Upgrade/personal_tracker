import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateResetToken } from "../_helpers/resetToken";

const GENERIC_ERROR =
  "If this account exists and has a recovery key, you may reset your password.";

export async function POST(request: Request) {
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

  const admin = createAdminClient();

  // Look up user by email
  const { data: listData, error: listError } =
    await admin.auth.admin.listUsers();

  if (listError || !listData) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Fetch recovery key material
  const { data: keyRow, error: keyError } = await admin
    .from("user_keys")
    .select("recovery_salt, recovery_iv, recovery_wrapped_dek")
    .eq("user_id", user.id)
    .maybeSingle();

  if (keyError || !keyRow || !keyRow.recovery_wrapped_dek) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Generate proof token so step 2 can be called without re-validating email
  const resetToken = generateResetToken(user.id);

  return NextResponse.json({
    recovery_salt: keyRow.recovery_salt,
    recovery_iv: keyRow.recovery_iv,
    recovery_wrapped_dek: keyRow.recovery_wrapped_dek,
    reset_token: resetToken,
  });
}
