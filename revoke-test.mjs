import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local
const env = {};
try {
  readFileSync("E:/Projects/personal_tracker/.env.local", "utf8")
    .split("\n")
    .forEach(line => {
      const [k, ...v] = line.trim().split("=");
      if (k && v.length) env[k] = v.join("=");
    });
} catch { }

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SECRET) {
  console.error("Missing env vars"); process.exit(1);
}

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node revoke-test.mjs <email> <password>"); process.exit(1);
}

// Device A
const clientA = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: signInA, error: errA } = await clientA.auth.signInWithPassword({ email, password });
if (errA || !signInA.session) { console.error("Device A failed:", errA?.message); process.exit(1); }
console.log("Device A signed in. user_id:", signInA.session.user.id);

// Device B
const clientB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: signInB, error: errB } = await clientB.auth.signInWithPassword({ email, password });
if (errB || !signInB.session) { console.error("Device B failed:", errB?.message); await clientA.auth.signOut({ scope: "local" }); process.exit(1); }
const refreshTokenB = signInB.session.refresh_token;
console.log("Device B signed in.");

// Get Device B session_id from JWT
const jwtB = JSON.parse(Buffer.from(signInB.session.access_token.split(".")[1], "base64url").toString());
const sessionIdB = jwtB.session_id;
console.log("Device B session_id (from JWT):", sessionIdB);

if (!sessionIdB) {
  console.error("No session_id in JWT — GoTrue version may not include it");
  await Promise.all([clientA.auth.signOut({ scope: "local" }), clientB.auth.signOut({ scope: "local" })]);
  process.exit(1);
}

// Try revoke_session (will fail if migration not applied yet)
const { data: revokeResult, error: revokeErr } = await clientA.rpc("revoke_session", { p_session_id: sessionIdB });
if (revokeErr) {
  if (revokeErr.code === "42883" || revokeErr.message?.includes("does not exist")) {
    console.log("SKIP: revoke_session() not yet deployed (migration not applied).");
    console.log("Checking cascade behavior directly via admin delete instead...");

    // Directly delete from auth.sessions via admin to test cascade
    const admin = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: delErr } = await admin.from("auth.sessions").delete().eq("id", sessionIdB);
    if (delErr) {
      console.log("Admin direct delete of auth.sessions:", delErr.message);
      console.log("(This is expected — PostgREST exposes public schema only, not auth schema)");
      console.log("Cannot verify cascade without applying the migration.");
    }
  } else {
    console.error("revoke_session error:", revokeErr.message, revokeErr.code);
  }
  await Promise.all([clientA.auth.signOut({ scope: "local" }), clientB.auth.signOut({ scope: "local" })]);
  process.exit(0);
}

console.log("revoke_session() result:", revokeResult);

// Wait for cascade
await new Promise(r => setTimeout(r, 1500));

// Test Device B refresh
const { error: refreshErr } = await clientB.auth.refreshSession({ refresh_token: refreshTokenB });
if (refreshErr) {
  console.log("PASS: Device B refresh rejected:", refreshErr.message);
  console.log("=> auth.sessions -> auth.refresh_tokens cascade: CONFIRMED");
} else {
  console.log("FAIL: Device B got new session. Cascade did NOT propagate.");
  console.log("=> Revocation is cosmetic. auth.sessions delete did not invalidate refresh token.");
  await clientB.auth.signOut({ scope: "local" });
}

await clientA.auth.signOut({ scope: "local" });
console.log("Cleanup done.");
