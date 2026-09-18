-- knitclose schema, v1.
--
-- DESIGN RULES (they are load-bearing, not style preferences):
--
-- 1. EVERY content table carries family_id, even when it is derivable through a
--    join. docs/great_deeds_tech_stack.md commits to "you may read a row iff you
--    have a membership in its family" as the single security predicate, and that
--    only stays a one-line check if family_id is always right there. It also makes
--    the eventual move to RLS (or an AWS equivalent) mechanical.
--
-- 2. AUDIENCE IS A COLUMN ON CONTENT, not a property of a screen. The client used
--    to be the only thing filtering; the API now filters in SQL, so a bug in the
--    app cannot leak adults-only material to a child account.
--
-- 3. IDS ARE TEXT, not uuid. The seed carries the ids the mock data already used
--    ('p_nana', 'd_cabin'), which keeps seeded fixtures diffable against the old
--    mockData.ts and makes failures legible while this is being built out. New
--    rows get a uuid-shaped text id from the API. The column type does not change
--    when we stop seeding.
--
-- 4. TIMESTAMPTZ everywhere, never TIMESTAMP. A family spans continents (the seed
--    has Leeds and Vermont) and "when did Nana post this" must not depend on the
--    server's clock zone.
--
-- 5. Fuzzy dates keep BOTH forms: '*_text' is what the family typed ("Summer of
--    1978", "circa 1890") and '*_date' is the sortable value when one can be
--    derived. Never destroy the human phrasing to satisfy a date parser -- the
--    archive's value is that it is in their words.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enumerated domains
--
-- These are CHECK constraints over text rather than PG enums: adding a value to a
-- PG enum needs ALTER TYPE and cannot be done in a transaction with a table
-- rewrite, whereas the product will certainly grow new reaction kinds and tags.
-- ---------------------------------------------------------------------------

CREATE DOMAIN audience AS text
  CHECK (VALUE IN ('everyone', 'adults', 'care', 'branch'));

CREATE DOMAIN media_kind AS text
  CHECK (VALUE IN ('photo', 'video', 'audio'));

CREATE DOMAIN member_role AS text
  CHECK (VALUE IN ('admin', 'member', 'child'));

CREATE DOMAIN reaction_kind AS text
  CHECK (VALUE IN ('applaud', 'inspire', 'cherish', 'love'));

-- ---------------------------------------------------------------------------
-- Families, users, membership
-- ---------------------------------------------------------------------------

CREATE TABLE families (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             text PRIMARY KEY,
  email          text NOT NULL,
  -- scrypt output, encoded by the API. Never a plaintext or reversible value.
  password_hash  text NOT NULL,
  display_name   text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: "Nana@example.com" and "nana@example.com" are one
-- person, and a family will absolutely type both.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- People: the family graph. Distinct from users -- most people in a family tree
-- never get an account (the dead, the very young), and that is the normal case.
-- ---------------------------------------------------------------------------

CREATE TABLE people (
  id            text PRIMARY KEY,
  family_id     text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name          text NOT NULL,
  birth_date    text,          -- fuzzy: may be 'circa 1890'
  death_date    text,
  photo_key     text,          -- object storage key, NOT a URL (see storage.ts)
  bio           text,
  is_living     boolean NOT NULL DEFAULT true,
  location      text,
  -- Bereavement mode. The API must never generate a prompt about a memorialised
  -- person; see the events query in routes/hearth.ts.
  memorialised  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_family_idx ON people (family_id);

-- A user's seat in a family, and which person in the tree they *are*.
CREATE TABLE memberships (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id  text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  role       member_role NOT NULL DEFAULT 'member',
  person_id  text REFERENCES people(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, family_id)
);

CREATE INDEX memberships_family_idx ON memberships (family_id);

-- A family is a graph, not a nested tree: divorce, remarriage and adoption all
-- break a parent-pointer model. Edges are stored once, directed, and typed.
CREATE TABLE relationships (
  family_id      text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  from_person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_person_id   text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('parent', 'spouse')),
  PRIMARY KEY (from_person_id, to_person_id, kind),
  -- 'X is their own parent' is always data corruption.
  CHECK (from_person_id <> to_person_id)
);

CREATE INDEX relationships_to_idx ON relationships (to_person_id, kind);

-- ---------------------------------------------------------------------------
-- Invitations: single-use, expiring, revocable (security posture, tech stack doc)
-- ---------------------------------------------------------------------------

CREATE TABLE invitations (
  token       text PRIMARY KEY,
  family_id   text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        member_role NOT NULL DEFAULT 'member',
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_family_idx ON invitations (family_id);

-- ---------------------------------------------------------------------------
-- Speed 2: heirloom deeds
-- ---------------------------------------------------------------------------

CREATE TABLE deeds (
  id           text PRIMARY KEY,
  family_id    text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title        text NOT NULL,
  when_text    text NOT NULL,     -- the family's phrasing, always displayed
  when_date    date,              -- derived, sortable, nullable on purpose
  story        text NOT NULL DEFAULT '',
  author_id    text REFERENCES people(id) ON DELETE SET NULL,
  author_name  text NOT NULL,     -- denormalised: the byline must survive deletion
  audience     audience NOT NULL DEFAULT 'everyone',
  -- Private admin review only. There is deliberately no public "reported" badge;
  -- see docs/great_deeds_strategy.md section 4.
  flagged      boolean NOT NULL DEFAULT false,
  -- Set when a Tuesday chat message was promoted into the permanent archive.
  from_message_id text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The feed is always "this family, newest first, audience-filtered", so the index
-- matches that access path exactly.
CREATE INDEX deeds_family_created_idx ON deeds (family_id, created_at DESC);
CREATE INDEX deeds_family_when_idx ON deeds (family_id, when_date);

CREATE TABLE deed_people (
  deed_id   text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (deed_id, person_id)
);

CREATE INDEX deed_people_person_idx ON deed_people (person_id);

CREATE TABLE deed_tags (
  deed_id text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  tag     text NOT NULL,
  PRIMARY KEY (deed_id, tag)
);

-- ---------------------------------------------------------------------------
-- Media. Rows store an object STORAGE KEY, never a URL.
--
-- WHY: URLs to private media must be short-lived signed links (security posture),
-- so a persisted URL is either already expired or -- far worse -- a permanently
-- public one. The API signs a fresh URL per response from the key.
-- ---------------------------------------------------------------------------

CREATE TABLE media (
  id           text PRIMARY KEY,
  family_id    text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind         media_kind NOT NULL,
  storage_key  text NOT NULL,
  content_type text,
  bytes        bigint,
  width        integer,
  height       integer,
  duration_sec numeric(10, 2),
  -- Transcript of an audio object. The single highest-value AI feature in the
  -- product: it makes the way elders naturally communicate searchable.
  transcript   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_family_idx ON media (family_id);

-- Media attaches to several kinds of parent, so the link is a join table rather
-- than a nullable FK per parent type.
CREATE TABLE deed_media (
  deed_id   text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  media_id  text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (deed_id, media_id)
);

-- ---------------------------------------------------------------------------
-- Reactions and comments
-- ---------------------------------------------------------------------------

-- One row per (deed, person, kind): the PK makes double-tapping idempotent
-- without the API having to read first.
CREATE TABLE deed_reactions (
  deed_id   text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind      reaction_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deed_id, person_id, kind)
);

CREATE TABLE comments (
  id          text PRIMARY KEY,
  deed_id     text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  family_id   text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  author_id   text REFERENCES people(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body        text NOT NULL,
  parent_id   text REFERENCES comments(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_deed_idx ON comments (deed_id, created_at);

-- ---------------------------------------------------------------------------
-- Speed 1: chat threads, messages, voice notes
-- ---------------------------------------------------------------------------

CREATE TABLE threads (
  id        text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title     text NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('general', 'care', 'planning')),
  audience  audience NOT NULL DEFAULT 'everyone',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX threads_family_idx ON threads (family_id);

-- Explicit membership: the care thread must not be readable by the whole family
-- just because they are in the family.
CREATE TABLE thread_members (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, person_id)
);

CREATE TABLE messages (
  id            text PRIMARY KEY,
  thread_id     text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  family_id     text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  author_id     text REFERENCES people(id) ON DELETE SET NULL,
  author_name   text NOT NULL,
  body          text,
  audio_media_id text REFERENCES media(id) ON DELETE SET NULL,
  context_label text,
  promoted_to_deed_id text REFERENCES deeds(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- A message with neither text nor audio nor a photo is meaningless; catching it
  -- here stops an empty bubble from ever rendering.
  CHECK (body IS NOT NULL OR audio_media_id IS NOT NULL)
);

CREATE INDEX messages_thread_idx ON messages (thread_id, created_at);

CREATE TABLE message_media (
  message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  media_id   text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, media_id)
);

-- Free-form reaction keys, stored as SEMANTIC WORDS ('love'), never emoji
-- characters -- presentation maps them to vector glyphs in the client, so the
-- icon set can be retuned without migrating anybody's messages.
CREATE TABLE message_reactions (
  message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  person_id  text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  key        text NOT NULL,
  PRIMARY KEY (message_id, person_id, key)
);

CREATE TABLE message_seen (
  message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  person_id  text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Care coordination
-- ---------------------------------------------------------------------------

CREATE TABLE care_circles (
  id             text PRIMARY KEY,
  family_id      text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id      text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT '',
  mood           text,
  recovery_week  integer,
  dietary_note   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_circles_family_idx ON care_circles (family_id);

CREATE TABLE care_circle_members (
  circle_id text NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (circle_id, person_id)
);

CREATE TABLE care_tasks (
  id              text PRIMARY KEY,
  circle_id       text NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
  family_id       text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('medication','appointment','visit','meal','other')),
  title           text NOT NULL,
  time_text       text NOT NULL,
  date            date NOT NULL,
  detail          text,
  done            boolean NOT NULL DEFAULT false,
  -- NULL is the product's most important state: an unclaimed slot is the loudest
  -- thing on the Care screen, because the failure mode of family care is
  -- diffusion of responsibility, not disagreement.
  claimed_by_id   text REFERENCES people(id) ON DELETE SET NULL,
  claimed_by_name text,
  result          text,
  urgent          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_tasks_circle_date_idx ON care_tasks (circle_id, date);

CREATE TABLE doctor_notes (
  id               text PRIMARY KEY,
  circle_id        text NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
  family_id        text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  clinician        text NOT NULL,
  summary          text NOT NULL,
  recorded_by_name text NOT NULL,
  audio_media_id   text REFERENCES media(id) ON DELETE SET NULL,
  validated        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doctor_notes_circle_idx ON doctor_notes (circle_id, created_at DESC);

CREATE TABLE medications (
  id             text PRIMARY KEY,
  circle_id      text NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
  family_id      text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name           text NOT NULL,
  dose           text NOT NULL,
  schedule       text NOT NULL,
  days_left      integer NOT NULL,
  pharmacy       text,
  pickup_by_name text
);

CREATE INDEX medications_circle_idx ON medications (circle_id);

CREATE TABLE meal_slots (
  id              text PRIMARY KEY,
  circle_id       text NOT NULL REFERENCES care_circles(id) ON DELETE CASCADE,
  family_id       text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date            date NOT NULL,
  day_label       text NOT NULL,
  date_label      text NOT NULL,
  title           text,
  detail          text,
  claimed_by_name text
);

CREATE INDEX meal_slots_circle_date_idx ON meal_slots (circle_id, date);

-- The emergency card: one screen, cached offline, the thing you hand a paramedic.
-- Adults-only by construction -- it has no audience column because it must never
-- be 'everyone'; the route hard-codes the adults check.
CREATE TABLE emergency_cards (
  person_id         text PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  family_id         text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  blood_type        text,
  allergies         text[] NOT NULL DEFAULT '{}',
  conditions        text[] NOT NULL DEFAULT '{}',
  medications       text[] NOT NULL DEFAULT '{}',
  -- Small, always-read-whole, never queried by inner field: jsonb is right here
  -- and a pair of extra tables would be pure ceremony.
  clinicians        jsonb NOT NULL DEFAULT '[]',
  contacts          jsonb NOT NULL DEFAULT '[]',
  power_of_attorney text
);

-- ---------------------------------------------------------------------------
-- The archive: recipes, and "Who is this?" face tagging
-- ---------------------------------------------------------------------------

CREATE TABLE recipes (
  id                text PRIMARY KEY,
  family_id         text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title             text NOT NULL,
  attribution       text NOT NULL,
  person_id         text REFERENCES people(id) ON DELETE SET NULL,
  provenance        text NOT NULL DEFAULT '',
  origin            text,
  origin_year       text,
  prep_text         text,
  yield_text        text,
  photo_media_id    text REFERENCES media(id) ON DELETE SET NULL,
  -- The handwritten card is the PRIMARY SOURCE -- it is in her handwriting -- and
  -- matters as much as the typed version, so it gets its own column.
  card_media_id     text REFERENCES media(id) ON DELETE SET NULL,
  -- An elder talking through the tricky part: preserves tacit knowledge that the
  -- written steps always lose.
  voice_media_id    text REFERENCES media(id) ON DELETE SET NULL,
  voice_note_label  text,
  ingredients       text[] NOT NULL DEFAULT '{}',
  steps             text[] NOT NULL DEFAULT '{}',
  tradition         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipes_family_idx ON recipes (family_id);

-- Per-user, not a boolean on the recipe: "saved to my kitchen" is one member's
-- choice, and the old mock field savedByCurrentUser could not express that.
CREATE TABLE recipe_saves (
  recipe_id text NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, person_id)
);

CREATE TABLE archive_photos (
  id           text PRIMARY KEY,
  family_id    text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  media_id     text REFERENCES media(id) ON DELETE SET NULL,
  provenance   text NOT NULL DEFAULT '',
  question     text NOT NULL DEFAULT '',
  detail       text,
  asking_names text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX archive_photos_family_idx ON archive_photos (family_id);

CREATE TABLE face_tags (
  id        text PRIMARY KEY,
  photo_id  text NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  -- 0..1 fractions of the image, so a tag scales with any layout or screen.
  x         numeric(6, 5) NOT NULL CHECK (x >= 0 AND x <= 1),
  y         numeric(6, 5) NOT NULL CHECK (y >= 0 AND y <= 1),
  name      text,
  -- An unconfirmed guess, shown with a question mark. Cleared when a name is
  -- confirmed, because a confirmed name supersedes it.
  guess     text,
  person_id text REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX face_tags_photo_idx ON face_tags (photo_id);

CREATE TABLE photo_clues (
  id          text PRIMARY KEY,
  photo_id    text NOT NULL REFERENCES archive_photos(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX photo_clues_photo_idx ON photo_clues (photo_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Coordination: events, RSVPs, potluck, nudges
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id        text PRIMARY KEY,
  family_id text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind IN ('birthday','anniversary','gathering','appointment','milestone')),
  title     text NOT NULL,
  date      date NOT NULL,
  location  text,
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_family_date_idx ON events (family_id, date);

CREATE TABLE event_people (
  event_id  text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE event_rsvps (
  event_id  text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  attending boolean NOT NULL DEFAULT true,
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE potluck_items (
  id              text PRIMARY KEY,
  event_id        text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item            text NOT NULL,
  claimed_by_name text
);

CREATE INDEX potluck_event_idx ON potluck_items (event_id);

-- "Thinking of you": one tap, zero composition cost, which matters enormously for
-- the least tech-confident members.
CREATE TABLE nudges (
  id            text PRIMARY KEY,
  family_id     text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  from_person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_person_id  text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  action        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nudges_to_idx ON nudges (to_person_id, created_at DESC);

COMMIT;
