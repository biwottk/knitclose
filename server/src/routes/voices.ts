/**
 * The Voice Vault.
 *
 * ideas.md line 26: a voice note IS a primary source. The recordings already exist in
 * media with transcripts -- the problem is that they live in Chat, where they scroll away
 * and are never found again.
 *
 * So there is no new storage here. A voice_recordings row is a CURATION DECISION: somebody
 * said this recording is worth keeping and finding. That is the whole difference between an
 * archive and a feed.
 */
import type { FastifyInstance } from "fastify";
import { authenticate, visibleAudiences } from "../access.ts";
import { newId, query, queryOne } from "../db.ts";
import { shapeMedia, type MediaRow } from "../shape.ts";
import { signedGetUrls } from "../storage.ts";

/**
 * Prompts for a family that does not know what to ask.
 *
 * These are the highest-yield questions for the material we are racing to capture: they are
 * about ORDINARY life rather than achievements, because "what did your kitchen smell like"
 * gets a five-minute answer and "tell me about your life" gets silence.
 */
const VOICE_PROMPTS = [
  "What did your mother sound like when she was cross?",
  "What was your first job, and what did it pay?",
  "What did Sunday look like when you were ten?",
  "Which song takes you straight back, and to where?",
  "What is a phrase your parents said that nobody says any more?",
  "What did the house you grew up in smell like?",
  "Who taught you to cook, and what was the first thing?",
  "What is something you were told never to mention?",
];

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/voices", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const rows = await query<{
      id: string; media_id: string; title: string; speaker_name: string;
      speaker_person_id: string | null; prompt: string | null;
      when_text: string | null; when_date: string | null;
      from_message_id: string | null; audience: string; created_at: Date;
      storage_key: string; duration_sec: number | null; transcript: string | null;
      media_kind: string;
    }>(
      `SELECT v.id, v.media_id, v.title, v.speaker_name, v.speaker_person_id, v.prompt,
              v.when_text, v.when_date, v.from_message_id, v.audience, v.created_at,
              m.storage_key, m.duration_sec, m.transcript, m.kind AS media_kind
         FROM voice_recordings v
         JOIN media m ON m.id = v.media_id
        WHERE v.family_id = $1 AND v.audience = ANY($2)
        ORDER BY v.created_at DESC`,
      [caller.familyId, visibleAudiences(caller)],
    );

    const urls = await signedGetUrls(rows.map((r) => r.storage_key));

    /**
     * Which prompts nobody has answered yet.
     *
     * Computed rather than stored: the point is to always have a next question to ask, and
     * a family should not run out. Matching on the stored prompt text keeps this simple and
     * survives the list being reordered.
     */
    const answered = new Set(rows.map((r) => r.prompt).filter(Boolean));
    const openPrompts = VOICE_PROMPTS.filter((p) => !answered.has(p));

    return reply.send({
      voices: rows.map((r) => ({
        id: r.id,
        title: r.title,
        speakerName: r.speaker_name,
        ...(r.speaker_person_id ? { speakerPersonId: r.speaker_person_id } : {}),
        ...(r.prompt ? { prompt: r.prompt } : {}),
        ...(r.when_text ? { whenText: r.when_text } : {}),
        ...(r.when_date ? { whenDate: r.when_date } : {}),
        ...(r.from_message_id ? { fromMessageId: r.from_message_id } : {}),
        audio: shapeMedia(
          {
            id: r.media_id, kind: r.media_kind as "audio",
            storage_key: r.storage_key, duration_sec: r.duration_sec,
            transcript: r.transcript,
          } as MediaRow,
          urls,
        ),
        audience: r.audience,
        createdAt: r.created_at.toISOString(),
      })),
      // Offered to the client so the vault can always suggest a next question.
      openPrompts,
    });
  });

  /**
   * Keep a recording: promote it into the vault.
   *
   * Takes a mediaId that already exists -- normally a voice note from Chat, sometimes a
   * fresh recording. The UNIQUE constraint on media_id means promoting the same note twice
   * is refused by the database rather than silently duplicated.
   */
  app.post("/voices", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const body = (req.body ?? {}) as {
      mediaId?: string; title?: string; speakerName?: string; speakerPersonId?: string;
      prompt?: string; whenText?: string; whenDate?: string; fromMessageId?: string;
      audience?: string;
    };

    if (!body.mediaId) return reply.code(400).send({ error: "mediaId is required" });

    const media = await queryOne<{ kind: string }>(
      `SELECT kind FROM media WHERE id = $1 AND family_id = $2`,
      [body.mediaId, caller.familyId],
    );
    if (!media) return reply.code(404).send({ error: "recording not found" });
    if (media.kind !== "audio") {
      return reply.code(422).send({ error: "only an audio recording can go in the voice vault" });
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM voice_recordings WHERE media_id = $1`, [body.mediaId]);
    if (existing) {
      // Idempotent rather than an error: tapping "keep this" twice means the same thing.
      return reply.code(200).send({ id: existing.id, alreadyKept: true });
    }

    /**
     * The speaker.
     *
     * Resolved from the message author when the recording came from Chat, because that is
     * who was talking -- and whose voice it is happens to be the most important field in
     * the table.
     */
    let speakerName = body.speakerName?.trim();
    let speakerPersonId = body.speakerPersonId ?? null;
    if (body.fromMessageId) {
      const msg = await queryOne<{ author_id: string | null; author_name: string }>(
        `SELECT author_id, author_name FROM messages WHERE id = $1 AND family_id = $2`,
        [body.fromMessageId, caller.familyId],
      );
      if (msg) {
        speakerName = speakerName || msg.author_name;
        speakerPersonId = speakerPersonId ?? msg.author_id;
      }
    }
    if (!speakerName) return reply.code(400).send({ error: "speakerName is required" });

    const audience = body.audience ?? "everyone";
    if (!["everyone", "adults", "care", "branch"].includes(audience)) {
      return reply.code(400).send({ error: "invalid audience" });
    }

    const id = newId("vr");
    await query(
      `INSERT INTO voice_recordings (id, family_id, media_id, title, speaker_name,
                                    speaker_person_id, prompt, when_text, when_date,
                                    from_message_id, audience, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id, caller.familyId, body.mediaId,
        // Falls back to the speaker name so a vault entry is never untitled.
        body.title?.trim() || (speakerName + " speaking"),
        speakerName, speakerPersonId,
        body.prompt?.trim() || null,
        body.whenText?.trim() || null, body.whenDate || null,
        body.fromMessageId ?? null, audience, caller.personId,
      ],
    );

    return reply.code(201).send({ id });
  });
}
