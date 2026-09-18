# Backend

Postgres + S3-compatible object storage, behind a small TypeScript API.

Locally both are containers (`docker-compose.yml`); in production they are RDS and
S3. **That swap is configuration, not code** — see "Moving to AWS" below.

---

## Running it

```bash
npm run api:install     # once
npm run backend         # docker up + seed + start the API on :4001
```

Then `npm start` (or `npm run web`) as before. Sign in with any seeded account:

| Email | Role | Why it exists |
|---|---|---|
| `sarah@example.com` | **admin** | The Family Champion. Can rename the circle and invite people. |
| `claire@example.com`, `dave@example.com`, `nana@example.com`, `marcus@example.com`, `maya@example.com` | member | Ordinary members. |
| `leo@example.com` | **child** | Exists to prove audience filtering: he must never receive `adults` content. |

Password for all of them: `familyfirst2024`. Dev fixture only.

Useful: `npm run db:psql`, `npm run api:reseed`, `npm run db:reset` (destroys volumes),
and the MinIO console at <http://localhost:9003>.

### If Expo Go says the server is unreachable

The API binds `0.0.0.0`, so it is reachable on the LAN — but two hosts have to be
right, and both are now derived rather than hard-coded:

| What | How it resolves | Override |
|---|---|---|
| API host | `Constants.expoConfig.hostUri` (the host Expo Go connected to), falling back to the bundle's `scriptURL` | `EXPO_PUBLIC_API_URL` |
| Media host | server-side LAN detection in `config.ts` | `STORAGE_PUBLIC_URL` |

`localhost` is only ever correct for a browser on the dev machine. On a phone it means
*the phone*, which is why this failure looks exactly like a dead server.

Two bugs made it look that way here, and both are worth remembering:

```js
// WRONG: ?? binds tighter than ?: so this is ((a ?? b) ? c : d)
const scriptUrl = a?.scriptURL ?? __DEV__ ? ORIGIN : undefined;   // always undefined
```

It silently resolved every device request to `localhost`. The lesson is not "add
parens" — it is that a fallback chain whose failure mode is a *plausible wrong value*
needs a test, because nothing else will notice. `resolveBaseUrl` now covers ten shapes
including tunnels and production bundles.

The second was a bad default: media URLs were signed for `localhost` unless you set
`STORAGE_PUBLIC_URL` by hand. A default that breaks the moment you pick up a phone is
the wrong default, however well documented.

The app now logs `[api] base URL: …` on launch, and a transport failure names the
address it tried — which is what separates "not running" from "wrong host".

### Ports are deliberately non-default

5432, 5433, 9000 and 9001 were already in use on the development machine by other
projects. Postgres is on **5434** and MinIO on **9002/9003** so the API cannot
silently connect to another project's database — a far worse outcome than a port
clash, because it looks like it works.

---

## The security model

The old client filtered content by audience in its selectors. That is fine for a
prototype and unacceptable for a real backend: anybody can call an HTTP API with
their own client. The privacy promise is now enforced **in SQL**, on the server.

Two predicates do nearly all the work (`server/src/access.ts`):

1. **Family isolation.** Every query is scoped to `family_id` taken from the verified
   token, never from the request. A client cannot ask for another family's rows
   because it has no way to name one.
2. **Audience.** A child account's queries are constrained to
   `audience = ANY('{everyone,branch}')`. It is a SQL fragment appended to every
   content query, not an `if` a route can forget.

Membership is re-checked against the database on **every** request, not merely
trusted from the token. A token outlives a change of circumstance: somebody removed
from a family, or demoted to a child account, must lose access immediately rather
than whenever their token happens to expire.

Deliberate details:

- **An audience miss returns 404, not 403.** Telling a child account that an
  adults-only story exists is itself a leak.
- **Login is timing-safe about existence.** "No such user" and "wrong password"
  return the same message, and the password is still hashed against a dummy when the
  user is absent. For a private family app, the mere fact that an address is
  registered is worth protecting.
- **Media is never public.** Rows store an object *key*; the API mints a short-lived
  presigned GET per response. A persisted URL would be either already expired or
  permanently public.
