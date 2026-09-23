# What else belongs in the Archive?

Working note. The Archive tab currently has two halves — **Recipe Box** and
**"Who Is This?"** — and the question is what else sits beside them.

---

## First: the Archive is not a folder for everything old

The tab already competes with two things that overlap it, and the boundary needs stating
before anything gets added, or the Archive becomes a junk drawer:

| Surface | What it is for | Test |
|---|---|---|
| **Archive** | **Objects** with their own identity, worth curating and returning to. | Would somebody open this *deliberately*, months later, to find a specific thing? |
| **Kinship / Profiles** | **People**, and what is true about them. | Is this a fact about one person? |
| **Deeds & memories** | **Events and stories** — things that happened. | Does it have a "when"? |

A recipe passes the object test: it has a name, you go looking for it, you cook from it.
"Grandad's funeral" does not — it is an event, and it now has `inMemory` for exactly that.

So the rule is: **the Archive holds heirlooms — things a family would physically put in a
box.** That is also why "Who Is This?" belongs there despite being a task rather than an
object; the shoebox of unlabelled photographs *is* the heirloom.

## The candidates, ranked by (emotional value ÷ effort)

### 1. The Letter Box — handwritten letters, cards, diaries · **build first**

Every family has a bundle of these in a drawer, they are physically decaying, and nobody
has ever been able to search them. `ideas.md` already lists handwriting OCR (P2) for
"letters, recipe cards, diaries → searchable".

Why it is the strongest candidate:

- **It reuses the recipe pattern almost exactly.** Photograph of the original (the primary
  source, in their hand) + a typed transcription + attribution + provenance. The
  `recipes` table is nearly the right shape already.
- **The transcription is the feature**, and it is the honest kind of AI: OCR reduces work,
  it does not manufacture memory. A human confirms the text, which is the same
  human-in-the-loop rule the product already applies to face tagging.
- **It is a race**, like face tagging: the people who can read Great Aunt Eleanor's
  handwriting are the ones we are losing.

### 2. The Voice Vault — recordings that are primary sources · **build second**

`ideas.md` line 26 is explicit: *"a voice note **is** a primary source."* Right now voice
notes live in Chat, where they scroll away forever, and the schema already stores
`transcript` on `media`. So the material exists and is being lost to the feed.

This is not a new data type — it is **a view over audio that has been promoted**, plus a
prompt list ("ask her about her first job"). Cheap, and it turns the highest-value thing
elders produce into something you can find again.

### 3. Objects & Heirlooms — the ring, the clock, the cabin · **build third**

A photograph of the object, its story, and **who has it now**. That last field is the
whole feature: "where did Grandma's ring go?" is a real and slightly poisonous family
question, and an archive that answers it prevents an argument. It also connects to the QR
"story stones" idea (P3) without needing it.

### 4. Sayings & Family Dialect — the private language · **cheap, delightful**

`ideas.md` P3: *"Every family has a private dialect; nobody records it."* Tiny — a phrase,
who says it, what it means. Almost no schema. High charm per line of code, and it is the
kind of thing that makes an archive feel like *this* family.

### 5. Traditions — the recurring ones · **worth it, but not here**

`ideas.md` P2, and the reasoning is sharp: *"Traditions die when the one person who
organised them stops."* But a tradition is a **recurring event**, so it belongs with
`events` and the Hearth's radar, not in a box of objects. Noted so it does not get
mis-filed into the Archive because it sounds heirloom-ish.

### 6. Document Vault — wills, deeds, passports · **NOT in the Archive**

`ideas.md` P2, and *"Where is the will?"* is genuinely awful to face. But this must not
sit next to the recipes:

- It is **admin-controlled and adults-only by construction**, with a different security
  posture from the rest of the app (encrypted at rest, tighter audience, access logging).
- Its purpose is **retrieval under stress**, not browsing. It shares that with the Care
  tab's offline emergency card, which is the neighbour it belongs beside.

Putting a will one swipe from a cardamom bread recipe teaches the wrong mental model about
how protected it is. **Care, or Settings — not Archive.**

## Built

