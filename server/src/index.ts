/**
 * API entry point.
 *
 * Fastify, four route groups, and a health check. Migrations run at boot so a fresh
 * `docker compose up` followed by `npm start` produces a working system without a
 * documented sequence of commands anybody can get wrong.
 */
import Fastify from "fastify";
import { config } from "./config.ts";
import { migrate } from "./migrate.ts";
import { pool } from "./db.ts";
import { ensureBucket } from "./storage.ts";
import { authRoutes } from "./routes/auth.ts";
import { familyRoutes } from "./routes/family.ts";
import { chatRoutes } from "./routes/chat.ts";
import { careRoutes } from "./routes/care.ts";
import { archiveRoutes } from "./routes/archive.ts";
import { letterRoutes } from "./routes/letters.ts";
import { voiceRoutes } from "./routes/voices.ts";
import { objectRoutes } from "./routes/objects.ts";
import { peopleRoutes } from "./routes/people.ts";
import { deedRoutes } from "./routes/deeds.ts";
import { mediaRoutes } from "./routes/media.ts";

const app = Fastify({
  logger: {
    level: config.isDev ? "info" : "warn",
    // Redact anything that could put a credential or a bearer token in a log file.
    redact: ["req.headers.authorization", "req.body.password"],
  },
  // Media is the largest thing posted: a 60s phone video. Fastify's 1MB default
  // would reject every upload with an opaque 413.
  bodyLimit: 64 * 1024 * 1024,
});

/**
 * Accept raw binary bodies for media upload.
 *
 * Fastify only parses JSON out of the box and rejects unknown content types, so
 * each media format is registered as a pass-through to a Buffer.
 */
for (const type of [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime",
  "audio/m4a", "audio/mp4", "audio/mpeg", "audio/aac", "audio/wav", "audio/webm",
]) {
  app.addContentTypeParser(type, { parseAs: "buffer" }, (_req, body, done) => done(null, body));
}

/**
 * CORS for the Expo web build, which runs on a different origin (8081/8091) than
 * the API (4001). Native builds are unaffected -- they have no origin.
 */
app.addHook("onRequest", async (req, reply) => {
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-allow-headers", "authorization,content-type,x-duration-sec");
  reply.header("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") await reply.code(204).send();
});

app.get("/health", async () => {
  // Touch the database: a process that is up but cannot query is not healthy, and
  // reporting otherwise is how a broken deploy passes its own check.
  await pool.query("SELECT 1");
  return { ok: true, env: config.env };
});

await app.register(authRoutes);
await app.register(familyRoutes);
await app.register(chatRoutes);
await app.register(careRoutes);
await app.register(archiveRoutes);
await app.register(letterRoutes);
await app.register(voiceRoutes);
await app.register(objectRoutes);
await app.register(peopleRoutes);
await app.register(deedRoutes);
await app.register(mediaRoutes);

app.setErrorHandler((err: Error, _req, reply) => {
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  // 5xx means we broke; log it. 4xx is the caller being told something normal.
  if (status >= 500) app.log.error(err);
  // Never leak an internal message or stack to a client.
  return reply.code(status).send({
    error: status >= 500 ? "internal server error" : err.message,
  });
});

try {
  await migrate();
  await ensureBucket();
  await app.listen({ port: config.port, host: config.host });
  console.log(`[api] listening on http://localhost:${config.port}`);
} catch (err) {
  console.error("[api] failed to start:", (err as Error).message);
  process.exit(1);
}

// Finish in-flight requests and close the pool rather than dropping connections.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
