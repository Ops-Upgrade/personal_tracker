import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResetToken } from "../_helpers/resetToken";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
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
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  // Verify proof token
  const tokenPayload = verifyResetToken(reset_token);
  if (!tokenPayload) {
    return NextResponse.json(
      { error: "Invalid or expired reset token." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Re-fetch user by email (do NOT trust userId from the client)
  const { data: listData, error: listError } =
    await admin.auth.admin.listUsers();

  if (listError || !listData) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Verify the token's userId matches the freshly-looked-up user
  if (tokenPayload.userId !== user.id) {
    return NextResponse.json(
      { error: "Invalid or expired reset token." },
      { status: 400 }
    );
  }

  // Update user_keys with new password-wrapped DEK
  const { error: keyError } = await admin
    .from("user_keys")
    .update({
      salt: new_salt,
      iv: new_iv,
      wrapped_dek: new_wrapped_dek,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (keyError) {
    return NextResponse.json(
      { error: "Failed to update encryption keys." },
      { status: 500 }
    );
  }

  // Update Supabase auth password
  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    password: new_password,
  });

  if (authError) {
    return NextResponse.json(
      {
        error:
          "Password auth update failed. Your encryption keys were updated. Please contact support.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
