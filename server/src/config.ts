/**
 * Configuration, read once from the environment.
 *
 * EVERY value that differs between "docker on a laptop" and "AWS" lives here and
 * nowhere else. That is the whole reason this file exists: the storage layer talks
 * S3 and the data layer talks Postgres in both worlds, so migrating is meant to be
 * an env-var change plus a DNS name -- not a code change.
 *
 *   local docker            AWS
 *   --------------------    ----------------------------------
 *   postgres container  ->  RDS Postgres  (DATABASE_URL)
 *   minio container     ->  S3            (drop STORAGE_ENDPOINT, keep the rest)
 *
 * The MinIO-specific parts are exactly two: a custom endpoint and path-style
 * addressing. Unset STORAGE_ENDPOINT and both switch to real S3 behaviour.
 */
import { networkInterfaces } from "node:os";

/**
 * This machine's LAN address.
 *
 * WHY THIS IS NEEDED: a presigned URL's signature covers the hostname, so a URL signed
 * for 'localhost' is only usable ON this machine. A phone resolves 'localhost' to
 * itself, so every photo fails -- while curl on the laptop works perfectly, which makes
 * it look like an app bug rather than a configuration one.
 *
 * Defaulting to the detected LAN IP means a device on the same Wi-Fi works with no
 * setup, which is the normal case for this project. STORAGE_PUBLIC_URL still overrides.
 */
export function detectLanAddress(): string | undefined {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      // Skip loopback and link-local; prefer a routable private address.
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) {
        return a.address;
      }
    }
  }
  return undefined;
}

/**
 * The public storage URL, resolved NOW rather than once at boot.
 *
 * WHY: the API process ran for days across a DHCP lease change (.52 -> .53). Every
 * presigned URL it minted still named the old address, so every photo -- including the
 * preview of one just uploaded -- pointed at a host that no longer existed. That looked
 * exactly like "uploading an image is broken" while the upload itself had succeeded.
 *
 * An explicit STORAGE_PUBLIC_URL still wins, and outside development the value is fixed.
 * The interface scan is microseconds, and signing already happens per response.
 */
export function currentStoragePublicUrl(): string {
  if (process.env.STORAGE_PUBLIC_URL) return process.env.STORAGE_PUBLIC_URL;
  if (!DEV) return process.env.STORAGE_ENDPOINT ?? "http://localhost:9002";
  return `http://${detectLanAddress() ?? "localhost"}:9002`;
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return v;
}

const DEV = (process.env.NODE_ENV ?? "development") !== "production";

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isDev: DEV,
  port: Number(process.env.PORT ?? 4001),
  host: process.env.HOST ?? "0.0.0.0",

  /**
   * Postgres. Identical shape for RDS -- only the host and credentials change.
   * RDS requires TLS, so DATABASE_SSL=true flips it on without a code edit.
   */
  databaseUrl: required(
    "DATABASE_URL",
    DEV ? "postgres://knitclose:knitclose_dev_only@localhost:5434/knitclose" : undefined,
  ),
  databaseSsl: process.env.DATABASE_SSL === "true",

  storage: {
    bucket: process.env.STORAGE_BUCKET ?? "knitclose-media",
    region: process.env.STORAGE_REGION ?? "us-east-1",
    /**
     * Set for MinIO, UNSET for real S3. Its presence is what selects
     * path-style addressing (MinIO serves buckets as a path; S3 prefers a
     * virtual host), so there is one switch rather than two to forget.
     */
    endpoint: process.env.STORAGE_ENDPOINT ?? (DEV ? "http://localhost:9002" : undefined),
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? (DEV ? "knitclose" : undefined),
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? (DEV ? "knitclose_dev_only" : undefined),
    /**
     * The host the PHONE will fetch media from.
     *
     * In development this defaults to the detected LAN IP rather than 'localhost',
     * because 'localhost' is only ever correct for a browser on this machine -- and a
     * default that breaks the moment you pick up a phone is the wrong default. An
     * explicit STORAGE_PUBLIC_URL always wins (needed for tunnels, or a VM with an
     * address we cannot infer).
     */
    /** Boot-time snapshot, for logging. storage.ts re-resolves per signature. */
    publicUrl: currentStoragePublicUrl(),
    /** Presigned GET lifetime. Short by policy: no public buckets, no permanent URLs. */
    signedUrlTtlSec: Number(process.env.STORAGE_URL_TTL ?? 3600),
  },

  auth: {
    /**
     * HMAC key for access tokens.
     *
     * In production this MUST be provided; the dev fallback is deliberately an
     * obvious non-secret so that a misconfigured deploy is loud rather than
     * quietly signing real tokens with a value that is public in git history.
     * On AWS this becomes a Secrets Manager value, or disappears entirely when
     * Cognito takes over token issuance.
     */
    secret: required("AUTH_SECRET", DEV ? "dev-only-insecure-signing-key" : undefined),
    /** Short-lived by design; the client re-authenticates rather than holding power. */
    accessTtlSec: Number(process.env.AUTH_TTL ?? 60 * 60 * 12),
  },
} as const;

if (!config.isDev && config.auth.secret === "dev-only-insecure-signing-key") {
  throw new Error("AUTH_SECRET must be set to a real secret outside development");
}
