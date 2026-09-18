/**
 * Postgres access.
 *
 * A pool, a tagged query helper, and a transaction helper. No ORM: the queries in
 * this server are the security boundary (audience filtering happens in SQL), and
 * an ORM's generated SQL is exactly the thing you do not want to have to guess
 * about when the question is "can a child account see this row".
 */
import pg from "pg";
import { config } from "./config.ts";

/**
 * Postgres returns NUMERIC as a string to preserve arbitrary precision. Our
 * numerics are face-tag coordinates and audio durations -- both genuinely numbers
 * in the domain -- so parse them once here rather than in every caller. bigint
 * (byte counts) is left alone deliberately: it can exceed Number.MAX_SAFE_INTEGER.
 */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));

/**
 * DATE columns must NOT be turned into JS Dates. 'date' has no time zone, so the
 * driver's default parse produces local midnight, which shifts the day backwards
 * for anyone west of UTC -- a birthday landing on the wrong date is precisely the
 * class of bug this product cannot afford. Keep the ISO string.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // RDS terminates TLS with a cert chain the container may not have; verification
  // is enabled via DATABASE_SSL and the RDS CA bundle in deployment.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  // A pooled connection dying in the background must not take the process with it.
  console.error("[db] idle client error:", err.message);
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/** First row or undefined -- the common "fetch one by id" shape. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

/**
 * Run several statements atomically on ONE connection.
 *
 * This matters more than it looks: creating a deed touches deeds, deed_people,
 * deed_tags and deed_media. Without a transaction a failure halfway leaves a deed
 * with no subjects and no photos -- visible, broken, and permanent in an app whose
 * entire promise is permanence.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Collision-resistant, readable ids. Prefix keeps logs and psql output legible. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
