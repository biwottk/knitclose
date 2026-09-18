/**
 * Row -> client shape.
 *
 * The client's `src/types.ts` is the contract, and it is deliberately unchanged by
 * this migration: screens keep receiving `Deed`, `Person`, `Media` with the same
 * field names they already render. Everything database-shaped (snake_case columns,
 * storage keys, join rows) is translated here.
 *
 * WHY A TRANSLATION LAYER AND NOT "JUST RETURN THE ROWS":
 *
 *  - Storage keys must become short-lived signed URLs. The database stores
 *    'families/f1/media/m1.jpg'; the client needs something it can put in an
 *    <Image src>. That conversion needs to happen exactly once, on the way out.
 *  - Reaction rows are (deed, person, kind) triples; the client wants
 *    Record<kind, personId[]>. Doing that fold in SQL is possible and unreadable.
 *  - It gives the eventual AWS move somewhere to absorb differences without the
 *    app noticing.
 */
import type { QueryResultRow } from "pg";

export interface MediaRow extends QueryResultRow {
  id: string;
  kind: "photo" | "video" | "audio";
  storage_key: string;
  duration_sec: number | null;
  transcript: string | null;
}

/** `Media` in the client's types: a uri the UI can render, not a storage key. */
export function shapeMedia(row: MediaRow, urls: Map<string, string>) {
  return {
    id: row.id,
    kind: row.kind,
    uri: urls.get(row.storage_key) ?? "",
    ...(row.duration_sec !== null ? { durationSec: row.duration_sec } : {}),
    ...(row.transcript !== null ? { transcript: row.transcript } : {}),
  };
}

export interface PersonRow extends QueryResultRow {
  id: string;
  name: string;
  birth_date: string | null;
  death_date: string | null;
  photo_key: string | null;
  bio: string | null;
  is_living: boolean;
  location: string | null;
  memorialised: boolean;
}

export function shapePerson(
  row: PersonRow,
  urls: Map<string, string>,
  edges: { parentIds: string[]; spouseIds: string[] },
) {
  return {
    id: row.id,
    name: row.name,
    ...(row.birth_date ? { birthDate: row.birth_date } : {}),
    ...(row.death_date ? { deathDate: row.death_date } : {}),
    ...(row.photo_key ? { photoUri: urls.get(row.photo_key) ?? "" } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    isLiving: row.is_living,
    ...(row.location ? { location: row.location } : {}),
    parentIds: edges.parentIds,
    spouseIds: edges.spouseIds,
    // Only present when true: the client treats it as an optional flag, and a
    // literal false would make every living person's payload noisier for nothing.
    ...(row.memorialised ? { memorialised: true } : {}),
  };
}

export interface DeedRow extends QueryResultRow {
  id: string;
  kind: string;
  may_resurface: boolean;
  title: string;
  when_text: string;
  when_date: string | null;
  story: string;
  author_id: string | null;
  author_name: string;
  audience: "everyone" | "adults" | "care" | "branch";
  flagged: boolean;
  from_message_id: string | null;
  created_at: Date;
}

/**
 * Reactions start EMPTY, with no pre-seeded keys.
 *
 * This used to return all four kinds as empty arrays. That is wrong now that reactions
 * depend on the entry's kind: pre-seeding 'applaud' on a hardTime row would ship a key
 * the UI must never offer, and any client reading the object rather than
 * REACTIONS_FOR_KIND would render "Applaud 0" under a funeral. An absent key and an
 * empty array mean the same thing to the client, so absence is the safer default.
 */
export function emptyReactions(): Record<string, string[]> {
  return {};
}

export function shapeDeed(
  row: DeedRow,
  parts: {
    personIds: string[];
    tags: string[];
    media: ReturnType<typeof shapeMedia>[];
    reactions: Record<string, string[]>;
  },
) {
  return {
    id: row.id,
    kind: row.kind,
    // Only sent when it diverges from the kind's default, keeping payloads quiet.
    ...(row.may_resurface === false ? { mayResurface: false } : {}),
    title: row.title,
    whenText: row.when_text,
    ...(row.when_date ? { whenDate: row.when_date } : {}),
    story: row.story,
    personIds: parts.personIds,
    tags: parts.tags,
    media: parts.media,
    authorId: row.author_id ?? "",
    authorName: row.author_name,
    createdAt: row.created_at.toISOString(),
    reactions: parts.reactions,
    audience: row.audience,
    ...(row.flagged ? { flagged: true } : {}),
    ...(row.from_message_id ? { fromMessageId: row.from_message_id } : {}),
  };
}
