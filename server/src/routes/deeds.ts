/**
 * Deeds: the permanent archive (Speed 2).
 *
 * This is the file where audience filtering stops being a client concern. Every
 * read is constrained by BOTH family_id and an audience list derived from the
 * caller's role, in SQL. A child account cannot receive an 'adults' deed even if it
 * asks for one by id.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, visibleAudiences } from "../access.ts";
import { newId, query, transaction } from "../db.ts";
import {
  emptyReactions, shapeDeed, shapeMedia,
  type DeedRow, type MediaRow,
} from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

/**
 * Load the many-to-many parts of a set of deeds in four queries rather than four
 * per deed. The feed shows ~30 deeds; the N+1 version is 120 round trips.
 */
async function loadDeedParts(deedIds: string[]) {
  if (deedIds.length === 0) {
    return { people: new Map(), tags: new Map(), media: new Map(), reactions: new Map() };
  }

  const [peopleRows, tagRows, mediaRows, reactionRows] = await Promise.all([
    query<{ deed_id: string; person_id: string }>(
      `SELECT deed_id, person_id FROM deed_people WHERE deed_id = ANY($1)`, [deedIds]),
    query<{ deed_id: string; tag: string }>(
      `SELECT deed_id, tag FROM deed_tags WHERE deed_id = ANY($1)`, [deedIds]),
    query<MediaRow & { deed_id: string }>(
      `SELECT dm.deed_id, m.id, m.kind, m.storage_key, m.duration_sec, m.transcript
         FROM deed_media dm JOIN media m ON m.id = dm.media_id
        WHERE dm.deed_id = ANY($1) ORDER BY dm.position`, [deedIds]),
    query<{ deed_id: string; person_id: string; kind: string }>(
      `SELECT deed_id, person_id, kind FROM deed_reactions WHERE deed_id = ANY($1)`, [deedIds]),
  ]);

  // One signing pass for every image across the whole page.
  const urls = await signedGetUrls(mediaRows.map((m) => m.storage_key));

  const group = <T, V>(rows: T[], key: (r: T) => string, val: (r: T) => V) => {
    const map = new Map<string, V[]>();
    for (const r of rows) {
      const k = key(r);
      map.set(k, [...(map.get(k) ?? []), val(r)]);
    }
    return map;
  };

  const reactions = new Map<string, Record<string, string[]>>();
  for (const r of reactionRows) {
    const current = reactions.get(r.deed_id) ?? emptyReactions();
    current[r.kind] = [...(current[r.kind] ?? []), r.person_id];
    reactions.set(r.deed_id, current);
  }

  return {
    people: group(peopleRows, (r) => r.deed_id, (r) => r.person_id),
    tags: group(tagRows, (r) => r.deed_id, (r) => r.tag),
    media: group(mediaRows, (r) => r.deed_id, (r) => shapeMedia(r, urls)),
    reactions,
  };
}

/** Kept in step with the memory_kind domain in migration 002. */
const KINDS = ["greatDeed", "memory", "milestone", "hardTime", "inMemory", "lore"];

/** Kinds never resurfaced unprompted by On This Day. */
const NO_RESURFACE = ["hardTime", "inMemory"];

/** Reaction kinds each memory kind allows. Mirrors REACTIONS_FOR_KIND in src/types.ts. */
const REACTIONS_FOR_KIND: Record<string, string[]> = {
  greatDeed: ["applaud", "inspire", "cherish", "love"],
  memory: ["cherish", "love", "laugh"],
  milestone: ["applaud", "cherish", "love"],
  hardTime: ["hold", "strength", "love"],
  inMemory: ["cherish", "love", "hold"],
  lore: ["laugh", "cherish", "love"],
};

