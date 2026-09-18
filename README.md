# knitclose

**Close Knit** — a private, invitation-only mobile app where families preserve their
history and celebrate each other's achievements ("Great Deeds").

> The repo and domain are `knitclose` because that was the domain available.
> The product name is still being decided; it lives in one place, `src/config.ts`,
> so changing it later is a one-line edit.

---

## Run it on your phone in about two minutes

You do **not** need Android Studio or Xcode. You **do** need Docker running, because
the app now talks to a real database.

1. Install **Expo Go** on your phone (App Store / Google Play).
2. In this folder, run:
   ```bash
   npm install         # only needed the first time
   npm run api:install # only needed the first time
   npm run backend     # Postgres + MinIO + seed + API on :4001
   ```
3. In a second terminal:
   ```bash
   npm start
   ```
4. A QR code appears in the terminal. **iPhone:** scan it with the Camera app.
   **Android:** scan it from inside Expo Go.
5. Sign in as `sarah@example.com` / `familyfirst2024`. Edit any file, save, and it
   updates instantly.

Your phone and computer must be on the same Wi-Fi. If the QR code won't connect,
run `npm start -- --tunnel`.

Both the API host and the media host are now **derived from the Expo dev server**, so
a phone on the same Wi-Fi works with no configuration. Set `EXPO_PUBLIC_API_URL` (app)
or `STORAGE_PUBLIC_URL` (media) only to override — e.g. a tunnel, or a VM whose
address cannot be inferred.

### "Server unreachable" on Expo Go

Almost always one of three things. The app logs `[api] base URL: …` on launch — check
that first, because it distinguishes all three:

1. **It says `localhost`.** The dev-server host could not be detected, and on a phone
   `localhost` is the phone itself. Set `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4001`.
2. **It says the right IP but nothing loads.** The API is not running (`npm run api`),
   or the phone is on a different network (guest Wi-Fi and AP isolation both do this).
3. **Text loads but photos do not.** Media is signed for a different host than the API.
   `server/src/config.ts` auto-detects the LAN address in dev; override with
   `STORAGE_PUBLIC_URL` if it picked the wrong interface (VPNs and `docker0`-style
   bridges are the usual culprits).

> **Metro's port is not always 8081.** If another project's container holds 8081, Expo
> silently falls back to 8082, 8083, … Nothing breaks — the app derives the API host
> from whichever port Expo actually used — but `npm run web` and `npm run shots` take
> an explicit URL, so check the port Expo printed before pointing tools at it.

### Seeded accounts
All use the password `familyfirst2024`. `sarah@` is the **admin**; `leo@` is a
**child** account, which exists to prove that adults-only content is filtered by the
server rather than the client.

### Other commands
| Command | What it does |
|---|---|
| `npm start` | Dev server + QR code for Expo Go |
| `npm run web` | Open the app in a browser (fastest way to check layout) |
| `npm run backend` | Postgres + MinIO (Docker), seed, then the API on `:4001` |
| `npm run api` | Just the API (containers already up) |
| `npm run api:reseed` | Wipe and reseed the database from `src/mockData.ts` |
| `npm run db:psql` | A psql shell in the database container |
| `npm run db:reset` | Destroy the volumes and start clean |
| `npm run typecheck` | TypeScript check, no build |
| `npm run check` | typecheck + both lint rules, in one command |
| `npm run lint:icons` | Fails if any emoji crept back into `src/` (see design system below) |
| `npm run lint:fixtures` | Fails if runtime code imports `src/mockData.ts` (see below — this was a privacy bug) |
| `npm run shots` | Screenshots every screen in headless Chrome and **fails on any page error** |
| `npm run assets` | Regenerate `assets/` from the source logo artwork |

---

## What's built

### The five tabs

The tab order encodes the strategy from `ideas.md`: **daily utility first, permanence
second.** A family app whose first tab is a family tree is a museum — and the real
competitor is the family WhatsApp group, which wins on daily habit.

| Tab | File | What it does |
|---|---|---|
| **Hearth** | `src/screens/HearthScreen.tsx` | The daily open. Greeting, **two speeds of posting**, one-tap "Thinking of You" pings, heirloom radar, care glance, On This Day |
| **Chat** | `src/screens/ChatScreen.tsx` | Scoped threads, **hold-to-talk voice notes with transcription**, and *Promote to Heirloom Deed* |
| **Care** | `src/screens/CareScreen.tsx` | Claimable care schedule, offline emergency card, doctor's notes, medication radar, meal train |
| **Archive** | `src/screens/ArchiveScreen.tsx` | Recipe box with handwritten cards + voice, and **"Who is this?"** face tagging |
| **Kinship** | `src/screens/FamilyTreeScreen.tsx` | The family graph |

Settings sits behind the header avatar; the full chronological journal
(`FeedScreen`) is a pushed screen — a place you go looking, not the front door.

### Six kinds of memory, not one

`Deed` was doing two jobs: a permanent attributed container (right) and a claim that the
contents were *admirable* (the problem). So a cancer scare, a funeral, and the nickname
nobody can explain never got written down — and the archive became a highlight reel.