- **Invitations are single-use, expiring and revocable**, redeemed under
  `SELECT ... FOR UPDATE` so two people tapping the same link cannot both consume it.
- **Uploads are an allow-list**, and SVG is not on it — an SVG in a media bucket that
  is later served to a browser is a stored-XSS vector.
- **Passwords use scrypt** from Node's own crypto, not bcrypt/argon2. Both of those
  are native addons: a build step and a platform-specific binary, with a real chance
  of "works on the laptop, fails in the Lambda". This file gets deleted when Cognito
  takes over, so its only job is to be correct and boring meanwhile.

---

## Schema notes

`server/migrations/001_init.sql`, 36 tables. The rules that are load-bearing:

- **Every content table carries `family_id`**, even where it is derivable by join.
  That is what keeps the security predicate a one-liner and makes a later move to
  Postgres RLS mechanical.
- **`timestamptz` everywhere, never `timestamp`.** This family spans Leeds and
  Vermont; "when did Nana post this" must not depend on the server's clock zone.
- **`DATE` columns are read as strings, not JS `Date`.** The driver's default parse
  produces local midnight, which shifts the day backwards west of UTC — a birthday
  landing on the wrong date is exactly the bug this product cannot afford.
- **Fuzzy dates keep both forms.** `when_text` is what the family typed ("Summer of
  1978", "circa 1890"); `when_date` is the sortable value *when one can be derived*.
  Never destroy the human phrasing to satisfy a date parser.
- **Domains, not enums.** `CREATE DOMAIN audience AS text CHECK (...)` — adding a
  value to a PG enum needs `ALTER TYPE` and cannot run in a transaction alongside a
  table rewrite, and this product will certainly grow new tags and reaction kinds.
- **`emergency_cards` has no audience column.** There is no legitimate value other
  than "adults", so the route enforces it rather than leaving it as data somebody
  could set wrongly.
- **An unclaimed `care_tasks.claimed_by_id` (NULL) is the product's most important
  state.** The failure mode of family care is diffusion of responsibility, not
  disagreement.

### People are not users

Most people in a family tree never get an account — the dead, the very young — and
that is the normal case, so `people` and `users` are separate tables joined by
`memberships.person_id`.

Enforcing this surfaced a **real latent bug**: `mockData.ts` used *user* ids
(`u_sarah`) as deed authors and reactors, while chat used *person* ids. The client
was inconsistent with itself — `store.tsx` keyed deed reactions by `currentUser.id`
but message reactions by `currentUser.personId` — so a user's own applaud did not
read back as "mine". Nothing caught it because nothing enforced the relationship.
The foreign key rejected it outright.

---

## Seeding

`server/src/seed.ts` **imports `src/mockData.ts` directly** rather than restating the
content. That is the point: the fixture stays the single source of truth, so the
seeded database is provably the same family the design was built against
(`design/screen.png`) and the two cannot drift.

Photos are **fetched and stored as real objects in MinIO**. Keeping the Unsplash URLs
in the database would defeat the exercise — the app would still be loading from
someone else's CDN, media would never exercise the storage path, and the first
offline demo would show grey boxes. Downloads are cached in `server/.seed-cache/`.

Voice notes get rows **without** objects: the fixture's audio is `mock://`
placeholders because recording is still presentational in the client. The transcript
and duration are real data the UI renders; there are simply no bytes yet, and
`storage_key` says so (`pending/...`).

---

## Everything is wired

| Slice | Endpoints |
|---|---|
| Auth, family, invitations, members | `/auth/*`, `/family/*` |
| People + the family graph | `/people` |
| Deeds, comments, reactions, flags | `/deeds/*` |
| Chat threads + messages + voice notes | `/threads/*` |
| Care circles, tasks, meds, notes, meals, emergency card | `/care`, `/care/*` |
| Recipes, face tagging, events, nudges | `/recipes`, `/archive/*`, `/events`, `/nudges` |
| Media upload / presigned reads | `/media` (MinIO) |

Client-side audience filtering in `store.tsx` was **kept** even though the server now
enforces it. It is defence in depth, and it costs nothing.

## mockData.ts must never reach a device

`src/mockData.ts` describes **one specific family** (the Millers). It is the fixture
that seeds a database, and **only `server/src/seed.ts` may import it.**
`npm run lint:fixtures` fails the build on any other import.

That rule exists because breaking it was a **privacy bug**, not a cosmetic one. Eleven
slices of `initialState` were left pointing at `seed.*` when the API landed, and
`HearthScreen` imported the fixture directly. So a family who had just signed up opened
the app and found, inside their own private circle:

- Nana Ruth's medication schedule and her emergency card
- Marcus's photographs, captioned "Today's Chuckle"
- Somebody else's recipes and unidentified family photographs

In a product whose single promise is *"visible only to the people in your family
circle"*, shipping a stranger's health data as a placeholder is the worst thing the app
could do.

**Why it survived so long:** every test used the seeded Miller database, where fixture
data and real data are indistinguishable. Only a fresh signup reveals it — and that is
the one path nobody re-runs after the first day. The lint rule replaces the vigilance
that plainly was not there, and the new-user path now has its own test.

The incoherence was the tell, in hindsight: Care rendered *"Have an update for **them's**
Circle?"* and "1 of 3 done" for tasks that did not exist, because fixture rows were
being joined against an empty family.

## Empty states are a first-class screen

Every family starts empty, so an empty state is the **first thing most users ever see**
in each tab. `src/components/EmptyState.tsx` follows four rules:

- Name what belongs here in the family's language ("Nobody has written down a recipe
  yet", never "No records found").
- Say **why** it is worth doing. A blank archive is not self-explanatory.
- Offer **exactly one** next action. Two choices at zero content is a decision a new
  user cannot make.
- Never look like an error — warm tone, no alert colour.

Two of them do real work beyond copy:

- **Care** cannot offer "start a circle" when the tree is empty, because a circle is
  care *for a specific person*. With relatives it lists them as one-tap choices; without
  them it routes to the family tree. Sending somebody to an empty picker is how you lose
  them on day one.
- **Chat** creates the "All Family" thread on one tap. A Chat tab with nowhere to type
  reads as broken rather than new.

The Hearth additionally shows **Three things to set up** while the circle is empty —
invite someone, add people, record one memory, in that order, because a family app with
one member is a diary. It is not dismissible: it leaves on its own when the work is done,
and a dismissed checklist that cannot be recovered is worse.

---

## Moving to AWS

Everything environment-specific is in `server/src/config.ts`; `server/.env.example`
documents both worlds. The migration is:

| Local | AWS | Change |
|---|---|---|
| `postgres` container | RDS Postgres | `DATABASE_URL`, `DATABASE_SSL=true` |
| `minio` container | S3 | **delete** `STORAGE_ENDPOINT` |
| static storage keys | IAM role | **omit** `STORAGE_ACCESS_KEY`/`SECRET_KEY` |
| dev signing key | Secrets Manager | `AUTH_SECRET` |

Two of those are removals, which is the useful part:

- The API already talks to MinIO through `@aws-sdk/client-s3`, so S3 needs no new
  dependency and no new code path. `STORAGE_ENDPOINT`'s *absence* is what switches
  the SDK from MinIO's path-style addressing to S3 virtual-host addressing.
- Dropping the static credentials makes the SDK fall back to the task/instance IAM
  role, which is strictly better than long-lived keys in environment variables.

The schema is plain Postgres with no extensions, so `npm run migrate` works against
RDS unchanged. When Cognito takes over auth, `server/src/auth.ts` is deleted rather
than ported — `access.ts` keeps its shape, only the token verification changes.

### Not done yet

- **Presigned uploads.** Media currently streams through the API. At scale the client
  should PUT to a presigned S3 URL directly so bytes never transit the API. The
  `storage.ts` seam is where that goes.
- **RLS.** The single-predicate security model was designed for it, but policies are
  not written; enforcement is in the query layer today.
- **Refresh tokens.** Access tokens are 12h and there is no rotation.
- **Orphan sweep.** A failed upload can leave an object with no row (deliberately —
  the reverse would be a permanently broken image).
