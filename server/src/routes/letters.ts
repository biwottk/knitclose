/**
 * The Letter Box and The Voice Vault.
 *
 * Both are Archive heirlooms: objects a family goes looking for deliberately, which is why
 * they get their own routes rather than becoming tagged timeline entries. See
 * docs/archive_contents.md.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, visibleAudiences } from "../access.ts";
import { newId, query, queryOne, transaction } from "../db.ts";
import { shapeMedia, type MediaRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

const LETTER_KINDS = ["letter", "card", "diary", "note", "telegram"];

export async function letterRoutes(app: FastifyInstance): Promise<void> {
  app.get("/letters", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const letters = await query<{
      id: string; kind: string; title: string;
      from_name: string | null; from_person_id: string | null;
      to_name: string | null; to_person_id: string | null;
      when_text: string | null; when_date: string | null;
      transcript: string | null; transcript_confirmed: boolean;
      provenance: string | null; held_by_name: string | null;
      image_media_id: string | null; reading_media_id: string | null;
      audience: string; created_at: Date;
    }>(
      `SELECT id, kind, title, from_name, from_person_id, to_name, to_person_id,
              when_text, when_date, transcript, transcript_confirmed, provenance,
              held_by_name, image_media_id, reading_media_id, audience, created_at
         FROM letters
        WHERE family_id = $1 AND audience = ANY($2)
        -- Oldest first: a letter box is read chronologically, unlike a feed.
        ORDER BY when_date NULLS LAST, created_at`,
      [caller.familyId, visibleAudiences(caller)],
    );

    if (letters.length === 0) return reply.send({ letters: [] });

    const ids = letters.map((l) => l.id);
    const [pages, media] = await Promise.all([
      query<MediaRow & { letter_id: string }>(
        `SELECT lp.letter_id, m.id, m.kind, m.storage_key, m.duration_sec, m.transcript
           FROM letter_pages lp JOIN media m ON m.id = lp.media_id
          WHERE lp.letter_id = ANY($1) ORDER BY lp.position`,
        [ids]),
      query<MediaRow>(
        `SELECT id, kind, storage_key, duration_sec, transcript FROM media
          WHERE id = ANY($1)`,
        [letters.flatMap((l) => [l.image_media_id, l.reading_media_id].filter(Boolean))]),
    ]);

    const urls = await signedGetUrls([
      ...pages.map((p) => p.storage_key),
      ...media.map((m) => m.storage_key),
    ]);
    const byId = new Map(media.map((m) => [m.id, m]));
    const pagesByLetter = new Map<string, MediaRow[]>();
    for (const p of pages) {
      pagesByLetter.set(p.letter_id, [...(pagesByLetter.get(p.letter_id) ?? []), p]);
    }

    return reply.send({
      letters: letters.map((l) => {
        const image = l.image_media_id ? byId.get(l.image_media_id) : undefined;
        const reading = l.reading_media_id ? byId.get(l.reading_media_id) : undefined;
        return {
          id: l.id, kind: l.kind, title: l.title,
          ...(l.from_name ? { fromName: l.from_name } : {}),
          ...(l.from_person_id ? { fromPersonId: l.from_person_id } : {}),
          ...(l.to_name ? { toName: l.to_name } : {}),
          ...(l.to_person_id ? { toPersonId: l.to_person_id } : {}),
          ...(l.when_text ? { whenText: l.when_text } : {}),
          ...(l.when_date ? { whenDate: l.when_date } : {}),
          ...(l.transcript ? { transcript: l.transcript } : {}),
          transcriptConfirmed: l.transcript_confirmed,
          ...(l.provenance ? { provenance: l.provenance } : {}),
          ...(l.held_by_name ? { heldByName: l.held_by_name } : {}),
          ...(image ? { imageUri: urls.get(image.storage_key) } : {}),
          ...(reading ? { reading: shapeMedia(reading, urls) } : {}),
          pages: (pagesByLetter.get(l.id) ?? []).map((p) => shapeMedia(p, urls)),
          audience: l.audience,
          createdAt: l.created_at.toISOString(),
        };
      }),
    });
  });

  app.post("/letters", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      kind?: string; title?: string; fromName?: string; fromPersonId?: string;
      toName?: string; toPersonId?: string; whenText?: string; whenDate?: string;
      transcript?: string; transcriptConfirmed?: boolean; provenance?: string;
      heldByName?: string; imageMediaId?: string; readingMediaId?: string;
      pageMediaIds?: string[]; audience?: string;
    };

    const title = body.title?.trim();
    if (!title) return reply.code(400).send({ error: "title is required" });

    const kind = body.kind ?? "letter";
    if (!LETTER_KINDS.includes(kind)) {
      return reply.code(400).send({ error: "invalid kind", supported: LETTER_KINDS });
    }

    const audience = body.audience ?? "everyone";
    if (!["everyone", "adults", "care", "branch"].includes(audience)) {
      return reply.code(400).send({ error: "invalid audience" });
    }

    // Media and people must belong to the calling family, or a crafted request could
    // attach another family scan to this letter.
    const ownMedia = async (id?: string) => id && await queryOne(
      `SELECT 1 FROM media WHERE id = $1 AND family_id = $2`, [id, caller.familyId]) ? id : null;
    const ownPerson = async (id?: string) => id && await queryOne(
      `SELECT 1 FROM people WHERE id = $1 AND family_id = $2`, [id, caller.familyId]) ? id : null;

    const letterId = newId("l");

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO letters (id, family_id, kind, title, from_name, from_person_id,
                              to_name, to_person_id, when_text, when_date, transcript,
                              transcript_confirmed, provenance, held_by_name,
                              image_media_id, reading_media_id, audience, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          letterId, caller.familyId, kind, title,
          body.fromName?.trim() || null, await ownPerson(body.fromPersonId),
          body.toName?.trim() || null, await ownPerson(body.toPersonId),
          body.whenText?.trim() || null, body.whenDate || null,
          body.transcript?.trim() || null,
          // A transcription is a GUESS until a human says otherwise, so this defaults
          // false: the UI shows unconfirmed text as a draft, never as her words.
          body.transcriptConfirmed ?? false,
          body.provenance?.trim() || null, body.heldByName?.trim() || null,
          await ownMedia(body.imageMediaId), await ownMedia(body.readingMediaId),
          audience, caller.personId,
        ],
      );

      let pos = 0;
      for (const mediaId of body.pageMediaIds ?? []) {
        await client.query(
          `INSERT INTO letter_pages (letter_id, media_id, position)
           SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM media WHERE id = $2 AND family_id = $4)
           ON CONFLICT DO NOTHING`,
          [letterId, mediaId, pos++, caller.familyId],
        );
      }
    });

    return reply.code(201).send({ id: letterId });
  });

  /**
   * Correct or confirm a transcription.
   *
   * The human-in-the-loop step, and the reason OCR is acceptable in this product at all:
   * a machine reading of somebody handwriting is a draft, and a person deciding it is
   * right is what turns it into archive material.
   */
  app.patch("/letters/:id/transcript", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { id } = req.params as { id: string };
    const { transcript, confirmed } = (req.body ?? {}) as {
      transcript?: string; confirmed?: boolean;
    };

    const rows = await query(
      `UPDATE letters
          SET transcript = coalesce($1, transcript),
              transcript_confirmed = coalesce($2, transcript_confirmed)
        WHERE id = $3 AND family_id = $4 AND audience = ANY($5)
      RETURNING id`,
      [transcript?.trim() ?? null, confirmed ?? null, id, caller.familyId, visibleAudiences(caller)],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "letter not found" });
    return reply.send({ ok: true });
  });
}
