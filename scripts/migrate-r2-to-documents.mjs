#!/usr/bin/env node
/**
 * One-off migration: move legacy R2 prefixes (expenses/, certificates/,
 * vault/) under the unified documents/{userId}/{fileName} layout.
 *
 * For every object it: copies to the documents/ key, verifies the target's
 * size matches, and only then deletes the source — so a crash mid-run can
 * never lose data (worst case is a duplicate).
 *
 * Usage:
 *   node scripts/migrate-r2-to-documents.mjs            # dry run (default)
 *   node scripts/migrate-r2-to-documents.mjs --execute  # real run
 */
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const execute = process.argv.includes("--execute");

// Load .env.local (same source of truth as the Next.js app)
const { combinedEnv } = loadEnvConfig(process.cwd());
const env = { ...process.env, ...combinedEnv };

const ACCOUNT_ID = env.R2_ACCOUNT_ID;
const ACCESS_KEY = env.R2_ACCESS_KEY_ID;
const SECRET_KEY = env.R2_SECRET_ACCESS_KEY;
const BUCKET = env.R2_BUCKET_NAME || "personal-tracker";

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error(
    "Missing R2_* env vars (expected R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local)",
  );
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const LEGACY_PREFIXES = ["expenses/", "certificates/", "vault/"];

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents || []) {
      keys.push({ key: obj.Key, size: obj.Size, etag: obj.ETag });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function head(key) {
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { exists: true, size: res.ContentLength, etag: res.ETag };
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return { exists: false, size: 0 };
    }
    throw err;
  }
}

async function main() {
  console.log(`R2 migration — bucket "${BUCKET}" (${execute ? "EXECUTE" : "dry run"})`);

  let copied = 0;
  let duplicateDeletes = 0;
  let conflicts = 0;
  let unexpected = 0;
  let errors = 0;
  let bytes = 0;

  for (const prefix of LEGACY_PREFIXES) {
    const objects = await listAll(prefix);
    console.log(`\n[${prefix}] ${objects.length} object(s)`);

    for (const { key, size } of objects) {
      try {
        const m = new RegExp(`^${prefix}([^/]+)/([^/]+)$`).exec(key);
        if (!m) {
          console.log(`  UNEXPECTED  ${key}`);
          unexpected++;
          continue;
        }
        const [, userId, fileName] = m;
        const target = `documents/${userId}/${fileName}`;
        const existing = await head(target);

        if (existing.exists) {
          if (existing.size === size) {
            // Same size → treat as an already-migrated duplicate; safe to remove.
            console.log(`  DUP-DELETE  ${key}`);
            duplicateDeletes++;
            if (execute) {
              await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
            }
          } else {
            console.log(`  CONFLICT    ${key} -> ${target} (target exists, size differs)`);
            conflicts++;
          }
          continue;
        }

        console.log(`  COPY        ${key} -> ${target}`);
        if (!execute) {
          copied++;
          bytes += size;
          continue;
        }

        await client.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${encodeURIComponent(key)}`,
            Key: target,
          }),
        );
        const verified = await head(target);
        if (!verified.exists || verified.size !== size) {
          throw new Error("copy verification failed — source kept");
        }
        await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
        copied++;
        bytes += size;
      } catch (err) {
        console.error(`  ERROR       ${key}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(
    `\nSummary: ${copied} copied (${(bytes / 1024 / 1024).toFixed(2)} MiB), ` +
      `${duplicateDeletes} duplicate deletes, ${conflicts} conflict(s), ` +
      `${unexpected} unexpected, ${errors} error(s)`,
  );
  if (!execute) console.log("Dry run — re-run with --execute to apply.");
  if (conflicts || unexpected || errors) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
