-- Objects & Heirlooms: the ring, the clock, the cabin.
--
-- THE POINT OF THIS TABLE IS CUSTODY. Where did Grandma's ring go is a real and slightly
-- poisonous family question, and an archive that answers it prevents an argument. See
-- docs/archive_contents.md.
--
-- WHY CUSTODY IS A CHAIN AND NOT A FIELD: letters got a single held_by_name, which is right
-- for them -- who happens to hold a 1954 Christmas card is incidental. For an object it is
-- the opposite: the passing-on IS the story. Grandma to Sarah to Maya is three generations
-- of trust recorded in two rows, and collapsing that to a single current-holder field throws
-- away exactly the part worth keeping.

BEGIN;

CREATE TABLE objects (
  id            text PRIMARY KEY,
  family_id     text NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  name          text NOT NULL,

  /*
   * What kind of thing it is. Broad on purpose: an heirloom is whatever a family treats as
   * one, and a list that argues with somebody about whether their father's toolbox counts
   * is a list that stops them adding it.
   */
  kind          text NOT NULL DEFAULT 'keepsake'
                  CHECK (kind IN ('jewellery', 'furniture', 'tool', 'textile', 'book',
                                  'instrument', 'artwork', 'crockery', 'medal',
                                  'property', 'keepsake')),

  -- The story. Why this object matters, in the family's own words.
  story         text NOT NULL DEFAULT '',

  -- Where it came from, and when. Fuzzy like every other date in this product: 'brought
  -- over from Cork, we think 1911' is a real answer and a date picker cannot hold it.
  origin_text   text,
  origin_year   text,

  -- Who it originally belonged to. Often the person the whole object means.
  origin_person_id text REFERENCES people(id) ON DELETE SET NULL,
  origin_person_name text,

  /*
   * Where it is NOW.
   *
   * Denormalised from the custody chain below rather than derived at read time: the Archive
   * lists objects with their current holder, and computing that per row from a chain is a
   * join and a sort for information the family cares about most. The API keeps it in step
   * inside the same transaction that adds a custody row.
   */
  held_by_person_id text REFERENCES people(id) ON DELETE SET NULL,
  held_by_name  text,
  where_kept    text,

  /*
   * Status. 'lost' and 'givenAway' are honest states worth recording -- 'we do not know
   * where it went' is real information, and it stops the same question being asked every
   * few years. 'destroyed' exists because a house fire is part of a family history too.
   */
  status        text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held', 'lost', 'givenAway', 'destroyed')),
  status_note   text,

  image_media_id text REFERENCES media(id) ON DELETE SET NULL,

  audience      audience NOT NULL DEFAULT 'everyone',
  created_by    text REFERENCES people(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX objects_family_idx ON objects (family_id, created_at DESC);
CREATE INDEX objects_holder_idx ON objects (held_by_person_id);
CREATE INDEX objects_origin_person_idx ON objects (origin_person_id);

-- Several photographs per object: a clock face, its movement, the inscription underneath.
CREATE TABLE object_photos (
  object_id text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  media_id  text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (object_id, media_id)
);

/*
 * The custody chain: who has held this object, in order.
 *
 * This is the feature. A row per handover, oldest first, so the object carries its own
 * provenance -- which is what an heirloom IS, as distinct from an old thing.
 *
 * person_id is nullable and name is free text, because an object may sit with somebody who
 * will never have an account: a cousin, an ex-spouse, a museum.
 */
CREATE TABLE object_custody (
  id          text PRIMARY KEY,
  object_id   text NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  person_id   text REFERENCES people(id) ON DELETE SET NULL,
  holder_name text NOT NULL,

  -- Fuzzy, like everything else: 'after the funeral' is how families actually date these.
  from_text   text,
  from_date   date,
  -- How it came to them. 'She left it to me' is the sentence that matters.
  note        text,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX object_custody_object_idx ON object_custody (object_id, from_date NULLS FIRST, created_at);

COMMIT;
