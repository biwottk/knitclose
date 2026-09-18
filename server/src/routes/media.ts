/**
 * Media upload and read.
 *
 * Uploads are a raw binary POST rather than multipart: the client sends one file at
 * a time from expo-image-picker, so multipart parsing would be a dependency and a
 * parser for no gain.
 *
 * The row is written AFTER the object lands in storage. That ordering matters: a
 * media row whose bytes are missing renders as a broken image forever, whereas an
 * orphaned object is invisible and cheap to sweep up later. Fail towards the
 * recoverable side.
 */
import type { FastifyInstance } from "fastify";
import { authenticate } from "../access.ts";
import { newId, query, queryOne } from "../db.ts";
import { mediaKey, putObject, signedGetUrl } from "../storage.ts";

/**
 * Only formats the app actually renders, and only ones whose bytes we can serve
 * without transcoding. An allow-list rather than a deny-list: uploading an SVG to a
 * media bucket that is later served to a browser is a stored-XSS vector.
 */
const ALLOWED = new Map<string, "photo" | "video" | "audio">([
  ["image/jpeg", "photo"], ["image/png", "photo"], ["image/webp", "photo"],
  ["image/heic", "photo"], ["image/heif", "photo"],
  ["video/mp4", "video"], ["video/quicktime", "video"],
  ["audio/m4a", "audio"], ["audio/mp4", "audio"], ["audio/mpeg", "audio"],
  ["audio/aac", "audio"], ["audio/wav", "audio"], ["audio/webm", "audio"],
]);

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "image/heic": ".heic", "image/heif": ".heif",
  "video/mp4": ".mp4", "video/quicktime": ".mov",
  "audio/m4a": ".m4a", "audio/mp4": ".m4a", "audio/mpeg": ".mp3",
  "audio/aac": ".aac", "audio/wav": ".wav", "audio/webm": ".webm",
};

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /media
   *   Content-Type: image/jpeg
   *   body: raw bytes
   *
   * Returns { id, uri } -- the id to attach to a deed or message, and a signed URL
   * so the client can show the upload immediately without a refetch.
   */
  app.post("/media", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    const kind = ALLOWED.get(contentType);
    if (!kind) {
      return reply.code(415).send({
        error: `unsupported content type '${contentType}'`,
        supported: [...ALLOWED.keys()],
      });
    }

    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: "empty request body" });
    }

    const mediaId = newId("m");
    const key = mediaKey(caller.familyId, mediaId, EXT[contentType] ?? "");

    // Storage first; the row only exists once the bytes are safely there.
    await putObject(key, body, contentType);

    const durationHeader = Number(req.headers["x-duration-sec"]);
    await query(
      `INSERT INTO media (id, family_id, kind, storage_key, content_type, bytes, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        mediaId, caller.familyId, kind, key, contentType, body.length,
        Number.isFinite(durationHeader) && durationHeader > 0 ? durationHeader : null,
      ],
    );

    return reply.code(201).send({ id: mediaId, kind, uri: await signedGetUrl(key) });
  });

  /**
   * Re-sign a single media id.
   *
   * Signed URLs expire, and a long-lived screen (an open recipe, a paused voice
   * note) will eventually hold a dead one. This lets the client refresh a URL
   * without refetching the whole entity it belongs to.
   */
  app.get("/media/:id/url", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };

    const row = await queryOne<{ storage_key: string }>(
      `SELECT storage_key FROM media WHERE id = $1 AND family_id = $2`,
      [id, caller.familyId],
    );
    if (!row) return reply.code(404).send({ error: "media not found" });

    return reply.send({ uri: await signedGetUrl(row.storage_key) });
  });
}
