-- A memory can have a place as well as a time.
--
-- The short memory form only asked "When was it?". A real user entered "Amboseli national
-- park" there because there was nowhere honest to put the place. That is not bad input; it
-- is a missing field. Keep the human, fuzzy form ("Nana's kitchen", "near the old bridge")
-- rather than pretending every family memory has a geocodable address.

BEGIN;

ALTER TABLE deeds ADD COLUMN where_text text;

COMMIT;
