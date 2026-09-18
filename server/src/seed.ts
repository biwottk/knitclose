/**
 * Seed the database and object storage from the app's existing fixtures.
 *
 * IT IMPORTS ../../src/mockData.ts DIRECTLY rather than restating the content.
 * That is the whole design of this script: the fixture stays the single source of
 * truth, so the seeded database is provably the same family the design was built
 * against (docs/design.md, design/screen.png) and the two cannot drift apart. It
 * also means this file shrinks to a translation, not a second copy of the data.
 *
 * Photos are FETCHED and stored as real objects in MinIO. Keeping the Unsplash URLs
 * in the database would defeat the point of the exercise: the app would still be
 * loading images from someone else's CDN, media would not be exercising the storage
 * path at all, and the first offline demo would show grey boxes. The uploads are
 * cached under .seed-cache/ so re-seeding does not re-download.
 *
 *   node --experimental-strip-types src/seed.ts [--reset]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, query, transaction } from "./db.ts";
import { hashPassword } from "./auth.ts";
import { ensureBucket, putObject } from "./storage.ts";
import { migrate } from "./migrate.ts";

import * as seed from "../../src/mockData.ts";
import type { Media } from "../../src/types.ts";

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".seed-cache");

/** Every seeded account shares this password. Dev fixture only, never shipped. */
const SEED_PASSWORD = "familyfirst2024";

/**
 * Fetch a URL once, then serve it from disk on later runs.
 *
 * Re-seeding is something you do repeatedly while building out routes, and hammering
 * Unsplash for the same 16 images each time is both slow and rude.
 */
async function fetchCached(url: string): Promise<{ body: Buffer; contentType: string }> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
  const bodyPath = join(CACHE_DIR, key);
  const metaPath = join(CACHE_DIR, `${key}.type`);

  try {
    return {
      body: await readFile(bodyPath),
      contentType: (await readFile(metaPath, "utf8")).trim(),
    };
  } catch {
    // Not cached yet.
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const body = Buffer.from(await res.arrayBuffer());

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(bodyPath, body);
  await writeFile(metaPath, contentType);
  return { body, contentType };
}

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
};

/**
 * Store one remote image as a media row + object, returning the media id.
 *
 * Memoised by URL: the fixture reuses the same photo for a person's avatar and for
 * their appearances elsewhere, and one object per distinct image is correct.
 */
const mediaByUrl = new Map<string, string>();

async function importImage(familyId: string, url: string, kind: Media["kind"] = "photo"): Promise<string> {
  const existing = mediaByUrl.get(url);
  if (existing) return existing;

  const { body, contentType } = await fetchCached(url);
  const mediaId = `m_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
  const key = `families/${familyId}/media/${mediaId}${EXT[contentType] ?? ".jpg"}`;

  await putObject(key, body, contentType);
  await query(
    `INSERT INTO media (id, family_id, kind, storage_key, content_type, bytes)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
    [mediaId, familyId, kind, key, contentType, body.length],
  );

  mediaByUrl.set(url, mediaId);
  return mediaId;
}

/**
 * A voice note in the fixture has no real audio -- the URIs are 'mock://voice/...'
 * placeholders, because recording is still presentational in the client. The row is
 * created anyway, WITHOUT a storage object, so the transcript and duration are real
 * data the UI can render. storage_key is the sentinel below, and the media route
 * will simply fail to sign it, which is honest: there are no bytes.
 */
