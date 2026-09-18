/**
 * The archive: recipes, "Who is this?" face tagging, and events.
 *
 * `savedByCurrentUser` was a boolean on the mock recipe -- which cannot be right, since
 * saving to your kitchen is one member's choice. It is a per-person row now, and this
 * route resolves it for the caller.
 */
import type { FastifyInstance } from "fastify";
import { authenticate } from "../access.ts";
import { newId, query, queryOne } from "../db.ts";
import { shapeMedia, type MediaRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

export async function archiveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/recipes", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const recipes = await query<{
      id: string; title: string; attribution: string; person_id: string | null;
      provenance: string; origin: string | null; origin_year: string | null;
      prep_text: string | null; yield_text: string | null; voice_note_label: string | null;
      ingredients: string[]; steps: string[]; tradition: string | null;
      photo_media_id: string | null; card_media_id: string | null; voice_media_id: string | null;
      saved: boolean;
    }>(
      `SELECT r.id, r.title, r.attribution, r.person_id, r.provenance, r.origin, r.origin_year,
              r.prep_text, r.yield_text, r.voice_note_label, r.ingredients, r.steps, r.tradition,
              r.photo_media_id, r.card_media_id, r.voice_media_id,
              EXISTS (SELECT 1 FROM recipe_saves s
                       WHERE s.recipe_id = r.id AND s.person_id = $2) AS saved
         FROM recipes r WHERE r.family_id = $1 ORDER BY r.created_at DESC`,
      [caller.familyId, caller.personId],
    );

    const mediaIds = recipes.flatMap((r) =>
      [r.photo_media_id, r.card_media_id, r.voice_media_id].filter(Boolean) as string[]);

    const media = mediaIds.length
      ? await query<MediaRow>(
          `SELECT id, kind, storage_key, duration_sec, transcript FROM media WHERE id = ANY($1)`,
          [mediaIds])
      : [];
    const urls = await signedGetUrls(media.map((m) => m.storage_key));
    const byId = new Map(media.map((m) => [m.id, m]));
    const uriOf = (id: string | null) => {
      const m = id ? byId.get(id) : undefined;
      return m ? urls.get(m.storage_key) : undefined;
    };

    return reply.send({
      recipes: recipes.map((r) => {
        const voice = r.voice_media_id ? byId.get(r.voice_media_id) : undefined;
        return {
          id: r.id, title: r.title, attribution: r.attribution,
          ...(r.person_id ? { personId: r.person_id } : {}),
          provenance: r.provenance,
          ...(r.origin ? { origin: r.origin } : {}),
          ...(r.origin_year ? { originYear: r.origin_year } : {}),
          ...(r.prep_text ? { prepText: r.prep_text } : {}),
          ...(r.yield_text ? { yieldText: r.yield_text } : {}),
          ...(uriOf(r.photo_media_id) ? { photoUri: uriOf(r.photo_media_id) } : {}),
          ...(uriOf(r.card_media_id) ? { cardPhotoUri: uriOf(r.card_media_id) } : {}),
          ingredients: r.ingredients, steps: r.steps,
          ...(voice ? { voiceNote: shapeMedia(voice, urls) } : {}),
          ...(r.voice_note_label ? { voiceNoteLabel: r.voice_note_label } : {}),
          ...(r.tradition ? { tradition: r.tradition } : {}),
          savedByCurrentUser: r.saved,
        };
      }),
    });
  });

  /**
   * Add a recipe.
   *
   * The most-requested heirloom there is, and previously impossible: the Archive tab's
   * "add" button opened the Great Deed wizard, and there was no POST route at all.
   *
   * `card_media_id` is the photograph of the handwritten card, and it has its own column
   * rather than being one photo among many because it is the PRIMARY SOURCE -- it is in
   * her handwriting, and that matters as much as the typed version.
   */
  app.post("/recipes", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      title?: string; attribution?: string; personId?: string; provenance?: string;
      origin?: string; originYear?: string; prepText?: string; yieldText?: string;
      ingredients?: string[]; steps?: string[]; tradition?: string;
      photoMediaId?: string; cardMediaId?: string; voiceMediaId?: string;
    };

    const title = body.title?.trim();
    if (!title) return reply.code(400).send({ error: "title is required" });

    /**
     * Attribution is required, because "whose recipe it is" is the entire point -- an
     * unattributed recipe is a cooking instruction, not an heirloom. It falls back to the
     * person chosen rather than erroring, so the requirement never blocks the save.
     */
    let attribution = body.attribution?.trim();
    if (!attribution && body.personId) {
      const p = await queryOne<{ name: string }>(
        `SELECT name FROM people WHERE id = $1 AND family_id = $2`,
        [body.personId, caller.familyId]);
      attribution = p?.name;
    }
    if (!attribution) return reply.code(400).send({ error: "attribution is required" });

    // Media and person must belong to this family, or a request could attach another
    // family's photograph to this recipe.
    const ownMedia = async (id?: string) => {
      if (!id) return null;
      const m = await queryOne(
        `SELECT 1 FROM media WHERE id = $1 AND family_id = $2`, [id, caller.familyId]);
      return m ? id : null;
    };
    const ownPerson = body.personId
      ? (await queryOne(`SELECT 1 FROM people WHERE id = $1 AND family_id = $2`,
          [body.personId, caller.familyId])) ? body.personId : null
      : null;

    const recipeId = newId("r");
    await query(
      `INSERT INTO recipes (id, family_id, title, attribution, person_id, provenance,
                            origin, origin_year, prep_text, yield_text,
                            photo_media_id, card_media_id, voice_media_id,
                            ingredients, steps, tradition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        recipeId, caller.familyId, title, attribution, ownPerson,
        body.provenance?.trim() ?? "",
        body.origin?.trim() || null, body.originYear?.trim() || null,
        body.prepText?.trim() || null, body.yieldText?.trim() || null,
        await ownMedia(body.photoMediaId), await ownMedia(body.cardMediaId),
        await ownMedia(body.voiceMediaId),
        (body.ingredients ?? []).map((s) => s.trim()).filter(Boolean),
        (body.steps ?? []).map((s) => s.trim()).filter(Boolean),
        body.tradition?.trim() || null,
      ],
    );

    return reply.code(201).send({ id: recipeId });
  });

  app.post("/recipes/:id/save", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });
    const { id } = req.params as { id: string };

    const exists = await query(
      `SELECT 1 FROM recipes WHERE id = $1 AND family_id = $2`, [id, caller.familyId]);
    if (exists.length === 0) return reply.code(404).send({ error: "recipe not found" });

    // Toggle, so a double tap cannot produce two saves.
    const deleted = await query(
      `DELETE FROM recipe_saves WHERE recipe_id = $1 AND person_id = $2 RETURNING 1`,
      [id, caller.personId]);
    if (deleted.length === 0) {
      await query(
        `INSERT INTO recipe_saves (recipe_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, caller.personId]);
    }
    return reply.send({ saved: deleted.length === 0 });
  });

  app.get("/archive/photos", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const photos = await query<{
      id: string; media_id: string | null; provenance: string; question: string;
      detail: string | null; asking_names: string[];
    }>(
      `SELECT id, media_id, provenance, question, detail, asking_names
         FROM archive_photos WHERE family_id = $1 ORDER BY created_at DESC`,
      [caller.familyId],
    );
    if (photos.length === 0) return reply.send({ photos: [] });

    const ids = photos.map((p) => p.id);
    const [media, faces, clues] = await Promise.all([
      query<MediaRow>(
        `SELECT id, kind, storage_key, duration_sec, transcript FROM media WHERE id = ANY($1)`,
        [photos.map((p) => p.media_id).filter(Boolean)]),
      query<{ id: string; photo_id: string; x: number; y: number; name: string | null; guess: string | null }>(
        `SELECT id, photo_id, x, y, name, guess FROM face_tags WHERE photo_id = ANY($1)`, [ids]),
      query<{ photo_id: string; author_name: string; body: string; created_at: Date }>(
        `SELECT photo_id, author_name, body, created_at FROM photo_clues
           WHERE photo_id = ANY($1) ORDER BY created_at DESC`, [ids]),
    ]);

    const urls = await signedGetUrls(media.map((m) => m.storage_key));
    const mediaById = new Map(media.map((m) => [m.id, m]));

    const facesByPhoto = new Map<string, typeof faces>();
    for (const f of faces) facesByPhoto.set(f.photo_id, [...(facesByPhoto.get(f.photo_id) ?? []), f]);
    const cluesByPhoto = new Map<string, typeof clues>();
    for (const c of clues) cluesByPhoto.set(c.photo_id, [...(cluesByPhoto.get(c.photo_id) ?? []), c]);

    return reply.send({
      photos: photos.map((p) => {
        const m = p.media_id ? mediaById.get(p.media_id) : undefined;
        return {
          id: p.id,
          uri: m ? urls.get(m.storage_key) ?? "" : "",
          provenance: p.provenance, question: p.question,
          ...(p.detail ? { detail: p.detail } : {}),
          askingNames: p.asking_names,
          faces: (facesByPhoto.get(p.id) ?? []).map((f) => ({
            id: f.id, x: f.x, y: f.y,
            ...(f.name ? { name: f.name } : {}),
            ...(f.guess ? { guess: f.guess } : {}),
          })),
          clues: (cluesByPhoto.get(p.id) ?? []).map((c) => ({
            authorName: c.author_name, body: c.body,
            // Relative time is a presentation concern, but the client's type expects a
            // string here; the server sends the ISO value and the UI formats it.
            whenText: c.created_at.toISOString(),
          })),
        };
      }),
    });
  });

  /**
   * Confirm a face. The payoff of the whole "race against time" feature: the guess is
   * cleared at the same moment, because a confirmed name supersedes it.
   */
  app.post("/archive/faces/:id/name", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name?.trim()) return reply.code(400).send({ error: "name is required" });

    const rows = await query(
      `UPDATE face_tags SET name = $1, guess = NULL
         WHERE id = $2 AND photo_id IN (SELECT id FROM archive_photos WHERE family_id = $3)
       RETURNING id`,
      [name.trim(), id, caller.familyId],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "face not found" });
    return reply.send({ ok: true });
  });

  app.post("/archive/photos/:id/clues", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };
    const { body } = (req.body ?? {}) as { body?: string };
    if (!body?.trim()) return reply.code(400).send({ error: "body is required" });

    const exists = await query(
      `SELECT 1 FROM archive_photos WHERE id = $1 AND family_id = $2`, [id, caller.familyId]);
    if (exists.length === 0) return reply.code(404).send({ error: "photo not found" });

    const me = await query<{ name: string }>(`SELECT name FROM people WHERE id = $1`, [caller.personId]);
    const clueId = newId("clue");
    await query(
      `INSERT INTO photo_clues (id, photo_id, author_name, body) VALUES ($1, $2, $3, $4)`,
      [clueId, id, me[0]?.name ?? "A family member", body.trim()],
    );
    return reply.code(201).send({ id: clueId });
  });

  /** Events, with RSVPs and claimable potluck items. */
  app.get("/events", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const events = await query<{
      id: string; kind: string; title: string; date: string;
      location: string | null; note: string | null;
    }>(
      `SELECT id, kind, title, date, location, note FROM events
         WHERE family_id = $1 ORDER BY date`,
      [caller.familyId],
    );
    if (events.length === 0) return reply.send({ events: [] });

    const ids = events.map((e) => e.id);
    const [people, rsvps, potluck] = await Promise.all([
      query<{ event_id: string; person_id: string }>(
        `SELECT event_id, person_id FROM event_people WHERE event_id = ANY($1)`, [ids]),
      query<{ event_id: string; person_id: string }>(
        `SELECT event_id, person_id FROM event_rsvps WHERE event_id = ANY($1) AND attending`, [ids]),
      query<{ id: string; event_id: string; item: string; claimed_by_name: string | null }>(
        `SELECT id, event_id, item, claimed_by_name FROM potluck_items WHERE event_id = ANY($1)`, [ids]),
    ]);

    const group = <T,>(rows: T[], key: (r: T) => string) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
      return m;
    };
    const peopleBy = group(people, (r) => r.event_id);
    const rsvpBy = group(rsvps, (r) => r.event_id);
    const potluckBy = group(potluck, (r) => r.event_id);

    return reply.send({
      events: events.map((e) => ({
        id: e.id, kind: e.kind, title: e.title, date: e.date,
        personIds: (peopleBy.get(e.id) ?? []).map((r) => r.person_id),
        ...(e.location ? { location: e.location } : {}),
        ...(e.note ? { note: e.note } : {}),
        rsvpYes: (rsvpBy.get(e.id) ?? []).map((r) => r.person_id),
        ...(potluckBy.has(e.id) ? {
          potluck: (potluckBy.get(e.id) ?? []).map((p) => ({
            id: p.id, item: p.item,
            ...(p.claimed_by_name ? { claimedByName: p.claimed_by_name } : {}),
          })),
        } : {}),
      })),
    });
  });

  app.post("/events/:id/rsvp", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });
    const { id } = req.params as { id: string };

    const exists = await query(
      `SELECT 1 FROM events WHERE id = $1 AND family_id = $2`, [id, caller.familyId]);
    if (exists.length === 0) return reply.code(404).send({ error: "event not found" });

    const deleted = await query(
      `DELETE FROM event_rsvps WHERE event_id = $1 AND person_id = $2 RETURNING 1`,
      [id, caller.personId]);
    if (deleted.length === 0) {
      await query(
        `INSERT INTO event_rsvps (event_id, person_id, attending) VALUES ($1, $2, true)
         ON CONFLICT DO NOTHING`, [id, caller.personId]);
    }
    return reply.send({ attending: deleted.length === 0 });
  });

  app.post("/events/:eventId/potluck/:itemId/claim", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { eventId, itemId } = req.params as { eventId: string; itemId: string };

    const me = await query<{ name: string }>(`SELECT name FROM people WHERE id = $1`, [caller.personId]);
    const rows = await query(
      `UPDATE potluck_items SET claimed_by_name = $1
         WHERE id = $2 AND event_id = $3
           AND event_id IN (SELECT id FROM events WHERE family_id = $4)
       RETURNING id`,
      [me[0]?.name ?? "A family member", itemId, eventId, caller.familyId],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "item not found" });
    return reply.send({ ok: true });
  });

  /** "Thinking of you" -- one tap, zero composition cost. */
  app.post("/nudges", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });

    const { personId, action } = (req.body ?? {}) as { personId?: string; action?: string };
    if (!personId) return reply.code(400).send({ error: "personId is required" });

    // Never to a memorialised person: that is the wound bereavement mode exists to
    // prevent, and it must be refused by the server, not merely hidden by the client.
    const target = await query<{ memorialised: boolean }>(
      `SELECT memorialised FROM people WHERE id = $1 AND family_id = $2`,
      [personId, caller.familyId]);
    if (target.length === 0) return reply.code(404).send({ error: "person not found" });
    if (target[0].memorialised) {
      return reply.code(409).send({ error: "this person has been memorialised" });
    }

    const nudgeId = newId("n");
    await query(
      `INSERT INTO nudges (id, family_id, from_person_id, to_person_id, action)
       VALUES ($1, $2, $3, $4, $5)`,
      [nudgeId, caller.familyId, caller.personId, personId, action ?? "Thinking of you"],
    );
    return reply.code(201).send({ id: nudgeId });
  });
}
