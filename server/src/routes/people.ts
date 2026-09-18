/**
 * People: the family graph.
 *
 * Relationship edges are stored once and directed ('A is parent of B'), but the
 * client wants each person to carry parentIds and spouseIds. Rather than issue a
 * query per person -- the classic N+1 that turns a 40-person tree into 81 round
 * trips -- this fetches all people and all edges for the family and stitches them
 * in memory. A family graph is small by nature; this is always two queries.
 */
import type { FastifyInstance } from "fastify";
import { authenticate } from "../access.ts";
import { newId, query, transaction } from "../db.ts";
import { shapePerson, type PersonRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

export async function peopleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/people", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const [people, edges] = await Promise.all([
      query<PersonRow>(
        `SELECT id, name, birth_date, death_date, photo_key, bio, is_living, location, memorialised
           FROM people WHERE family_id = $1 ORDER BY birth_date NULLS LAST, name`,
        [caller.familyId],
      ),
      query<{ from_person_id: string; to_person_id: string; kind: string }>(
        `SELECT from_person_id, to_person_id, kind FROM relationships WHERE family_id = $1`,
        [caller.familyId],
      ),
    ]);

    const parents = new Map<string, string[]>();
    const spouses = new Map<string, string[]>();
    for (const e of edges) {
      if (e.kind === "parent") {
        // Edge direction is parent -> child, so the CHILD gains a parentId.
        parents.set(e.to_person_id, [...(parents.get(e.to_person_id) ?? []), e.from_person_id]);
      } else {
        // Marriage is symmetric but stored once, so both ends are filled in here.
        spouses.set(e.from_person_id, [...(spouses.get(e.from_person_id) ?? []), e.to_person_id]);
        spouses.set(e.to_person_id, [...(spouses.get(e.to_person_id) ?? []), e.from_person_id]);
      }
    }

    const urls = await signedGetUrls(people.map((p) => p.photo_key));

    return reply.send({
      people: people.map((p) =>
        shapePerson(p, urls, {
          parentIds: parents.get(p.id) ?? [],
          spouseIds: spouses.get(p.id) ?? [],
        }),
      ),
    });
  });

  app.post("/people", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      name?: string; birthDate?: string; deathDate?: string; bio?: string;
      location?: string; isLiving?: boolean; parentIds?: string[]; spouseIds?: string[];
    };
    const name = body.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });

    const personId = newId("p");

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO people (id, family_id, name, birth_date, death_date, bio, location, is_living)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          personId, caller.familyId, name,
          body.birthDate ?? null, body.deathDate ?? null,
          body.bio ?? null, body.location ?? null,
          body.isLiving ?? true,
        ],
      );

      /**
       * Edges are inserted only for people who are in the CALLER'S family. Without
       * that check, a crafted request could attach a stranger's person row to this
       * tree and thereby learn their name through the /people response.
       */
      for (const parentId of body.parentIds ?? []) {
        await client.query(
          `INSERT INTO relationships (family_id, from_person_id, to_person_id, kind)
           SELECT $1, $2, $3, 'parent'
            WHERE EXISTS (SELECT 1 FROM people WHERE id = $2 AND family_id = $1)
           ON CONFLICT DO NOTHING`,
          [caller.familyId, parentId, personId],
        );
      }
      for (const spouseId of body.spouseIds ?? []) {
        await client.query(
          `INSERT INTO relationships (family_id, from_person_id, to_person_id, kind)
           SELECT $1, $2, $3, 'spouse'
            WHERE EXISTS (SELECT 1 FROM people WHERE id = $2 AND family_id = $1)
           ON CONFLICT DO NOTHING`,
          [caller.familyId, spouseId, personId],
        );
      }
    });

    return reply.code(201).send({ id: personId });
  });

  /**
   * Bereavement mode.
   *
   * Freezing the profile is only half the job. The other half -- and the reason this
   * is a dedicated endpoint rather than a PATCH of `memorialised` -- is that every
   * automated prompt about this person must stop in the same transaction. An
   * automated birthday reminder for someone who died last month is the wound that
   * makes a family delete the app and tell everyone why.
   */
  app.post("/people/:id/memorialise", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const { id } = req.params as { id: string };

    const affected = await transaction(async (client) => {
      const res = await client.query(
        `UPDATE people SET memorialised = true, is_living = false
           WHERE id = $1 AND family_id = $2`,
        [id, caller.familyId],
      );
      if (res.rowCount === 0) return 0;

      // Auto-derived birthdays/anniversaries are generated from the tree at read
      // time, and the read query excludes memorialised people. Hand-written events
      // about them are removed here so nothing resurfaces.
      await client.query(
        `DELETE FROM events WHERE family_id = $1 AND kind IN ('birthday', 'anniversary')
           AND id IN (SELECT event_id FROM event_people WHERE person_id = $2)`,
        [caller.familyId, id],
      );
      // Pending nudges are prompts too: "Send Tea to Nana" must not appear again.
      await client.query(`DELETE FROM nudges WHERE to_person_id = $1`, [id]);
      return res.rowCount;
    });

    if (affected === 0) return reply.code(404).send({ error: "person not found" });
    return reply.send({ ok: true });
  });
}
