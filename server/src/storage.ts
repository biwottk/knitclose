/**
 * Object storage.
 *
 * Talks the S3 API to whatever is configured: MinIO in a container now, S3 later.
 * The application never learns which, because both speak the same protocol through
 * @aws-sdk/client-s3 -- that is the entire reason MinIO was chosen over a local
 * folder. A filesystem stub would have to be thrown away; this does not.
 *
 * TWO RULES the rest of the server depends on:
 *
 *  1. The DATABASE STORES KEYS, NEVER URLS. A URL is either short-lived (so
 *     persisting it stores something already expired) or permanent (so it is a
 *     public bucket, which the security posture forbids). Rows keep
 *     'families/f_.../photo.jpg'; URLs are minted per response.
 *
 *  2. MEDIA IS NEVER PUBLIC. Reads go through presigned GETs that expire, so a
 *     leaked link stops working and cannot be shared outside the circle.
 */
import { Readable } from "node:stream";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config, currentStoragePublicUrl } from "./config.ts";

const s3 = new S3Client({
  region: config.storage.region,
  // Present for MinIO, absent for S3.
  endpoint: config.storage.endpoint,
  // MinIO serves buckets as a path (host/bucket/key); S3 prefers a virtual host
  // (bucket.host/key). Keyed off the custom endpoint so there is one switch.
  forcePathStyle: Boolean(config.storage.endpoint),
  credentials:
    config.storage.accessKeyId && config.storage.secretAccessKey
      ? {
          accessKeyId: config.storage.accessKeyId,
          secretAccessKey: config.storage.secretAccessKey,
        }
      // On AWS, omitting credentials is correct: the SDK picks up the task/instance
      // IAM role, which is strictly better than long-lived keys in env vars.
      : undefined,
});

/**
 * A second client whose only job is signing URLs for the host the PHONE will call.
 *
 * A presigned URL's signature covers the host header, so a URL signed for
 * 'localhost:9002' is invalid when a physical device requests it from the LAN IP --
 * and the failure is a 403 on every image, which looks like a bug in the app.
 *
 * Keyed by public URL and built lazily, because in development that URL follows the
 * machine's LAN address and the address can change under a long-running process (see
 * currentStoragePublicUrl). A signer cached at boot kept minting URLs for a host that no
 * longer existed.
 */
const signers = new Map<string, S3Client>();
function signerFor(publicUrl: string): S3Client {
  if (publicUrl === config.storage.endpoint) return s3;
  let client = signers.get(publicUrl);
  if (!client) {
    client = new S3Client({
      region: config.storage.region,
      endpoint: publicUrl,
      forcePathStyle: Boolean(config.storage.endpoint),
      credentials:
        config.storage.accessKeyId && config.storage.secretAccessKey
          ? {
              accessKeyId: config.storage.accessKeyId,
              secretAccessKey: config.storage.secretAccessKey,
            }
          : undefined,
    });
    signers.set(publicUrl, client);
  }
  return client;
}

/** Create the bucket when missing. Idempotent; a no-op against a real S3 bucket. */
export async function ensureBucket(): Promise<void> {
  const Bucket = config.storage.bucket;
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    return;
  } catch {
    // Fall through to create. HeadBucket throws for both "missing" and "no
    // permission to head"; attempting the create surfaces which one it was.
  }
  try {
    await s3.send(new CreateBucketCommand({ Bucket }));
    console.log(`[storage] created bucket ${Bucket}`);
  } catch (err) {
    const name = (err as { name?: string }).name;
    // Someone else won the race, or it existed all along. Both are fine.
    if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") return;
    throw err;
  }
}

/**
 * Storage keys are namespaced by family.
 *
 * This is deliberate and worth the extra argument: it makes "delete everything
 * belonging to this family" a prefix operation (a GDPR/erasure request, or a
 * family closing their account), and it makes an accidental cross-family key
 * collision impossible rather than merely unlikely.
 */
export function mediaKey(familyId: string, mediaId: string, filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  return `families/${familyId}/media/${mediaId}${ext.toLowerCase()}`;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | Readable,
  contentType?: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** A short-lived signed GET. The only way media is ever read. */
export async function signedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    signerFor(currentStoragePublicUrl()),
    new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    { expiresIn: config.storage.signedUrlTtlSec },
  );
}

/**
 * Sign many keys at once, de-duplicated.
 *
 * A feed of deeds repeats the same author avatar dozens of times; signing is pure
 * CPU (HMAC), but doing it per occurrence in a hot list is waste that shows up as
 * latency. Returns a Map so callers can look keys up while shaping a response.
 */
export async function signedGetUrls(keys: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(keys.filter((k): k is string => Boolean(k)))];
  const signed = await Promise.all(unique.map((k) => signedGetUrl(k)));
  return new Map(unique.map((k, i) => [k, signed[i]]));
}