export async function deedRoutes(app: FastifyInstance): Promise<void> {
  app.get("/deeds", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { personId, limit } = req.query as { personId?: string; limit?: string };

    /**
     * The audience predicate is not optional and not appendable by the caller. It is
     * built from the verified role, and `personId` only ever narrows the result --
     * it can never widen it past this filter.
     */
    const params: unknown[] = [caller.familyId, visibleAudiences(caller)];
    let sql = `SELECT d.id, d.kind, d.may_resurface, d.title, d.when_text, d.when_date,
                      d.story, d.author_id, d.author_name, d.audience, d.flagged,
                      d.from_message_id, d.created_at
                 FROM deeds d
                WHERE d.family_id = $1 AND d.audience = ANY($2)`;

    if (personId) {
      params.push(personId);
      sql += ` AND EXISTS (SELECT 1 FROM deed_people dp
                            WHERE dp.deed_id = d.id AND dp.person_id = $${params.length})`;
    }

    params.push(Math.min(Number(limit) || 100, 200));
    sql += ` ORDER BY d.created_at DESC LIMIT $${params.length}`;

    const deeds = await query<DeedRow>(sql, params);
    const parts = await loadDeedParts(deeds.map((d) => d.id));

    return reply.send({
      deeds: deeds.map((d) =>
        shapeDeed(d, {
          personIds: parts.people.get(d.id) ?? [],
          tags: parts.tags.get(d.id) ?? [],
          media: parts.media.get(d.id) ?? [],
          reactions: parts.reactions.get(d.id) ?? emptyReactions(),
        }),
      ),
    });
  });

  app.get("/deeds/:id", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };

    const rows = await query<DeedRow>(
      `SELECT id, kind, may_resurface, title, when_text, when_date, story, author_id,
              author_name, audience, flagged, from_message_id, created_at
         FROM deeds WHERE id = $1 AND family_id = $2 AND audience = ANY($3)`,
      [id, caller.familyId, visibleAudiences(caller)],
    );
    // 404 rather than 403 for an audience miss: telling a child account that an
    // adults-only story exists is itself a leak.
    if (rows.length === 0) return reply.code(404).send({ error: "deed not found" });

    const parts = await loadDeedParts([id]);
    const [comments] = await Promise.all([
      query<{ id: string; author_id: string | null; author_name: string; body: string; parent_id: string | null; created_at: Date }>(
        `SELECT id, author_id, author_name, body, parent_id, created_at
           FROM comments WHERE deed_id = $1 ORDER BY created_at`, [id]),
    ]);

    return reply.send({
      deed: shapeDeed(rows[0], {
        personIds: parts.people.get(id) ?? [],
        tags: parts.tags.get(id) ?? [],
        media: parts.media.get(id) ?? [],
        reactions: parts.reactions.get(id) ?? emptyReactions(),
      }),
      comments: comments.map((c) => ({
        id: c.id, deedId: id,
        authorId: c.author_id ?? "", authorName: c.author_name,
        body: c.body, createdAt: c.created_at.toISOString(),
        ...(c.parent_id ? { parentId: c.parent_id } : {}),
      })),
    });
  });

  app.post("/deeds", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      kind?: string;
      title?: string; whenText?: string; whenDate?: string; story?: string;
      personIds?: string[]; tags?: string[]; mediaIds?: string[];
      audience?: string; fromMessageId?: string; mayResurface?: boolean;
    };

    const title = body.title?.trim();
    if (!title) return reply.code(400).send({ error: "title is required" });

    /**
     * Register. Defaults to 'memory', not 'greatDeed': the commonest thing a family has
     * to say is "I remember this", and defaulting to an achievement is what made the
     * archive a highlight reel.
     */
    const kind = body.kind ?? "memory";
    if (!KINDS.includes(kind)) {
      return reply.code(400).send({ error: `invalid kind '${kind}'`, supported: KINDS });
    }

    /**
     * Audience default depends on the kind. A hard time is adults-only unless the author
     * says otherwise: illness and money are not a nine-year-old's business, and making
     * the safe choice the default matters more than making it configurable.
     */
    const audience = body.audience ?? (kind === "hardTime" ? "adults" : "everyone");
    if (!["everyone", "adults", "care", "branch"].includes(audience)) {
      return reply.code(400).send({ error: "invalid audience" });
    }

    /**
     * Resurfacing. Grief is never resurfaced unprompted -- ideas.md calls an automated
     * reminder about a death unforgivable, and an anniversary of a miscarriage is the same
     * error. The author may override, because "the year we nearly lost Dad, and didn't" is
     * sometimes exactly what somebody wants to see come round again.
     */
    const mayResurface = body.mayResurface ?? !NO_RESURFACE.includes(kind);

    const deedId = newId("d");

    await transaction(async (client) => {
      // author_name is denormalised so the byline survives the person row being
      // removed later -- attribution is the point of the archive.
      const author = await client.query<{ name: string }>(
        `SELECT name FROM people WHERE id = $1 AND family_id = $2`,
        [caller.personId, caller.familyId],
      );

      await client.query(
        `INSERT INTO deeds (id, family_id, kind, title, when_text, when_date, story,
                             author_id, author_name, audience, from_message_id, may_resurface)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          deedId, caller.familyId, kind, title,
          // Lore and memories often have no meaningful date, and demanding one is what
          // stops them being written. "Undated" is an honest label, not a placeholder.
          body.whenText?.trim() || "Undated",
          body.whenDate || null,
          body.story ?? "",
          caller.personId,
          author.rows[0]?.name ?? "A family member",
          audience,
          body.fromMessageId ?? null,
          mayResurface,
        ],
      );

      // Every child row is filtered through the caller's family, so a request
      // cannot attach another family's person or media to this deed.
      for (const personId of body.personIds ?? []) {
        await client.query(
          `INSERT INTO deed_people (deed_id, person_id)
           SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM people WHERE id = $2 AND family_id = $3)
           ON CONFLICT DO NOTHING`,
          [deedId, personId, caller.familyId],
        );
      }
      for (const tag of body.tags ?? []) {
        await client.query(
          `INSERT INTO deed_tags (deed_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [deedId, tag],
        );
      }
      let position = 0;
      for (const mediaId of body.mediaIds ?? []) {
        await client.query(
          `INSERT INTO deed_media (deed_id, media_id, position)
           SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM media WHERE id = $2 AND family_id = $4)
           ON CONFLICT DO NOTHING`,
          [deedId, mediaId, position++, caller.familyId],
        );
      }

      // Close the loop on a promoted chat message so the client stops offering to
      // promote it a second time.
      if (body.fromMessageId) {
        await client.query(
          `UPDATE messages SET promoted_to_deed_id = $1 WHERE id = $2 AND family_id = $3`,
          [deedId, body.fromMessageId, caller.familyId],
        );
      }
    });

    return reply.code(201).send({ id: deedId });
  });

  /**
   * Toggle a reaction. The (deed, person, kind) primary key makes this idempotent,
   * so a double tap cannot produce two applauds.
   */
  app.post("/deeds/:id/reactions", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });

    const { id } = req.params as { id: string };
    const { kind } = (req.body ?? {}) as { kind?: string };

    // Reacting requires the deed to be visible to this caller, same predicate as
    // reading it -- otherwise a child could probe for adults-only deeds by id.
    const visible = await query<{ kind: string }>(
      `SELECT kind FROM deeds WHERE id = $1 AND family_id = $2 AND audience = ANY($3)`,
      [id, caller.familyId, visibleAudiences(caller)],
    );
    if (visible.length === 0) return reply.code(404).send({ error: "deed not found" });

    /**
     * THE REACTION MUST BE ONE THIS KIND ALLOWS -- enforced here, not just in the UI.
     *
     * The client only renders the permitted set, but the client is not a security or
     * decency boundary. Without this check anybody could POST {"kind":"applaud"} to a
     * bereavement, and it would be stored and shown to the family forever. The whole
     * point of the taxonomy is that a hard time cannot be applauded.
     */
    const allowed = REACTIONS_FOR_KIND[visible[0].kind] ?? REACTIONS_FOR_KIND.memory;
    if (!kind || !allowed.includes(kind)) {
      return reply.code(422).send({
        error: `'${kind}' is not an appropriate reaction for a '${visible[0].kind}' entry`,
        allowed,
      });
    }

    const deleted = await query(
      `DELETE FROM deed_reactions WHERE deed_id = $1 AND person_id = $2 AND kind = $3 RETURNING 1`,
      [id, caller.personId, kind],
    );
    if (deleted.length === 0) {
      await query(
        `INSERT INTO deed_reactions (deed_id, person_id, kind) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [id, caller.personId, kind],
      );
    }

    return reply.send({ reacted: deleted.length === 0 });
  });

  app.post("/deeds/:id/comments", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { id } = req.params as { id: string };
    const { body: text, parentId } = (req.body ?? {}) as { body?: string; parentId?: string };
    if (!text?.trim()) return reply.code(400).send({ error: "comment body is required" });

    const visible = await query(
      `SELECT 1 FROM deeds WHERE id = $1 AND family_id = $2 AND audience = ANY($3)`,
      [id, caller.familyId, visibleAudiences(caller)],
    );
    if (visible.length === 0) return reply.code(404).send({ error: "deed not found" });

    const author = await query<{ name: string }>(
      `SELECT name FROM people WHERE id = $1`, [caller.personId],
    );

    const commentId = newId("c");
    await query(
      `INSERT INTO comments (id, deed_id, family_id, author_id, author_name, body, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        commentId, id, caller.familyId, caller.personId,
        author[0]?.name ?? "A family member", text.trim(), parentId ?? null,
      ],
    );

    return reply.code(201).send({ id: commentId });
  });

  /**
   * Private flag for admin review. There is deliberately no public "reported" badge
   * -- see docs/great_deeds_strategy.md section 4. A family shaming itself in public
   * is how a family app dies.
   */
  app.post("/deeds/:id/flag", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };

    const rows = await query(
      `UPDATE deeds SET flagged = true WHERE id = $1 AND family_id = $2 RETURNING id`,
      [id, caller.familyId],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "deed not found" });
    return reply.send({ ok: true });
  });
}
