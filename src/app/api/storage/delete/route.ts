import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { getAuthenticatedUserId } from "../_helpers/auth";

/**
 * POST /api/storage/delete
 *
 * Request body (JSON):
 *   key: string — full object key (e.g. "expenses/{userId}/{uuid}.enc")
 *
 * Response: 200 on success.
 *
 * Note: R2/S3 DeleteObject is idempotent — returns success even if
 * the object does not exist. This matches the existing Supabase
 * Storage behavior where remove() silently succeeds.
 */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key } = body;
  if (!key) {
    return NextResponse.json({ error: "Missing required field: key" }, { status: 400 });
  }

  // Ownership check: key must contain the user's ID
  const parts = key.split("/");
  if (parts.length !== 3 || parts[1] !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );

  return NextResponse.json({ ok: true });
}
