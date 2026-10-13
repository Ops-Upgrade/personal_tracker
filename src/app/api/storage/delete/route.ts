import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { getAuthenticatedUserId } from "../_helpers/auth";

/** R2 object names are always server-generated UUIDs with an .enc extension. */
const FILE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.enc$/i;

/**
 * POST /api/storage/delete
 *
 * Request body (JSON):
 *   fileName: string — generated UUID.enc filename
 *
 * The object key is always documents/{userId}/{fileName} — {userId} comes
 * from the session, so callers can only delete objects in their own folder.
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

  let body: { fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fileName } = body;
  if (!fileName) {
    return NextResponse.json(
      { error: "Missing required field: fileName" },
      { status: 400 }
    );
  }

  // Validate fileName matches expected pattern: UUID.enc
  if (!FILE_NAME_PATTERN.test(fileName)) {
    return NextResponse.json({ error: "Invalid fileName format" }, { status: 400 });
  }

  // Unified documents/ store — the user scope comes from the session only
  const key = `documents/${userId}/${fileName}`;

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );

  return NextResponse.json({ ok: true });
}
