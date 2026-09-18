/**
 * Care coordination.
 *
 * Care data is the most sensitive material in the product -- medication, clinicians,
 * an emergency card -- so it is scoped twice: to the family, and to the care circle's
 * own member list. Being in the family is not enough.
 *
 * The emergency card is additionally adults-only by route, not by data: there is no
 * legitimate audience value other than "adults", so leaving it as a column somebody
 * could set wrongly would be a mistake waiting to happen.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, requireAdult } from "../access.ts";
import { newId, query } from "../db.ts";

/** Circles this caller may see. Used by every route in this file. */
async function visibleCircleIds(familyId: string, personId: string | null): Promise<string[]> {
  if (!personId) return [];
  const rows = await query<{ id: string }>(
    `SELECT c.id FROM care_circles c
       WHERE c.family_id = $1
         AND EXISTS (SELECT 1 FROM care_circle_members m
                      WHERE m.circle_id = c.id AND m.person_id = $2)`,
    [familyId, personId],
  );
  return rows.map((r) => r.id);
}

export async function careRoutes(app: FastifyInstance): Promise<void> {
  /** Everything the Care tab needs, in one round trip. */
  app.get("/care", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const circleIds = await visibleCircleIds(caller.familyId, caller.personId);

    // A family with no care circle is the normal starting state, not an error.
    if (circleIds.length === 0) {
      return reply.send({
        circles: [], tasks: [], medications: [], mealSlots: [],
        doctorNotes: [], emergencyCards: [],
      });
    }

    const isChild = caller.role === "child";

    const [circles, tasks, medications, mealSlots, doctorNotes, cards] = await Promise.all([
      query<{
        id: string; person_id: string; status: string; mood: string | null;
        recovery_week: number | null; dietary_note: string | null; member_ids: string[];
      }>(
        `SELECT c.id, c.person_id, c.status, c.mood, c.recovery_week, c.dietary_note,
                coalesce(array_agg(m.person_id) FILTER (WHERE m.person_id IS NOT NULL), '{}') AS member_ids
           FROM care_circles c
           LEFT JOIN care_circle_members m ON m.circle_id = c.id
          WHERE c.id = ANY($1) GROUP BY c.id`, [circleIds]),

      query<{
        id: string; circle_id: string; kind: string; title: string; time_text: string;
        date: string; detail: string | null; done: boolean; claimed_by_id: string | null;
        claimed_by_name: string | null; result: string | null; urgent: boolean;
      }>(
        `SELECT id, circle_id, kind, title, time_text, date, detail, done,
                claimed_by_id, claimed_by_name, result, urgent
           FROM care_tasks WHERE circle_id = ANY($1) ORDER BY date, time_text`, [circleIds]),

      // Medication detail is health information: withheld from child accounts.
      isChild ? Promise.resolve([]) : query<{
        id: string; circle_id: string; name: string; dose: string; schedule: string;
        days_left: number; pharmacy: string | null; pickup_by_name: string | null;
      }>(
        `SELECT id, circle_id, name, dose, schedule, days_left, pharmacy, pickup_by_name
           FROM medications WHERE circle_id = ANY($1) ORDER BY days_left`, [circleIds]),

      query<{
        id: string; circle_id: string; date: string; day_label: string; date_label: string;
        title: string | null; detail: string | null; claimed_by_name: string | null;
      }>(
        `SELECT id, circle_id, date, day_label, date_label, title, detail, claimed_by_name
           FROM meal_slots WHERE circle_id = ANY($1) ORDER BY date`, [circleIds]),

      isChild ? Promise.resolve([]) : query<{
        id: string; circle_id: string; clinician: string; summary: string;
        recorded_by_name: string; validated: boolean; created_at: Date;
      }>(
        `SELECT id, circle_id, clinician, summary, recorded_by_name, validated, created_at
           FROM doctor_notes WHERE circle_id = ANY($1) ORDER BY created_at DESC`, [circleIds]),

      isChild ? Promise.resolve([]) : query<{
        person_id: string; blood_type: string | null; allergies: string[];
        conditions: string[]; medications: string[]; clinicians: unknown;
        contacts: unknown; power_of_attorney: string | null;
      }>(
        `SELECT person_id, blood_type, allergies, conditions, medications,
                clinicians, contacts, power_of_attorney
           FROM emergency_cards
          WHERE person_id IN (SELECT person_id FROM care_circles WHERE id = ANY($1))`, [circleIds]),
    ]);

    return reply.send({
      circles: circles.map((c) => ({
        id: c.id, personId: c.person_id, status: c.status,
        ...(c.mood ? { mood: c.mood } : {}),
        memberIds: c.member_ids,
        ...(c.recovery_week !== null ? { recoveryWeek: c.recovery_week } : {}),
        ...(c.dietary_note ? { dietaryNote: c.dietary_note } : {}),
      })),
      tasks: tasks.map((t) => ({
        id: t.id, circleId: t.circle_id, kind: t.kind, title: t.title,
        timeText: t.time_text, date: t.date, done: t.done, urgent: t.urgent,
        ...(t.detail ? { detail: t.detail } : {}),
        ...(t.claimed_by_id ? { claimedById: t.claimed_by_id } : {}),
        ...(t.claimed_by_name ? { claimedByName: t.claimed_by_name } : {}),
        ...(t.result ? { result: t.result } : {}),
      })),
      medications: medications.map((m) => ({
        id: m.id, circleId: m.circle_id, name: m.name, dose: m.dose,
        schedule: m.schedule, daysLeft: m.days_left,
        ...(m.pharmacy ? { pharmacy: m.pharmacy } : {}),
        ...(m.pickup_by_name ? { pickupByName: m.pickup_by_name } : {}),
      })),
      mealSlots: mealSlots.map((s) => ({
        id: s.id, circleId: s.circle_id, date: s.date,
        dayLabel: s.day_label, dateLabel: s.date_label,
        ...(s.title ? { title: s.title } : {}),
        ...(s.detail ? { detail: s.detail } : {}),
        ...(s.claimed_by_name ? { claimedByName: s.claimed_by_name } : {}),
      })),
      doctorNotes: doctorNotes.map((n) => ({
        id: n.id, circleId: n.circle_id, clinician: n.clinician, summary: n.summary,
        recordedByName: n.recorded_by_name, validated: n.validated,
        createdAt: n.created_at.toISOString(),
      })),
      emergencyCards: cards.map((c) => ({
        personId: c.person_id,
        ...(c.blood_type ? { bloodType: c.blood_type } : {}),
        allergies: c.allergies, conditions: c.conditions, medications: c.medications,
        clinicians: c.clinicians as { role: string; name: string; phone: string }[],
        contacts: c.contacts as { relation: string; name: string; phone: string }[],
        ...(c.power_of_attorney ? { powerOfAttorney: c.power_of_attorney } : {}),
      })),
    });
  });

  /** Start a care circle for a relative. The Care tab's setup step. */
  app.post("/care/circles", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!(await requireAdult(caller, reply))) return;

    const body = (req.body ?? {}) as { personId?: string; status?: string; memberIds?: string[] };
    if (!body.personId) return reply.code(400).send({ error: "personId is required" });

    const person = await query(
      `SELECT 1 FROM people WHERE id = $1 AND family_id = $2`, [body.personId, caller.familyId]);
    if (person.length === 0) return reply.code(404).send({ error: "person not found" });

    const circleId = newId("cc");
    await query(
      `INSERT INTO care_circles (id, family_id, person_id, status) VALUES ($1, $2, $3, $4)`,
      [circleId, caller.familyId, body.personId, body.status ?? ""],
    );

    // The creator is always a member, or they would immediately lose sight of the
    // circle they just made.
    const members = new Set([caller.personId, ...(body.memberIds ?? [])].filter(Boolean) as string[]);
    for (const personId of members) {
      await query(
        `INSERT INTO care_circle_members (circle_id, person_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM people WHERE id = $2 AND family_id = $3)
         ON CONFLICT DO NOTHING`,
        [circleId, personId, caller.familyId],
      );
    }

    return reply.code(201).send({ id: circleId });
  });

  /**
   * Claim a task. The most important write in the Care tab: an unclaimed slot is the
   * loudest thing on the screen because the failure mode of family care is diffusion
   * of responsibility, not disagreement.
   */
  app.post("/care/tasks/:id/claim", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!caller.personId) return reply.code(403).send({ error: "account is not linked to a person" });

    const { id } = req.params as { id: string };
    const circleIds = await visibleCircleIds(caller.familyId, caller.personId);
    if (circleIds.length === 0) return reply.code(404).send({ error: "task not found" });

    const me = await query<{ name: string }>(`SELECT name FROM people WHERE id = $1`, [caller.personId]);

    const rows = await query(
      `UPDATE care_tasks SET claimed_by_id = $1, claimed_by_name = $2
         WHERE id = $3 AND circle_id = ANY($4) RETURNING id`,
      [caller.personId, me[0]?.name ?? "A family member", id, circleIds],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "task not found" });
    return reply.send({ ok: true });
  });

  app.post("/care/tasks/:id/complete", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };
    const { result } = (req.body ?? {}) as { result?: string };

    const circleIds = await visibleCircleIds(caller.familyId, caller.personId);
    if (circleIds.length === 0) return reply.code(404).send({ error: "task not found" });

    const rows = await query(
      `UPDATE care_tasks SET done = true, result = coalesce($1, result)
         WHERE id = $2 AND circle_id = ANY($3) RETURNING id`,
      [result ?? null, id, circleIds],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "task not found" });
    return reply.send({ ok: true });
  });

  app.post("/care/meals/:id/claim", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { id } = req.params as { id: string };
    const { title } = (req.body ?? {}) as { title?: string };

    const circleIds = await visibleCircleIds(caller.familyId, caller.personId);
    if (circleIds.length === 0) return reply.code(404).send({ error: "slot not found" });

    const me = await query<{ name: string }>(`SELECT name FROM people WHERE id = $1`, [caller.personId]);
    const rows = await query(
      `UPDATE meal_slots SET claimed_by_name = $1, title = coalesce($2, title)
         WHERE id = $3 AND circle_id = ANY($4) RETURNING id`,
      [me[0]?.name ?? "A family member", title ?? null, id, circleIds],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "slot not found" });
    return reply.send({ ok: true });
  });
}