async function importPlaceholderAudio(familyId: string, m: Media, transcript?: string): Promise<string> {
  const mediaId = `m_${createHash("sha256").update(m.uri).digest("hex").slice(0, 16)}`;
  await query(
    `INSERT INTO media (id, family_id, kind, storage_key, duration_sec, transcript)
     VALUES ($1, $2, 'audio', $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    [mediaId, familyId, `pending/${mediaId}`, m.durationSec ?? null, transcript ?? null],
  );
  return mediaId;
}

/** ISO timestamp -> 'YYYY-MM-DD', or null for a fuzzy string we cannot parse. */
function isoDate(value?: string): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

async function reset(): Promise<void> {
  // families cascades to everything else; media has no parent so it goes explicitly.
  await query(`DELETE FROM families`);
  await query(`DELETE FROM media`);
  await query(`DELETE FROM users`);
  console.log("[seed] cleared existing data");
}

async function main(): Promise<void> {
  await migrate();
  await ensureBucket();

  if (process.argv.includes("--reset")) await reset();

  const familyId = seed.family.id;

  const existing = await query(`SELECT 1 FROM families WHERE id = $1`, [familyId]);
  if (existing.length > 0) {
    console.log("[seed] family already present -- pass --reset to reseed");
    return;
  }

  console.log("[seed] importing photos into object storage...");

  // -- family, people ------------------------------------------------------
  await query(
    `INSERT INTO families (id, name, plan) VALUES ($1, $2, $3)`,
    [familyId, seed.family.name, seed.family.plan],
  );

  // Photos first: people rows reference the storage key, so the objects must exist.
  const personPhoto = new Map<string, string>();
  for (const p of seed.people) {
    if (p.photoUri?.startsWith("http")) {
      const mediaId = await importImage(familyId, p.photoUri);
      const row = await query<{ storage_key: string }>(
        `SELECT storage_key FROM media WHERE id = $1`, [mediaId]);
      personPhoto.set(p.id, row[0].storage_key);
    }
  }

  await transaction(async (client) => {
    for (const p of seed.people) {
      await client.query(
        `INSERT INTO people (id, family_id, name, birth_date, death_date, photo_key,
                             bio, is_living, location, memorialised)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          p.id, familyId, p.name, p.birthDate ?? null, p.deathDate ?? null,
          personPhoto.get(p.id) ?? null, p.bio ?? null, p.isLiving,
          p.location ?? null, p.memorialised ?? false,
        ],
      );
    }

    // Relationship edges. Spouse edges are stored ONCE -- the fixture lists them on
    // both partners, so the id comparison keeps a single canonical row and the
    // /people route mirrors it back to both sides.
    for (const p of seed.people) {
      for (const parentId of p.parentIds) {
        await client.query(
          `INSERT INTO relationships (family_id, from_person_id, to_person_id, kind)
           VALUES ($1, $2, $3, 'parent') ON CONFLICT DO NOTHING`,
          [familyId, parentId, p.id],
        );
      }
      for (const spouseId of p.spouseIds) {
        if (p.id < spouseId) {
          await client.query(
            `INSERT INTO relationships (family_id, from_person_id, to_person_id, kind)
             VALUES ($1, $2, $3, 'spouse') ON CONFLICT DO NOTHING`,
            [familyId, p.id, spouseId],
          );
        }
      }
    }
  });

  // -- users -------------------------------------------------------------
  /**
   * One login per living person, so every role in the product can actually be tested
   * on a device. Leo is a CHILD account on purpose: he is the proof that server-side
   * audience filtering works, because he must never receive adults-only content.
   */
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const accounts: { personId: string; email: string; role: "admin" | "member" | "child" }[] = [
    { personId: "p_sarah", email: "sarah@example.com", role: "admin" },
    { personId: "p_claire", email: "claire@example.com", role: "member" },
    { personId: "p_dave", email: "dave@example.com", role: "member" },
    { personId: "p_nana", email: "nana@example.com", role: "member" },
    { personId: "p_marcus", email: "marcus@example.com", role: "member" },
    { personId: "p_maya", email: "maya@example.com", role: "member" },
    { personId: "p_leo", email: "leo@example.com", role: "child" },
  ];

  await transaction(async (client) => {
    for (const a of accounts) {
      const person = seed.people.find((p) => p.id === a.personId);
      const userId = `u_${a.personId.replace(/^p_/, "")}`;
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)`,
        [userId, a.email, passwordHash, person?.name ?? a.email],
      );
      await client.query(
        `INSERT INTO memberships (user_id, family_id, role, person_id) VALUES ($1, $2, $3, $4)`,
        [userId, familyId, a.role, a.personId],
      );
    }
  });

  // -- deeds -------------------------------------------------------------
  for (const d of seed.deeds) {
    const mediaIds: string[] = [];
    for (const m of d.media) {
      if (m.uri.startsWith("http")) mediaIds.push(await importImage(familyId, m.uri, m.kind));
      else if (m.kind === "audio") mediaIds.push(await importPlaceholderAudio(familyId, m));
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO deeds (id, family_id, kind, title, when_text, when_date, story,
                            author_id, author_name, audience, flagged, from_message_id,
                            created_at, may_resurface)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          d.id, familyId, d.kind, d.title, d.whenText, isoDate(d.whenDate), d.story,
          d.authorId, d.authorName, d.audience, d.flagged ?? false,
          d.fromMessageId ?? null, d.createdAt,
          // Default from kind, so the fixture does not have to state the obvious.
          d.mayResurface ?? !["hardTime", "inMemory"].includes(d.kind),
        ],
      );
      for (const personId of d.personIds) {
        await client.query(
          `INSERT INTO deed_people (deed_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [d.id, personId]);
      }
      for (const tag of d.tags) {
        await client.query(
          `INSERT INTO deed_tags (deed_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [d.id, tag]);
      }
      let pos = 0;
      for (const mediaId of mediaIds) {
        await client.query(
          `INSERT INTO deed_media (deed_id, media_id, position) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`, [d.id, mediaId, pos++]);
      }
      // reactions: Record<kind, personId[]> -> one row per (deed, person, kind)
      for (const [kind, personIds] of Object.entries(d.reactions ?? {})) {
        for (const personId of personIds as string[]) {
          await client.query(
            `INSERT INTO deed_reactions (deed_id, person_id, kind) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`, [d.id, personId, kind]);
        }
      }
    });
  }

  for (const c of seed.comments) {
    await query(
      `INSERT INTO comments (id, deed_id, family_id, author_id, author_name, body, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [c.id, c.deedId, familyId, c.authorId, c.authorName, c.body, c.parentId ?? null, c.createdAt],
    );
  }

  // -- chat --------------------------------------------------------------
  await transaction(async (client) => {
    for (const t of seed.threads) {
      await client.query(
        `INSERT INTO threads (id, family_id, title, kind, audience) VALUES ($1, $2, $3, $4, $5)`,
        [t.id, familyId, t.title, t.kind, t.audience]);
      for (const personId of t.memberIds) {
        await client.query(
          `INSERT INTO thread_members (thread_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [t.id, personId]);
      }
    }
  });

  for (const m of seed.messages) {
    const audioId = m.audio ? await importPlaceholderAudio(familyId, m.audio, m.transcript) : null;
    const photoIds: string[] = [];
    for (const ph of m.photos ?? []) {
      if (ph.uri.startsWith("http")) photoIds.push(await importImage(familyId, ph.uri, "photo"));
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO messages (id, thread_id, family_id, author_id, author_name, body,
                               audio_media_id, context_label, promoted_to_deed_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          m.id, m.threadId, familyId, m.authorId, m.authorName, m.body ?? null,
          audioId, m.contextLabel ?? null, m.promotedToDeedId ?? null, m.createdAt,
        ],
      );
      let pos = 0;
      for (const mediaId of photoIds) {
        await client.query(
          `INSERT INTO message_media (message_id, media_id, position) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`, [m.id, mediaId, pos++]);
      }
      for (const [key, personIds] of Object.entries(m.reactions ?? {})) {
        for (const personId of personIds as string[]) {
          await client.query(
            `INSERT INTO message_reactions (message_id, person_id, key) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`, [m.id, personId, key]);
        }
      }
      for (const personId of m.seenBy ?? []) {
        await client.query(
          `INSERT INTO message_seen (message_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [m.id, personId]);
      }
    });
  }

  // -- care --------------------------------------------------------------
  await transaction(async (client) => {
    for (const c of seed.careCircles) {
      await client.query(
        `INSERT INTO care_circles (id, family_id, person_id, status, mood, recovery_week, dietary_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, familyId, c.personId, c.status, c.mood ?? null, c.recoveryWeek ?? null, c.dietaryNote ?? null]);
      for (const personId of c.memberIds) {
        await client.query(
          `INSERT INTO care_circle_members (circle_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [c.id, personId]);
      }
    }

    for (const t of seed.careTasks) {
      await client.query(
        `INSERT INTO care_tasks (id, circle_id, family_id, kind, title, time_text, date,
                                 detail, done, claimed_by_id, claimed_by_name, result, urgent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          t.id, t.circleId, familyId, t.kind, t.title, t.timeText, isoDate(t.date),
          t.detail ?? null, t.done, t.claimedById ?? null, t.claimedByName ?? null,
          t.result ?? null, t.urgent ?? false,
        ]);
    }

    for (const m of seed.medications) {
      await client.query(
        `INSERT INTO medications (id, circle_id, family_id, name, dose, schedule, days_left, pharmacy, pickup_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [m.id, m.circleId, familyId, m.name, m.dose, m.schedule, m.daysLeft, m.pharmacy ?? null, m.pickupByName ?? null]);
    }

    for (const s of seed.mealSlots) {
      await client.query(
        `INSERT INTO meal_slots (id, circle_id, family_id, date, day_label, date_label, title, detail, claimed_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [s.id, s.circleId, familyId, isoDate(s.date), s.dayLabel, s.dateLabel, s.title ?? null, s.detail ?? null, s.claimedByName ?? null]);
    }

    for (const c of seed.emergencyCards) {
      await client.query(
        `INSERT INTO emergency_cards (person_id, family_id, blood_type, allergies, conditions,
                                      medications, clinicians, contacts, power_of_attorney)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          c.personId, familyId, c.bloodType ?? null, c.allergies, c.conditions,
          c.medications, JSON.stringify(c.clinicians), JSON.stringify(c.contacts),
          c.powerOfAttorney ?? null,
        ]);
    }
  });

  for (const n of seed.doctorNotes) {
    const audioId = n.audio ? await importPlaceholderAudio(familyId, n.audio) : null;
    await query(
      `INSERT INTO doctor_notes (id, circle_id, family_id, clinician, summary,
                                 recorded_by_name, audio_media_id, validated, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [n.id, n.circleId, familyId, n.clinician, n.summary, n.recordedByName,
       audioId, n.validated ?? false, n.createdAt]);
  }

  // -- archive -----------------------------------------------------------
  for (const r of seed.recipes) {
    const photoId = r.photoUri?.startsWith("http") ? await importImage(familyId, r.photoUri) : null;
    const cardId = r.cardPhotoUri?.startsWith("http") ? await importImage(familyId, r.cardPhotoUri) : null;
    const voiceId = r.voiceNote ? await importPlaceholderAudio(familyId, r.voiceNote) : null;

    await query(
      `INSERT INTO recipes (id, family_id, title, attribution, person_id, provenance, origin,
                            origin_year, prep_text, yield_text, photo_media_id, card_media_id,
                            voice_media_id, voice_note_label, ingredients, steps, tradition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        r.id, familyId, r.title, r.attribution, r.personId ?? null, r.provenance,
        r.origin ?? null, r.originYear ?? null, r.prepText ?? null, r.yieldText ?? null,
        photoId, cardId, voiceId, r.voiceNoteLabel ?? null,
        r.ingredients, r.steps, r.tradition ?? null,
      ]);

    // savedByCurrentUser was a client-side flag; it becomes a real per-person row.
    if (r.savedByCurrentUser) {
      await query(
        `INSERT INTO recipe_saves (recipe_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [r.id, seed.currentUser.personId]);
    }
  }

  for (const p of seed.archivePhotos) {
    const mediaId = p.uri.startsWith("http") ? await importImage(familyId, p.uri) : null;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO archive_photos (id, family_id, media_id, provenance, question, detail, asking_names)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, familyId, mediaId, p.provenance, p.question, p.detail ?? null, p.askingNames]);
      for (const f of p.faces) {
        await client.query(
          `INSERT INTO face_tags (id, photo_id, x, y, name, guess) VALUES ($1, $2, $3, $4, $5, $6)`,
          [f.id, p.id, f.x, f.y, f.name ?? null, f.guess ?? null]);
      }
      let i = 0;
      for (const c of p.clues) {
        await client.query(
          `INSERT INTO photo_clues (id, photo_id, author_name, body) VALUES ($1, $2, $3, $4)`,
          [`${p.id}_clue${i++}`, p.id, c.authorName, c.body]);
      }
    });
  }

  // -- events ------------------------------------------------------------
  await transaction(async (client) => {
    for (const e of seed.events) {
      // Auto-derived birthdays are generated from the tree at read time, so seeding
      // them would produce a duplicate of every one.
      if (e.auto) continue;

      await client.query(
        `INSERT INTO events (id, family_id, kind, title, date, location, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [e.id, familyId, e.kind, e.title, isoDate(e.date), e.location ?? null, e.note ?? null]);
      for (const personId of e.personIds) {
        await client.query(
          `INSERT INTO event_people (event_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [e.id, personId]);
      }
      for (const personId of e.rsvpYes ?? []) {
        await client.query(
          `INSERT INTO event_rsvps (event_id, person_id, attending) VALUES ($1, $2, true)
           ON CONFLICT DO NOTHING`, [e.id, personId]);
      }
      for (const item of e.potluck ?? []) {
        await client.query(
          `INSERT INTO potluck_items (id, event_id, item, claimed_by_name) VALUES ($1, $2, $3, $4)`,
          [item.id, e.id, item.item, item.claimedByName ?? null]);
      }
    }
  });

  const counts = await query<{ table_name: string; n: string }>(`
    SELECT 'people' AS table_name, count(*)::text AS n FROM people
    UNION ALL SELECT 'users', count(*)::text FROM users
    UNION ALL SELECT 'deeds', count(*)::text FROM deeds
    UNION ALL SELECT 'media', count(*)::text FROM media
    UNION ALL SELECT 'messages', count(*)::text FROM messages
    UNION ALL SELECT 'care_tasks', count(*)::text FROM care_tasks
    UNION ALL SELECT 'recipes', count(*)::text FROM recipes
    UNION ALL SELECT 'archive_photos', count(*)::text FROM archive_photos
    UNION ALL SELECT 'events', count(*)::text FROM events
    ORDER BY table_name
  `);

  console.log("[seed] done:");
  for (const c of counts) console.log(`         ${c.n.padStart(4)}  ${c.table_name}`);
  console.log(`[seed] logins: ${accounts.map((a) => a.email).join(", ")}`);
  console.log(`[seed] password for all seeded accounts: ${SEED_PASSWORD}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("[seed] failed:", err.message);
    await pool.end();
    process.exit(1);
  });
