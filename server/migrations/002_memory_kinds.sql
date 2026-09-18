-- Memory kinds, and the reactions that belong to each.
--
-- WHY: 'Deed' was doing two jobs -- a permanent attributed container (right) and a claim
-- that the contents were admirable (wrong). Families also need to record a cancer scare, a
-- funeral, a nickname nobody can explain. None of those file under "Great Deeds", so they
-- were not being written down at all and the archive was becoming a highlight reel.
--
-- KIND IS REGISTER, NOT TOPIC. deed_tags already carries topic (Career, Kindness...). This
-- is the emotional key the entry is written in, and it exists as a column rather than a tag
-- because it CHANGES BEHAVIOUR: which reactions are offered, and whether the entry may be
-- resurfaced unprompted by On This Day. A tag that changed no behaviour would be decoration.
--
-- See docs/memory_kinds.md for the argument.

BEGIN;

CREATE DOMAIN memory_kind AS text
  CHECK (VALUE IN ('greatDeed', 'memory', 'milestone', 'hardTime', 'inMemory', 'lore'));

-- Existing rows are all achievements written under the old framing, so 'greatDeed' is the
-- honest default for them. New entries default to 'memory': the commonest thing a family has
-- to say is "I remember this", and the 4-step wizard is the wrong shape for it.
ALTER TABLE deeds ADD COLUMN kind memory_kind NOT NULL DEFAULT 'greatDeed';

ALTER TABLE deeds ALTER COLUMN kind SET DEFAULT 'memory';

/*
 * Resurfacing consent.
 *
 * On This Day is the product's cheapest engagement engine, and for most content it is a
 * gift. For a bereavement or a serious illness it is a wound: ideas.md calls an automated
 * birthday reminder for someone who died "the kind of thing that makes a family delete an
 * app forever", and unprompted resurfacing of a miscarriage on its anniversary is the same
 * error.
 *
 * So it is stored per row rather than inferred from kind at query time. The default is
 * derived from kind (see the UPDATE below), but a family may decide that a particular hard
 * time IS one they want to see come round again -- "the year we nearly lost Dad, and didn't"
 * is sometimes exactly what somebody wants resurfaced. That is their call, not ours.
 */
ALTER TABLE deeds ADD COLUMN may_resurface boolean NOT NULL DEFAULT true;

UPDATE deeds SET may_resurface = false WHERE kind IN ('hardTime', 'inMemory');

-- On This Day filters on (family, may_resurface, when_date), so the index matches.
CREATE INDEX deeds_resurface_idx ON deeds (family_id, may_resurface, when_date)
  WHERE when_date IS NOT NULL;

CREATE INDEX deeds_family_kind_idx ON deeds (family_id, kind);

/*
 * New reaction kinds.
 *
 * 'hold' is "holding you in mind" -- the gesture a family actually wants for bad news, and
 * the one no social product offers because it cannot be dressed up as engagement.
 * 'strength' and 'laugh' complete the registers that Applaud/Inspire/Cherish/Love cannot
 * cover: you do not applaud a funeral, and "Cherish" is not what a story about the dog
 * eating a birthday cake deserves.
 *
 * A DOMAIN cannot be altered in place, so the column is retyped. Doing it in one
 * transaction means there is no window where deed_reactions has no constraint at all.
 */
ALTER TABLE deed_reactions ALTER COLUMN kind TYPE text;
DROP DOMAIN reaction_kind;

CREATE DOMAIN reaction_kind AS text
  CHECK (VALUE IN ('applaud', 'inspire', 'cherish', 'love', 'hold', 'strength', 'laugh'));

ALTER TABLE deed_reactions ALTER COLUMN kind TYPE reaction_kind;

COMMIT;
