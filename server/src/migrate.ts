/**
 * Migration runner.
 *
 * Applies every .sql file in ../migrations in filename order, exactly once, inside a
 * transaction, and records what it applied. Deliberately ~60 lines instead of a
 * migration framework: the schema is one file today, and a dependency whose job is
 * "run these files in order" earns its keep only once there are dozens.
 *
 * Each file is applied in its own transaction, so a failure leaves the database at
 * the last complete migration rather than half-way through a schema change.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, query } from "./db.ts";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await query<{ filename: string }>(`SELECT filename FROM schema_migrations`))
      .map((r) => r.filename),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    // Lexicographic order is why migrations are numbered 001_, 002_, ...
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file],
      );
      await client.query("COMMIT");
      console.log(`[migrate] applied ${file}`);
      count++;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  console.log(count === 0 ? "[migrate] already up to date" : `[migrate] ${count} migration(s) applied`);
}

// Allow `npm run migrate` as well as import from the server bootstrap.
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
