/**
 * Chat: threads and messages (Speed 1).
 *
 * Thread visibility is TWO conditions, not one: the audience must be allowed for this
 * caller's role, AND the caller must be an explicit member of the thread. That second
 * condition is what keeps "Nana's Care" from being readable by the whole family just
 * because they are in the family -- a care thread carries medical detail that is not
 * group chat.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, visibleAudiences } from "../access.ts";
import { newId, query, transaction } from "../db.ts";
import { shapeMedia, type MediaRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get("/threads", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const threads = await query<{
      id: string; title: string; kind: string; audience: string; member_ids: string[];
    }>(
      `SELECT t.id, t.title, t.kind, t.audience,
              coalesce(array_agg(tm.person_id) FILTER (WHERE tm.person_id IS NOT NULL), '{}') AS member_ids
         FROM threads t
         LEFT JOIN thread_members tm ON tm.thread_id = t.id
        WHERE t.family_id = $1
          AND t.audience = ANY($2)
          -- Explicit membership, not merely family membership.
          AND EXISTS (SELECT 1 FROM thread_members x WHERE x.thread_id = t.id AND x.person_id = $3)
        GROUP BY t.id
        ORDER BY t.created_at`,
      [caller.familyId, visibleAudiences(caller), caller.personId],
    );

    return reply.send({
      threads: threads.map((t) => ({
        id: t.id, title: t.title, kind: t.kind,
        audience: t.audience, memberIds: t.member_ids,
      })),
    });
  });

  app.get("/threads/:id/messages", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };

    // Re-check access to the thread itself, or a member of the family could read the
    // care thread by guessing its id.
    const allowed = await query(
      `SELECT 1 FROM threads t
         WHERE t.id = $1 AND t.family_id = $2 AND t.audience = ANY($3)
           AND EXISTS (SELECT 1 FROM thread_members x WHERE x.thread_id = t.id AND x.person_id = $4)`,
      [id, caller.familyId, visibleAudiences(caller), caller.personId],
    );
    if (allowed.length === 0) return reply.code(404).send({ error: "thread not found" });

    const messages = await query<{
      id: string; author_id: string | null; author_name: string; body: string | null;
      context_label: string | null; promoted_to_deed_id: string | null; created_at: Date;
      audio_media_id: string | null;
    }>(
      `SELECT id, author_id, author_name, body, context_label, promoted_to_deed_id,
              created_at, audio_media_id
         FROM messages WHERE thread_id = $1 ORDER BY created_at`,
      [id],
    );

    if (messages.length === 0) return reply.send({ messages: [] });

    const ids = messages.map((m) => m.id);
    const [audio, photos, reactions, seen] = await Promise.all([
      query<MediaRow>(
        `SELECT id, kind, storage_key, duration_sec, transcript FROM media
           WHERE id = ANY($1)`,
        [messages.map((m) => m.audio_media_id).filter(Boolean)],
      ),
      query<MediaRow & { message_id: string }>(
        `SELECT mm.message_id, m.id, m.kind, m.storage_key, m.duration_sec, m.transcript
           FROM message_media mm JOIN media m ON m.id = mm.media_id
          WHERE mm.message_id = ANY($1) ORDER BY mm.position`,
        [ids],
      ),
      query<{ message_id: string; person_id: string; key: string }>(
        `SELECT message_id, person_id, key FROM message_reactions WHERE message_id = ANY($1)`, [ids]),
      query<{ message_id: string; person_id: string }>(
        `SELECT message_id, person_id FROM message_seen WHERE message_id = ANY($1)`, [ids]),
    ]);

    const urls = await signedGetUrls([
      ...audio.map((a) => a.storage_key),
      ...photos.map((p) => p.storage_key),
    ]);

    const audioById = new Map(audio.map((a) => [a.id, a]));
    const photosByMessage = new Map<string, MediaRow[]>();
    for (const ph of photos) {
      photosByMessage.set(ph.message_id, [...(photosByMessage.get(ph.message_id) ?? []), ph]);
    }
    const reactionsByMessage = new Map<string, Record<string, string[]>>();
    for (const r of reactions) {
      const cur = reactionsByMessage.get(r.message_id) ?? {};
      cur[r.key] = [...(cur[r.key] ?? []), r.person_id];
      reactionsByMessage.set(r.message_id, cur);
    }
    const seenByMessage = new Map<string, string[]>();
    for (const s of seen) {
      seenByMessage.set(s.message_id, [...(seenByMessage.get(s.message_id) ?? []), s.person_id]);
    }

    return reply.send({
      messages: messages.map((m) => {
        const a = m.audio_media_id ? audioById.get(m.audio_media_id) : undefined;
        const ph = photosByMessage.get(m.id) ?? [];
        return {
          id: m.id, threadId: id,
          authorId: m.author_id ?? "", authorName: m.author_name,
          createdAt: m.created_at.toISOString(),
          ...(m.body ? { body: m.body } : {}),
          ...(a ? { audio: shapeMedia(a, urls) } : {}),
          // The transcript lives on the audio row but the client reads it off the
          // message, where it is rendered as a pull-quote.
          ...(a?.transcript ? { transcript: a.transcript } : {}),
          ...(ph.length ? { photos: ph.map((x) => shapeMedia(x, urls)) } : {}),
          ...(reactionsByMessage.has(m.id) ? { reactions: reactionsByMessage.get(m.id) } : {}),
          ...(seenByMessage.has(m.id) ? { seenBy: seenByMessage.get(m.id) } : {}),
          ...(m.promoted_to_deed_id ? { promotedToDeedId: m.promoted_to_deed_id } : {}),
          ...(m.context_label ? { contextLabel: m.context_label } : {}),
        };
      }),
    });
  });

  app.post("/threads/:id/messages", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });

    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { body?: string; mediaIds?: string[]; audioMediaId?: string };

    const allowed = await query(
      `SELECT 1 FROM threads t
         WHERE t.id = $1 AND t.family_id = $2 AND t.audience = ANY($3)
           AND EXISTS (SELECT 1 FROM thread_members x WHERE x.thread_id = t.id AND x.person_id = $4)`,
      [id, caller.familyId, visibleAudiences(caller), caller.personId],
    );
    if (allowed.length === 0) return reply.code(404).send({ error: "thread not found" });

    // Text, voice, OR a photograph. Quick Share must support the photo-only moment
    // it advertises; requiring a caption turns “just share it” back into composition work.
    if (!body.body?.trim() && !body.audioMediaId && !body.mediaIds?.length) {
      return reply.code(400).send({ error: "a message needs text, a photograph, or a voice note" });
    }

    const messageId = newId("msg");
    await transaction(async (client) => {
      const author = await client.query<{ name: string }>(
        `SELECT name FROM people WHERE id = $1`, [caller.personId]);

      await client.query(
        `INSERT INTO messages (id, thread_id, family_id, author_id, author_name, body, audio_media_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          messageId, id, caller.familyId, caller.personId,
          author.rows[0]?.name ?? "A family member",
          // The original DB constraint predates message_media and accepts text/audio.
          // Empty string is intentionally non-null for a photo-only message; response shaping
          // omits it, and the attached media is inserted below in the same transaction.
          body.body?.trim() || (body.mediaIds?.length ? "" : null), body.audioMediaId ?? null,
        ],
      );
      let pos = 0;
      for (const mediaId of body.mediaIds ?? []) {
        await client.query(
          `INSERT INTO message_media (message_id, media_id, position)
           SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM media WHERE id = $2 AND family_id = $4)
           ON CONFLICT DO NOTHING`,
          [messageId, mediaId, pos++, caller.familyId],
        );
      }
      // The author has self-evidently seen their own message.
      await client.query(
        `INSERT INTO message_seen (message_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [messageId, caller.personId],
      );
    });

    return reply.code(201).send({ id: messageId });
  });

  /**
   * Create the default "All Family" thread.
   *
   * A new circle has no threads at all, and a Chat tab with nothing in it -- not even
   * somewhere to type -- reads as broken rather than as new. This gives the family one
   * obvious room to talk in.
   */
  app.post("/threads", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as { title?: string; kind?: string; audience?: string; memberIds?: string[] };
    const title = body.title?.trim() || "All Family";
    const kind = body.kind ?? "general";
    const audience = body.audience ?? "everyone";

    if (!["general", "care", "planning"].includes(kind)) {
      return reply.code(400).send({ error: "invalid thread kind" });
    }
    if (!["everyone", "adults", "care", "branch"].includes(audience)) {
      return reply.code(400).send({ error: "invalid audience" });
    }

    const threadId = newId("t");
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO threads (id, family_id, title, kind, audience) VALUES ($1, $2, $3, $4, $5)`,
        [threadId, caller.familyId, title, kind, audience],
      );

      /**
       * Default membership is EVERY person in the family. For a general thread that is
       * what "All Family" means; for a narrower thread the caller passes memberIds.
       */
      const members = body.memberIds?.length
        ? body.memberIds
        : (await client.query<{ id: string }>(
            `SELECT id FROM people WHERE family_id = $1`, [caller.familyId])).rows.map((r) => r.id);

      for (const personId of members) {
        await client.query(
          `INSERT INTO thread_members (thread_id, person_id)
           SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM people WHERE id = $2 AND family_id = $3)
           ON CONFLICT DO NOTHING`,
          [threadId, personId, caller.familyId],
        );
      }
    });

    return reply.code(201).send({ id: threadId });
  });
}
