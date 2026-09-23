/**
 * Objects & Heirlooms.
 *
 * The ring, the clock, the toolbox. An Archive heirloom in the strictest sense: a thing a
 * family would physically put in a box, or wishes it could.
 *
 * THE CUSTODY CHAIN IS THE FEATURE. Where did it go is the question this answers, and the
 * passing-on is the story -- Grandma to Sarah to Maya is three generations of trust. See
 * docs/archive_contents.md.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, visibleAudiences } from "../access.ts";
import { newId, query, queryOne, transaction } from "../db.ts";
import { shapeMedia, type MediaRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

const OBJECT_KINDS = [
  "jewellery", "furniture", "tool", "textile", "book", "instrument",
  "artwork", "crockery", "medal", "property", "keepsake",
];

const STATUSES = ["held", "lost", "givenAway", "destroyed"];

export async function objectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/objects", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const objects = await query<{
      id: string; name: string; kind: string; story: string;
      origin_text: string | null; origin_year: string | null;
      origin_person_id: string | null; origin_person_name: string | null;
      held_by_person_id: string | null; held_by_name: string | null;
      where_kept: string | null; status: string; status_note: string | null;
      image_media_id: string | null; audience: string; created_at: Date;
    }>(
      `SELECT id, name, kind, story, origin_text, origin_year, origin_person_id,
              origin_person_name, held_by_person_id, held_by_name, where_kept,
              status, status_note, image_media_id, audience, created_at
         FROM objects
        WHERE family_id = $1 AND audience = ANY($2)
        -- Lost things first: an object nobody can find is the one the family wants to
        -- see, because it is the only entry here that is still a live question.
        ORDER BY (status = $3) DESC, created_at DESC`,
      [caller.familyId, visibleAudiences(caller), "lost"],
    );

    if (objects.length === 0) return reply.send({ objects: [] });

    const ids = objects.map((o) => o.id);
    const [photos, media, custody] = await Promise.all([
      query<MediaRow & { object_id: string }>(
        `SELECT op.object_id, m.id, m.kind, m.storage_key, m.duration_sec, m.transcript
           FROM object_photos op JOIN media m ON m.id = op.media_id
          WHERE op.object_id = ANY($1) ORDER BY op.position`,
        [ids]),
      query<MediaRow>(
        `SELECT id, kind, storage_key, duration_sec, transcript FROM media WHERE id = ANY($1)`,
        [objects.map((o) => o.image_media_id).filter(Boolean)]),
      query<{
        id: string; object_id: string; person_id: string | null; holder_name: string;
        from_text: string | null; from_date: string | null; note: string | null;
      }>(
        `SELECT id, object_id, person_id, holder_name, from_text, from_date, note
           FROM object_custody WHERE object_id = ANY($1)
          ORDER BY from_date NULLS FIRST, created_at`,
        [ids]),
    ]);

    const urls = await signedGetUrls([
      ...photos.map((p) => p.storage_key),
      ...media.map((m) => m.storage_key),
    ]);
    const byId = new Map(media.map((m) => [m.id, m]));

    const photosByObject = new Map<string, MediaRow[]>();
    for (const p of photos) {
      photosByObject.set(p.object_id, [...(photosByObject.get(p.object_id) ?? []), p]);
    }
    const custodyByObject = new Map<string, typeof custody>();
    for (const c of custody) {
      custodyByObject.set(c.object_id, [...(custodyByObject.get(c.object_id) ?? []), c]);
    }

    return reply.send({
      objects: objects.map((o) => {
        const image = o.image_media_id ? byId.get(o.image_media_id) : undefined;
        return {
          id: o.id, name: o.name, kind: o.kind, story: o.story,
          ...(o.origin_text ? { originText: o.origin_text } : {}),
          ...(o.origin_year ? { originYear: o.origin_year } : {}),
          ...(o.origin_person_id ? { originPersonId: o.origin_person_id } : {}),
          ...(o.origin_person_name ? { originPersonName: o.origin_person_name } : {}),
          ...(o.held_by_person_id ? { heldByPersonId: o.held_by_person_id } : {}),
          ...(o.held_by_name ? { heldByName: o.held_by_name } : {}),
          ...(o.where_kept ? { whereKept: o.where_kept } : {}),
          status: o.status,
          ...(o.status_note ? { statusNote: o.status_note } : {}),
          ...(image ? { imageUri: urls.get(image.storage_key) } : {}),
          photos: (photosByObject.get(o.id) ?? []).map((p) => shapeMedia(p, urls)),
          custody: (custodyByObject.get(o.id) ?? []).map((c) => ({
            id: c.id,
            ...(c.person_id ? { personId: c.person_id } : {}),
            holderName: c.holder_name,
            ...(c.from_text ? { fromText: c.from_text } : {}),
            ...(c.from_date ? { fromDate: c.from_date } : {}),
            ...(c.note ? { note: c.note } : {}),
          })),
          audience: o.audience,
          createdAt: o.created_at.toISOString(),
        };
      }),
    });
  });

  app.post("/objects", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      name?: string; kind?: string; story?: string;
      originText?: string; originYear?: string; originPersonId?: string;
      originPersonName?: string; heldByPersonId?: string; heldByName?: string;
      whereKept?: string; status?: string; statusNote?: string;
      imageMediaId?: string; photoMediaIds?: string[]; audience?: string;
    };

    const name = body.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });

    const kind = body.kind ?? "keepsake";
    if (!OBJECT_KINDS.includes(kind)) {
      return reply.code(400).send({ error: "invalid kind", supported: OBJECT_KINDS });
    }
    const status = body.status ?? "held";
    if (!STATUSES.includes(status)) {
      return reply.code(400).send({ error: "invalid status", supported: STATUSES });
    }
    const audience = body.audience ?? "everyone";
    if (!["everyone", "adults", "care", "branch"].includes(audience)) {
      return reply.code(400).send({ error: "invalid audience" });
    }

    // Media and people must belong to the calling family, or a crafted request could attach
    // another family photograph or relative to this object.
    const ownMedia = async (id?: string) => id && await queryOne(
      `SELECT 1 FROM media WHERE id = $1 AND family_id = $2`, [id, caller.familyId]) ? id : null;
    const ownPerson = async (id?: string) => id && await queryOne(
      `SELECT 1 FROM people WHERE id = $1 AND family_id = $2`, [id, caller.familyId]) ? id : null;

    const originPersonId = await ownPerson(body.originPersonId);
    const heldByPersonId = await ownPerson(body.heldByPersonId);

    // Resolve display names from the tree so the object reads correctly even if the person
    // row is later removed -- the same reason deeds denormalise author_name.
    const nameOf = async (personId: string | null) => personId
      ? (await queryOne<{ name: string }>(`SELECT name FROM people WHERE id = $1`, [personId]))?.name ?? null
      : null;

    const originPersonName = body.originPersonName?.trim() || await nameOf(originPersonId);
    const heldByName = body.heldByName?.trim() || await nameOf(heldByPersonId);

    const objectId = newId("o");

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO objects (id, family_id, name, kind, story, origin_text, origin_year,
                              origin_person_id, origin_person_name, held_by_person_id,
                              held_by_name, where_kept, status, status_note,
                              image_media_id, audience, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          objectId, caller.familyId, name, kind, body.story?.trim() ?? "",
          body.originText?.trim() || null, body.originYear?.trim() || null,
          originPersonId, originPersonName,
          heldByPersonId, heldByName,
          body.whereKept?.trim() || null, status, body.statusNote?.trim() || null,
          await ownMedia(body.imageMediaId), audience, caller.personId,
        ],
      );

      let pos = 0;
      for (const mediaId of body.photoMediaIds ?? []) {
        await client.query(
          `INSERT INTO object_photos (object_id, media_id, position)
           SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM media WHERE id = $2 AND family_id = $4)
           ON CONFLICT DO NOTHING`,
          [objectId, mediaId, pos++, caller.familyId],
        );
      }

      /*
       * Seed the custody chain with whoever holds it now.
       *
       * Without this an object starts with an empty chain and the current holder shown only
       * as a field -- so the very first thing the feature is for (a record of who has had
       * it) would be missing until somebody happened to hand it on.
       */
      if (heldByName) {
        await client.query(
          `INSERT INTO object_custody (id, object_id, person_id, holder_name, from_text, note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newId("oc"), objectId, heldByPersonId, heldByName,
            body.originText?.trim() || null,
            "Recorded when the object was added to the archive",
          ],
        );
      }
    });

    return reply.code(201).send({ id: objectId });
  });

  /**
   * Hand it on.
   *
   * Appends to the custody chain AND updates the current holder in one transaction, because
   * a chain that says Maya has it while the object still reads Sarah is worse than no record
   * at all -- it is a record that lies.
   */
  app.post("/objects/:id/custody", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      personId?: string; holderName?: string; fromText?: string;
      fromDate?: string; note?: string; whereKept?: string;
    };

    const object = await queryOne<{ id: string }>(
      `SELECT id FROM objects WHERE id = $1 AND family_id = $2 AND audience = ANY($3)`,
      [id, caller.familyId, visibleAudiences(caller)],
    );
    if (!object) return reply.code(404).send({ error: "object not found" });

    const personId = body.personId && await queryOne(
      `SELECT 1 FROM people WHERE id = $1 AND family_id = $2`, [body.personId, caller.familyId])
      ? body.personId : null;

    const holderName = body.holderName?.trim()
      || (personId ? (await queryOne<{ name: string }>(
          `SELECT name FROM people WHERE id = $1`, [personId]))?.name : undefined);

    if (!holderName) return reply.code(400).send({ error: "holderName is required" });

    const custodyId = newId("oc");
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO object_custody (id, object_id, person_id, holder_name, from_text, from_date, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          custodyId, id, personId ?? null, holderName,
          body.fromText?.trim() || null, body.fromDate || null,
          body.note?.trim() || null,
        ],
      );
      await client.query(
        `UPDATE objects
            SET held_by_person_id = $1, held_by_name = $2,
                where_kept = coalesce($3, where_kept),
                -- Handing something on means it is no longer lost.
                status = CASE WHEN status = $4 THEN $5 ELSE status END
          WHERE id = $6`,
        [personId ?? null, holderName, body.whereKept?.trim() || null, "lost", "held", id],
      );
    });

    return reply.code(201).send({ id: custodyId });
  });

  /**
   * Mark it lost, given away, or destroyed.
   *
   * Recording that nobody knows where something went is real information, and it stops the
   * same question being asked at every funeral.
   */
  app.patch("/objects/:id/status", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { id } = req.params as { id: string };
    const { status, statusNote } = (req.body ?? {}) as { status?: string; statusNote?: string };

    if (!status || !STATUSES.includes(status)) {
      return reply.code(400).send({ error: "invalid status", supported: STATUSES });
    }

    const rows = await query(
      `UPDATE objects SET status = $1, status_note = coalesce($2, status_note)
        WHERE id = $3 AND family_id = $4 AND audience = ANY($5) RETURNING id`,
      [status, statusNote?.trim() ?? null, id, caller.familyId, visibleAudiences(caller)],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "object not found" });
    return reply.send({ ok: true });
  });
}