There are now six **memory kinds**, and each earns its place by changing a behaviour:
`memory` (the default), `greatDeed`, `milestone`, `hardTime`, `inMemory`, `lore`.

**Reactions depend on the kind.** A hard time offers **Hold · Strength · Love** — never
Applaud. "Hold" is *holding you in mind*, the response a family actually wants to give bad
news and the one no social product ships because it cannot be dressed up as engagement.
The server returns **422** for a reaction the kind disallows, because the client is not a
decency boundary.

**Grief is never resurfaced unprompted.** `hardTime` and `inMemory` are excluded from On
This Day by default — the same class of error as the birthday reminder for someone who has
died, which `ideas.md` calls unforgivable. A family can opt one back in; it is their call.

Full reasoning in **`docs/memory_kinds.md`**. Kind is *register*; `DeedTag` remains *topic*.
They are orthogonal, and conflating them was the trap to avoid.

### The three ideas that shape everything

1. **Two speeds of family memory.** Quick Share sits *beside* Record a Deed with
   equal billing, and on the left where the thumb lands. The 4-step wizard is right
   for "Grandpa built a cabin in 1978" and wrong for "the dog did something stupid".
   `PromotePrompt` in Chat is the bridge: a throwaway Tuesday becomes permanent, but
   only when a human confirms it.
2. **Voice is the accessibility story.** Grandparents who will never type will
   happily talk. The microphone is one tap away on every screen, hold-to-talk is
   *larger* than the text field, and every recording is transcribed into searchable
   text — presented as an italic pull-quote so her words never read as our copy.
3. **Make the gap visible.** In Care, an unclaimed slot is the loudest thing on
   screen with the only filled button in its row. The failure mode of family care
   isn't disagreement, it's diffusion of responsibility.

### Supporting screens

| Screen | File | Status |
|---|---|---|
| Sign up / Log in + privacy promise | `src/screens/SignInScreen.tsx` | UI done, auth not wired |
| Create / Join a Family Circle | `src/screens/OnboardingScreen.tsx` | ✅ |
| The Family Journal (On This Day, prompts) | `src/screens/FeedScreen.tsx` | ✅ |
| Add Deed story wizard (4 steps) | `src/screens/AddDeedScreen.tsx` | ✅ photo/video; audio pending |
| Deed detail + reactions + comments | `src/screens/DeedDetailScreen.tsx` | ✅ |
| Profile ("digital monument") | `src/screens/ProfileScreen.tsx` | ✅ |
| Settings + Invite Member | `src/screens/SettingsScreen.tsx` | ✅ share sheet; real tokens pending |

The web "Welcome Kit" invitation page is a separate web surface — Sprint 3.

### Design system — "Kinship & Hearth" (2020s refresh)

Rules and rationale in **`docs/design_system_2020s.md`** — read that before touching
UI. Original brand thinking in `docs/design.md`; tokens in `src/theme.ts`; comps in
`design/`.

- **Palette:** Forest Pine `#1A4230` (permanence), Terracotta `#C1542F` (today),
  Warm Amber (gentle nudge) on warm porcelain `#FCF9F6`. The two brand hues are
  **sampled from the logo artwork itself**, so product and mark cannot drift apart.
  Colour is semantic, never decorative — and there is no tech-blue anywhere.
- **Type:** Fraunces (serif) for the family's words, Plus Jakarta Sans (sans) for
  chrome. 17px reading baseline, 18px for prose, **nothing below 12px ever**.
  Letter-spacing is a property of each type role, so tracking cannot drift.
- **Icons are vectors, never emoji.** `<Icon name="…" />` wraps `lucide-react-native`
  behind semantic names. This is enforced: `node scripts/check-emoji.mjs` fails the
  build on any emoji in `src/`. An unknown name falls back to a placeholder glyph
  and warns, because several call sites resolve a name from store data through a
  `Record<string, IconName>` that TypeScript believes is total — and rendering
  `undefined` as a component takes down the whole screen, not just the icon.
  `npm run shots` treats that warning as a failure so the net cannot hide a typo.
- **Depth, not borders:** cards separate by soft warm shadow and surface tone.
  Hairlines are reserved for tinted cards, where a warm shadow cannot do the job.
  Radii are 20 for cards, 26 for feature modules, pills for controls.
- **Motion is a token.** Durations and springs live in `theme.ts`; presses scale
  rather than dim, and anything representing live state actually moves.
- All touch targets ≥ 48pt **even where the visible control is smaller**; every
  control has an accessibility label; font scaling always enabled.

### Brand assets

`design/screen.png` is the source artwork. `node scripts/extract-logo.cjs`
regenerates every asset in `assets/` from it — recovering a real alpha channel from
the mockup's checkerboard backdrop (see the script's header for the method). Use
`<Logo>` / `<LogoBadge>` in the app; never re-add the wordmark as text next to the
lockup, because the wordmark is part of the artwork.

### Data — now a real backend

**Postgres + MinIO in Docker, behind a TypeScript API on `:4001`.** Full detail in
**`docs/backend.md`**; the short version:

