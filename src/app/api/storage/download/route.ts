import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { getAuthenticatedUserId } from "../_helpers/auth";

/** R2 object names are always server-generated UUIDs with an .enc extension. */
const FILE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.enc$/i;

/**
 * POST /api/storage/download
 *
 * Request body (JSON):
 *   fileName: string — generated UUID.enc filename
 *
 * The object key is always documents/{userId}/{fileName} — {userId} comes
 * from the session, so callers can only download objects in their own folder.
 *
 * Response (JSON):
 *   url: string — presigned GET URL (valid for 5 minutes)
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

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

  return NextResponse.json({ url });
}
