import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { getAuthenticatedUserId } from "../_helpers/auth";

/**
 * POST /api/storage/upload
 *
 * Request body (JSON):
 *   folder:   string  — feature folder ("expenses" | "certificates")
 *   fileName: string  — generated UUID.enc filename
 *
 * Response (JSON):
 *   url: string — presigned PUT URL (valid for 5 minutes)
 *   key: string — the full object key in R2
 */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { folder?: string; fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { folder, fileName } = body;

  if (!folder || !fileName) {
    return NextResponse.json(
      { error: "Missing required fields: folder, fileName" },
      { status: 400 }
    );
  }

  // Validate folder is one of the allowed feature folders
  const allowedFolders = ["expenses", "certificates"];
  if (!allowedFolders.includes(folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  // Validate fileName matches expected pattern: UUID.enc
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.enc$/i.test(fileName)) {
    return NextResponse.json({ error: "Invalid fileName format" }, { status: 400 });
  }

  // Enforce user-scoped path: {folder}/{userId}/{uuid}.enc
  const key = `${folder}/${userId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: "application/octet-stream",
  });

  const url = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

  return NextResponse.json({ url, key });
}
