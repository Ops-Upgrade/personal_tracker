import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { getAuthenticatedUserId } from "../_helpers/auth";

/**
 * POST /api/storage/download
 *
 * Request body (JSON):
 *   key: string — full object key (e.g. "expenses/{userId}/{uuid}.enc")
 *
 * Response (JSON):
 *   url: string — presigned GET URL (valid for 5 minutes)
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

  // Validate the key contains the user's ID in the path (ownership check)
  // Expected format: {folder}/{userId}/{fileName}
  const parts = key.split("/");
  if (parts.length !== 3 || parts[1] !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

  return NextResponse.json({ url });
}
