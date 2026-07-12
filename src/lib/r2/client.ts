import { S3Client } from "@aws-sdk/client-s3";

/**
 * Server-only Cloudflare R2 client.
 *
 * Uses the S3-compatible API as documented at:
 * https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
 *
 * Environment variables (all server-only, no NEXT_PUBLIC_ prefix):
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 */

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!_client) {
    const accountId = getRequiredEnv("R2_ACCOUNT_ID");
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return _client;
}

/** Bucket name — single bucket for all features, folder-prefixed. */
export const R2_BUCKET = process.env.R2_BUCKET_NAME || "personal-tracker";
