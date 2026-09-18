/**
 * Authentication: password hashing and bearer tokens.
 *
 * WHY NODE'S OWN CRYPTO AND NOT bcrypt/argon2:
 * both popular choices are native addons, which means a compile step, a
 * platform-specific binary, and a real chance of "works on the laptop, fails in
 * the Lambda/container" later. scrypt is memory-hard, built into Node, needs no
 * build toolchain, and is an accepted password KDF. When Cognito takes over on AWS
 * this file is deleted rather than ported -- so its only job is to be correct and
 * boring in the meantime.
 *
 * Tokens are compact signed JWTs (HS256) issued by this server. They are
 * deliberately stateless and short-lived: no session table to keep consistent, and
 * a stolen token expires on its own.
 */
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { config } from "./config.ts";

/**
 * Promisified scrypt.
 *
 * Hand-wrapped rather than `promisify(scrypt)`: promisify resolves to the 3-argument
 * overload, which drops the options object -- and the options are where the work
 * factor lives, so the types would silently push us onto scrypt's weak defaults.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived));
  });
}

// OWASP-recommended scrypt work factor. N=2^15 costs ~50ms and ~32MB per hash,
// which is a real deterrent offline while staying invisible on a login screen.
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

/**
 * Hash a password. The output is self-describing --
 * 'scrypt$N$r$p$salt$hash' -- so the parameters can be raised later without
 * invalidating existing passwords: old hashes still verify against the values they
 * were created with.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
    // scrypt needs an explicit memory ceiling above the default or N=2^15 throws.
    maxmem: 256 * 1024 * 1024,
  });
  return [
    "scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P,
    salt.toString("base64url"), key.toString("base64url"),
  ].join("$");
}

/** Verify a password against a stored hash. False for malformed input, never a throw. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");

  const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
    maxmem: 256 * 1024 * 1024,
  });

  // Constant-time: a length-varying or short-circuiting compare leaks information
  // about the hash through timing.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface TokenClaims {
  /** user id */
  sub: string;
  /** the family this session is scoped to */
  fam: string;
  /** the person in the tree this user *is* -- authorship, reactions, claims */
  pid: string | null;
  /** role, so the API can refuse adults-only content to a child account */
  role: "admin" | "member" | "child";
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", config.auth.secret).update(data).digest("base64url");
}

export function issueToken(claims: Omit<TokenClaims, "exp">): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + config.auth.accessTtlSec;
  const payload = b64url(JSON.stringify({ ...claims, exp } satisfies TokenClaims));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

/**
 * Verify and decode. Returns null on ANY problem -- bad shape, bad signature,
 * expired -- because the caller's only correct response to all of them is 401, and
 * distinguishing them in an error message tells an attacker which part they got right.
 */
export function verifyToken(token: string): TokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    if (!claims.sub || !claims.fam) return null;
    return claims;
  } catch {
    return null;
  }
}
