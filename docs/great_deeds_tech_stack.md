# Great Deeds — Tech Stack

## Client (what we are building now)
- **React Native + Expo** (managed workflow, TypeScript). JavaScript/TypeScript means one language,
  the largest talent pool, and no Android Studio / Xcode required to start.
- **Expo Go** on a physical phone for the whole dev loop; **EAS Build** later for store binaries.
- **React Navigation** — bottom tabs + native stack. Boring, documented, accessible.
- **State:** React Context + reducer for V1. It is a small app; do not reach for Redux.
  Swap the context's data source for the real API when the backend lands.
- **Media:** `expo-image-picker` (photo/video), `expo-av` (audio record/playback), `expo-haptics`
  (appreciation microinteractions), `expo-font` (Nunito / Lora).

## Backend — DECIDED AND BUILT

> **This section is now history.** We built **Option D: our own small API over
> Postgres + S3-compatible storage** — containers locally, RDS + S3 on AWS. See
> **`docs/backend.md`** for the schema, the security model and the migration path.
>
> Why not Supabase, given it was the recommendation below: the stated destination is
> AWS. Supabase would have meant adopting its auth, its client SDK and its RLS
> dialect, then unpicking all three later — the "one afternoon" saving would have
> been repaid with interest at exactly the moment the product had real families' data
> in it. The insight that made Supabase attractive still drove the design, though:
> every content table carries `family_id` so that *"you may read a row iff you have a
> membership in its family"* is a single predicate, which is what makes adopting
> Postgres RLS later a mechanical change.
>
> Option C's judgement — "most control, most work; choose only if you already know
> it" — is the tradeoff we took, minus the AppSync/Cognito surface for now.

### The options as they stood
Pick **one** and commit:

**Option A — Supabase (recommended for V1).** Postgres + Row Level Security is a natural fit for
"a row is visible only to members of its family circle". Auth, storage and edge functions included.
RLS lets the privacy promise be enforced by the *database*, not by app code.

**Option B — Firebase.** Faster realtime feed, weaker relational modelling for a family graph.

**Option C — AWS (Cognito + AppSync/Lambda + S3).** Most control, most work. Choose only if you
already know it. Lambda is the right home for the "Famous Deeds" archive-search jobs and for
PDF generation.

## Data model sketch
```
families        id, name, created_by, plan
memberships     user_id, family_id, role(admin|member), joined_at
invitations     token, family_id, created_by, expires_at, used_at
people          id, family_id, name, birth_date, death_date, photo_url, bio, is_living
relationships   from_person, to_person, type(parent|spouse)
deeds           id, family_id, title, when_text, when_date, story, created_by, created_at
deed_people     deed_id, person_id
media           id, deed_id, kind(photo|video|audio), url, width, height, duration
reactions       deed_id, user_id, kind(applaud|inspire|cherish|love)
comments        id, deed_id, user_id, parent_id, body, created_at
flags           deed_id|comment_id, reported_by, reason, status
events          id, family_id, title, date, kind(birthday|anniversary|custom)
```
Every table carries `family_id` so a single RLS policy — *"you may read a row iff you have a
membership in its family"* — secures the entire product.

## Third-party services (later)
- Historical archive API for "Famous Deeds" (paid, per-search → premium gate).
- Gemini API for the Story Assistant and grounded historical context.
- Photo restoration/colorization model (hosted inference).
- Print-on-demand partner for physical books.
- RevenueCat for subscriptions across App Store + Play.

## Security posture
- Enforce circle isolation in the database (RLS), never only in the client.
- Signed, short-lived URLs for all media. No public buckets.
- Invitations: single-use, expiring, revocable.
- Encrypt at rest and in transit; no analytics SDK that ships photo or story content.