`src/store.tsx` is still a Context + reducer and screens still read only from
selectors — that seam is why moving off mock data **did not require editing a single
screen**. Auth, people, deeds, comments, reactions and media now come from the API;
chat, care, archive and events still read seed data through the same selectors while
those routes are built. The schema for all of them already exists.

**The privacy promise is now enforced by the database, not the client.** Audience
filtering happens in SQL: a child account's queries are constrained to
`audience = ANY('{everyone,branch}')`, and every query is scoped to a `family_id`
taken from the verified token rather than the request. The old client-side filter was
kept as defence in depth, but it is no longer the enforcement point — anybody can call
an HTTP API with their own client.

An audience miss returns **404, not 403**: telling a child account that an adults-only
story exists is itself a leak.

Media is never public. Rows store an object *key*; the API mints a short-lived
presigned URL per response, so a leaked link stops working.

**People are not users.** Most people in a family tree never get an account — the
dead, the very young — so they are separate tables. Enforcing that surfaced a real
bug the prototype had been hiding: deeds were authored by *user* ids while chat used
*person* ids, and `store.tsx` was internally inconsistent about which, so a user's own
reaction did not read back as "mine". Nothing had caught it because nothing enforced
the relationship.

**`src/mockData.ts` is a database fixture, not a fallback.** It describes one specific
family, and only `server/src/seed.ts` may import it — `npm run lint:fixtures` enforces
that. When screens used it as placeholder data, families who had just signed up saw the
Millers' medication schedule and photographs inside their own private circle. A new
circle is genuinely empty, and the UI's job is to say so warmly and show the first step
(see `docs/backend.md`).

Content carries an `Audience` (`everyone` / `adults` / `care` / `branch`) because a
single flat circle eventually fails a real family — divorce, estrangement, a relative
nobody wants seeing the kids' photos.

**Bereavement mode is load-bearing.** The `memorialise` action freezes a profile
*and* purges every automated prompt about that person. An automated birthday
reminder for someone who died last month is the kind of wound that makes a family
delete an app forever and tell everyone why.

---

## Deliberately not built yet
Per the roadmap, V1 ships with **no AI and no paid third-party APIs**:
Heirloom PDF export, Family Premium paywall, AI Story Assistant, photo colorization,
and "Famous Deeds" archive search are all post-V1. The code is structured so they
drop in without a rewrite.

Voice-note playback and recording are **presentational for now** — the UI, waveform
and transcript states are real so they can be felt on a device, but no audio engine
is wired up yet. Same for the shared calendar and expense splitting: the data model
in `src/types.ts` (`FamilyEvent` with RSVPs and claimable potluck items) is ready
ahead of the screens.

### Deliberately never building
AI-animated portraits of the dead, AI-invented stories, and AI-generated
"memories" of events that didn't happen. **Fabricated family history is worse than
no family history** — the archive's entire value is that it is true. AI here
reduces work (transcription, OCR, tagging suggestions); it never manufactures
memory, and a human always approves what enters the archive.

## Planning docs
- `docs/backend.md` — **the backend: schema, security model, AWS migration path**
- `docs/great_deeds_features.md` — full feature spec, incl. AI and Famous Deeds
- `docs/design.md` — **the current design system ("Kinship & Hearth")**
- `ideas.md` — the zoomed-out feature brainstorm this build works from
- `design/` — rendered mockups (`screen.png` + `code.html`) per feature area
- `docs/great_deeds_ui_ux.md` — design principles + screen-by-screen breakdown
- `docs/great_deeds_strategy.md` — Family Champion, trust-based monetization, legacy, moderation
- `docs/great_deeds_tech_stack.md` — stack choices, data model, security posture
- `docs/great_deeds_sprint_roadmap.md` — Sprints 1–7 for V1.0, then V1.1 / V2.0 / backlog

## Repo notes
- `.npmrc` pins the npm cache to `./.npm-cache`. Your global `~/.npm` contains
  root-owned files from an old npm bug, which breaks installs. To fix it globally
  (optional): `sudo chown -R 501:20 ~/.npm`
- `scripts/shots.mjs` and `scripts/refresh-shots.mjs` are dev-only tools that
  screenshot every screen in headless Chrome. Not part of the app; they need
  `npm i --no-save puppeteer-core` and a local Chrome install. Start the web server
  first (`npm run web`), then `npm run shots -- http://localhost:8091 /tmp/shots`.

  Shared browser plumbing lives in `scripts/lib-page.mjs`, and two of its rules are
  there because their absence let a real crash pass as a clean run:

  - **Scrolling must target the app's scroll container, not the document.**
    react-native-web renders `<ScrollView>` as a nested `overflow: auto` div, so
    `window.scrollTo` is a silent no-op. Worse, a bottom-tab navigator keeps every
    visited tab mounted, so picking a scroller by tree order or height scrolls a
    screen the camera is not pointed at. `scrollTo` hit-tests the viewport centre
    with `elementFromPoint`, which can only return what is genuinely painted.
    Use `scrollToFraction` for offsets, since the tabs differ in length.
  - **A visual check that cannot fail is not a check.** Page errors, error screens,
    blank renders, and unknown-icon warnings all exit non-zero.
