-- Recipient membership for scoped Journal entries.
--
-- 'care' and 'branch' were audience labels without per-entry membership on deeds, so the
-- server's broad role filter could return them to every adult in the family. Privacy copy
-- must be backed by rows, not intention.

BEGIN;

CREATE TABLE deed_audience_people (
  deed_id   text NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (deed_id, person_id)
);

CREATE INDEX deed_audience_person_idx ON deed_audience_people (person_id, deed_id);

COMMIT;
