-- The Letter Box and The Voice Vault.
--
-- Two new kinds of heirloom in the Archive. See docs/archive_contents.md for why these two
-- and not a document vault (different security posture, belongs beside Care's emergency
-- card) or traditions (a recurring event, so it belongs with events).
--
-- THE RULE THESE FOLLOW: the Archive holds OBJECTS -- things a family would physically put
-- in a box, that you go looking for deliberately months later. That is why each gets its own
-- table with its own shape rather than becoming a tagged timeline entry: a letter has a
-- sender and a date received, a recipe has ingredients, an object has a custodian. Those are
-- different shapes, not one shape with labels.

BEGIN;

-- ---------------------------------------------------------------------------
-- The Letter Box: handwritten letters, cards, diary pages
-- ---------------------------------------------------------------------------

/*
 * Deliberately modelled on recipes, because that pattern is proven: a photograph of the
 * ORIGINAL is the primary source, and a typed version exists so the thing can be searched
 * and read on a phone.
 *
 * The photograph is not optional in spirit -- a letter with no image is just a quotation --
 * but it is nullable so somebody can type up a letter they have only heard read aloud, or
 * add the image later. Refusing the entry would lose the words.
 */
CREATE TABLE letters (
  id            text PRIMARY KEY,
  family_id     text NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  kind          text NOT NULL DEFAULT 'letter'
                  CHECK (kind IN ('letter', 'card', 'diary', 'note', 'telegram')),

  title         text NOT NULL,

  -- Who wrote it, and who it was for. Free text alongside optional person links, because
  -- most letters in a shoebox are from people who will never have an account -- and some are
  -- from people the family can no longer identify at all.
  from_name     text,
  from_person_id text REFERENCES people(id) ON DELETE SET NULL,
  to_name       text,
  to_person_id  text REFERENCES people(id) ON DELETE SET NULL,

  -- Fuzzy on purpose, exactly like deeds.when_text: 'spring 1944' and 'postmarked but
  -- undated' are real answers, and a date parser cannot hold either.
  when_text     text,
  when_date     date,

  /*
   * The transcription, and whether a human has confirmed it.
   *
   * OCR is the honest use of AI here -- it reduces work rather than manufacturing memory --
   * but a machine reading of somebody's grandmother's handwriting is a GUESS until a person
   * says otherwise. transcript_confirmed is what lets the UI show unconfirmed text as a
   * draft to be checked rather than as her words. A human always approves what enters the
   * archive.
   */
  transcript    text,
  transcript_confirmed boolean NOT NULL DEFAULT false,

  -- Where the physical object came from. 'Great Aunt Eleanor's attic box' is the kind of
  -- detail that makes an archive feel true.
  provenance    text,
  -- Who physically holds the original. A family that knows where the letters ARE keeps them.
  held_by_name  text,

  -- Single-image fast path (a postcard). Multi-page originals use letter_pages below.
  image_media_id text REFERENCES media(id) ON DELETE SET NULL,

  -- An elder reading it aloud: the words in the writer's language, in a living voice that
  -- knew them. Extraordinary material, and cheap to capture.
  reading_media_id text REFERENCES media(id) ON DELETE SET NULL,

  audience      audience NOT NULL DEFAULT 'everyone',
  created_by    text REFERENCES people(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX letters_family_idx ON letters (family_id, when_date);
CREATE INDEX letters_from_person_idx ON letters (from_person_id);

-- Multi-page originals. Ordered, because page 2 before page 1 is worse than no scan at all.
CREATE TABLE letter_pages (
  letter_id text NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  media_id  text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (letter_id, media_id)
);

-- ---------------------------------------------------------------------------
-- The Voice Vault
-- ---------------------------------------------------------------------------

/*
 * WHY THIS IS NOT A NEW MEDIA TYPE: ideas.md says it plainly -- a voice note IS a primary
 * source. The recordings already exist in media with transcripts; the problem is that they
 * live in Chat, where they scroll away and are never found again.
 *
 * So this table is a CURATION LAYER, not storage: a row here means somebody decided this
 * recording is worth keeping and finding. The audio stays in media and a vault entry points
 * at it. That is the difference between an archive and a feed.
 */
CREATE TABLE voice_recordings (
  id          text PRIMARY KEY,
  family_id   text NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  media_id    text NOT NULL REFERENCES media(id) ON DELETE CASCADE,

  title       text NOT NULL,
  -- Whose voice this is. The single most important field in the table.
  speaker_name text NOT NULL,
  speaker_person_id text REFERENCES people(id) ON DELETE SET NULL,

  -- What was being answered, when the recording came from a prompt. Preserving the question
  -- makes the answer legible in fifty years, when nobody remembers what was asked.
  prompt      text,

  when_text   text,
  when_date   date,

  -- Set when the recording was lifted out of a chat message, so the vault can show where it
  -- came from and Chat can stop offering to promote it twice.
  from_message_id text REFERENCES messages(id) ON DELETE SET NULL,

  audience    audience NOT NULL DEFAULT 'everyone',
  created_by  text REFERENCES people(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One vault entry per recording: promoting the same voice note twice is always a mistake.
  UNIQUE (media_id)
);

CREATE INDEX voice_recordings_family_idx ON voice_recordings (family_id, created_at DESC);
CREATE INDEX voice_recordings_speaker_idx ON voice_recordings (speaker_person_id);

COMMIT;
