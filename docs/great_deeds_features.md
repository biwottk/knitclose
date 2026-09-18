# Great Deeds — Feature Specification

> Working product name: **Close Knit** (a.k.a. "Great Deeds"). Repo/domain: `knitclose`.
> A private, invitation-only social app where families preserve their history and celebrate achievements.

## Naming note
- **Domain / repo:** `knitclose` (the only domain available).
- **Product name candidates:** Close Knit, Great Deeds, Kin, Heirloom.
- Decision deferred to just before store submission. The codebase uses neutral naming
  (`APP_NAME` in `src/config.ts`) so the display name can change in one place.

---

## 1. The Interactive Family Tree
The visual and structural backbone of the app.

- Add profiles for living and deceased relatives.
- Link profiles by relationship: parent, child, spouse.
- Profile photo per member.
- Tapping a node opens that person's Profile screen (their "digital monument").
- Pan-and-zoom canvas, smooth and tactile.

**Data implications:** members need `id`, `name`, `birthDate?`, `deathDate?`, `photoUri?`,
`parentIds[]`, `spouseIds[]`. Relationships are edges, not nesting — a tree is a graph.

## 2. The "Great Deed" Story Engine
A structured post type, richer than a status update.

Required fields:
- **Who** — one or more tagged family members.
- **What** — the deed / achievement (title).
- **When** — a date or a fuzzy era ("Summer of 1978").
- **The Story** — long-form narrative.

Media:
- Photos, video clips (≤ 60s), audio recordings (capture a story in someone's own voice).

Tags: `#Career`, `#Kindness`, `#Achievement`, `#MilitaryService`, `#Community`, `#Faith`, `#Craft`.

## 3. The Family Feed & Appreciation
- Chronological, private, families-only timeline.
- Deeds, new photos, birthdays, anniversaries.
- **Appreciation buttons** instead of a generic Like: **Applaud**, **Inspire**, **Cherish**, **Love**.
- Threaded comments, prompted as "Add to the story…" rather than "Write a comment".

## 4. Secure, Invitation-Only Family Circles
Privacy is the product.

- One or more **Family Admins** control the Circle.
- Join **only** via a unique, expiring invitation link created by an Admin.
- No public search, no friend-adding, no discoverability of any kind.
- Every screen visually reinforces the closed loop (lock icon + "Only your family can see this").

## 5. Shared Family Calendar
- Auto-populates birthdays and anniversaries from Family Tree profiles.
- Members add shared events ("Family Reunion 2026").
- Reminders for upcoming milestones.

## 6. "On This Day" & Story Prompts
- **On This Day:** "On this day 80 years ago, Grandpa Joe was born."
- **Story Prompts:** weekly nudges — "Ask an elder relative about their first job."
- Purpose: solve the blank-feed / blank-page problem.

## 7. Digital "Heirloom" Exports
The ultimate payoff and the anchor of the paid tier.

- **Generate Family Book** — one-click export of stories, deeds and photos to a printable PDF / e-book.
- **Profile Export** — download everything attached to a single ancestor.
- Doubles as the "no lock-in" data-portability guarantee.

---

## AI features (deliberately deferred, architected for)
Launch with the manual core. Build so these drop in later.

### A. Bringing photos to life
- AI photo enhancement, scratch repair, colorization of old B&W photos.
- AI photo animation of still portraits (high emotional impact, slightly uncanny — make it opt-in).

### B. Effortless organization
- Facial recognition: tag "Grandma Sarah" a few times, get "Is this also her?" suggestions.
- Handwriting transcription (OCR) for letters, recipe cards, diary pages → searchable text.
- Conversational search: "Show me Mom's deeds from the 1990s."

### C. Deeper storytelling (GenAI) — highest value
- **AI Story Assistant** (#1 recommendation): bullet points in, warm narrative draft out.
  The user always edits and approves; the AI never publishes.
- **Personalized story prompts:** "10 deeds logged for Grandma, only 1 for Grandpa."
- **Historical context (grounded):** logging a 1945 deed offers an optional "what else happened in 1945" box.

**Non-negotiable rule:** AI output is always a *draft* attributed to the user, never presented
as family fact. Family history must stay trustworthy.

---

## "Famous Deeds" (V2.1+)
Search public archives (newspapers, records) for an ancestor and attach verified findings.

1. Trigger: user creates a Deed, or a background task runs on a Tree profile.
2. A server function calls a paid historical-archive API with name + date + place.
3. **Human-in-the-loop is mandatory** — archives return fuzzy matches ("J. Smith").
4. Potential matches are queued for **Family Admin review**, never auto-attached.
5. On confirmation the clipping + citation attach to the ancestor's profile.

Monetization fit: archive searches cost real money per call → premium-only "automated discovery".
This is the clearest upgrade incentive in the product.