The Archive now has five sections. The tab row scrolls, kept as one horizontal strip rather
than a grid — a grid reads as a menu of separate features, whereas a strip reads
as "parts of one archive", which is what they are.

### The Letter Box (`letters`, `letter_pages`)

Photograph of the original + transcription + who wrote it, who it was for, and **who holds
it now**. Kinds: letter, card, diary page, note, telegram.

The design decisions that carry weight:

- **The photograph leads, above the title.** A letter is an object before it is text; the
  handwriting is the part that is really theirs. Leading with the transcript would turn an
  heirloom into a database row.
- **`transcript_confirmed` is a real column.** A machine reading of somebody's
  grandmother's handwriting is a *guess*, so an unconfirmed transcript renders behind an
  amber "Not checked yet — read it against the original" flag and is never presented as her
  words. Typing it yourself counts as confirmation, because a human has read the
  handwriting and decided. This is the same human-in-the-loop rule the product applies to
  face tagging, and it is what makes OCR acceptable here at all.
- **Transcription is never demanded.** A family that photographs fifty letters and types
  none has still saved them. Blocking the save on a wall of typing means the photographs
  never happen either.
- **Multi-page originals are ordered and numbered.** Page 2 before page 1 is worse than no
  scan.
- Dates are fuzzy (`when_text`): "postmarked but undated" is frequently all there is.

### The Voice Vault (`voice_recordings`)

**No new storage.** The audio already lives in `media` with transcripts; a
`voice_recordings` row is a *curation decision* — somebody said this recording is worth
finding again. That is the whole difference between an archive and a feed.

- **The prompt comes first, even when the vault is full.** A family that does not know what
  to ask records nothing, and "tell me about your life" gets silence. The questions are
  deliberately about ordinary life — "what did the house you grew up in smell like" gets a
  five-minute answer. Answered prompts drop off the list, computed rather than stored.
- **The question is kept beside the answer.** In fifty years nobody will remember what was
  asked, and an answer without its question is half a record.
- **Chat now offers "Keep the voice" alongside "Add to the journal".** Offering only the
  latter is what let recordings scroll away: a family had to decide the note was a *story*
  before anything preserved it, when often the point is simply that this is how she sounded.
- `UNIQUE (media_id)` plus an idempotent 200 response, so keeping twice is not a duplicate.
  A photo posted to the vault gets a 422 — only audio belongs.

### Objects & Heirlooms (`objects`, `object_custody`)

The ring, the carpentry chest, the Bible with the names in the front. A photograph, the
story, and — the actual feature — **who has it now**.

- **Custody is a chain, not a field.** Letters get a single `held_by_name`, which is right
  for them: who happens to hold a 1954 Christmas card is incidental. For an object it is the
  opposite — the passing-on *is* the story. Grandma to Sarah to Maya is three generations of
  trust recorded in two rows, and collapsing that to a current-holder field throws away
  exactly the part worth keeping. The current holder is still denormalised onto `objects`
  so the shelf lists cheaply.
- **`lost` is a first-class status, not a missing row.** Recording that nobody knows where
  the Bible went is real information, and it is what stops the same question being asked at
  every funeral. Lost objects sort to the top of the shelf, because an object nobody can
  find is the one a family can still act on — somebody may remember the box it went into.
- **The status note carries the lead.** "Last certainly seen at the house clearance in
  November 2018" is useful; a bare "lost" is only sad. A vague absence is what lets an
  object quietly disappear from a family.
- Adding an object writes its first custody row automatically, so a provenance is never
  empty and "who gave it to you" is asked once, at the moment somebody is already thinking
  about it.

### Next

**Sayings & Family Dialect** is the natural next one — a phrase, who says it, what it
means. Almost no schema, high charm per line of code.

## Why not just make everything a `memory` with a tag?

Because the Archive's value is that it is **browsable by object type**. "Show me every
recipe" and "show me every letter" are the queries families make, and a tag on a timeline
entry answers them badly. A recipe has ingredients; a letter has a sender and a date
received; an object has a current custodian. Those are different shapes, not one shape
with labels — which is the same argument that kept `MemoryKind` separate from `DeedTag`.
