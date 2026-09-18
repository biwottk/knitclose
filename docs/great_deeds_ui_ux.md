# Great Deeds — UI/UX & Design Principles

**Goal: a digital family living room.** Warm, safe, comfortable, timeless, easy for everyone.

---

## 1. Core philosophy — accessibility across generations
The hardest constraint: usable by a grandparent on their first smartphone *and* a teenager.

- **Clarity over coolness.** No hidden menus, no swipe-only gestures, no mystery-meat icons.
  Navigation is visible and persistent.
- **Large, legible type.** Friendly font, large default size, and the app **must** respect the
  OS font-size setting (`allowFontScaling` stays on; never hard-cap `maxFontSizeMultiplier` below 1.6).
- **High contrast.** Body text ≥ 4.5:1 against its background.
- **Thumb-friendly targets.** Minimum 48×48pt, generously spaced. No dense toolbars.
- **Plain, warm language.**
  - Avoid: "Upload media to S3."
  - Use: "Add a Photo or Video."

## 2. Emotional design & visual tone
Warm and nostalgic, never sterile and techy.

- **Palette:** no tech-blue. Parchment, botanical ink, baked clay, forest green —
  paper, warmth, history. Now realised as the **"Kinship & Hearth"** system:
  Forest Pine `#1E3A2F` leads, Terracotta `#A23E18` carries "today", Warm Amber
  `#FDBA45` nudges. (Implemented in `src/theme.ts`; see `docs/design.md`.)
- **Type:** a font with warmth — **Merriweather** (serif) for the family's words,
  **Inter** (sans) for UI chrome.
- **Icons:** solid, rounded, obvious. Heart = love, book = story, tree = family tree.
- **The family's photos are the design.** The UI is a beautiful frame that gets out of the way.

## 3. Designing for trust & privacy
- **Constant reassurance,** not a buried settings page:
  - Feed header: "Private to the Garcia Family Circle".
  - Every post: small lock icon + "Only your family can see this."
- **The gated feel.** Login and invitation should feel like unlocking the door to a private home.
- **The Admin experience** must feel like complete control: simple Invite flow, clear Manage Members list.
- **Just-in-time permissions,** in our voice:
  - Avoid: "Allow app to access camera?"
  - Use: "May we use your camera to add a photo to your Great Deed?"

## 4. V1.0 screen-by-screen breakdown

### Screen 1 — Sign Up / Log In
Goal: get in securely; earn trust in the first second.
Logo, email + password, Sign in with Google / Apple.
Background is warm cream, never sterile white. Include the link
**"Why is this private? Read our promise."** → plain-language, ad-free-by-design explainer.

### Screen 2 — First-run onboarding (Create / Join)
Two enormous buttons and nothing else:
- **Create a New Family Circle** (the Family Champion)
- **I Have an Invitation** (everyone else)

Create asks one question: "What's your family's name?" → "The Garcia Family".
Join asks for the invitation code.

### Screen 3 — The "Welcome Kit" invitation screen (web)
Goal: convert an invitee and defeat the "oh, not another social app" reflex.
"You're invited to join The Garcia Family Circle!" — **with the inviter's photo and name**.
One clear Join button, plus a warm, short explanation that it is 100% private.

### Screen 4 — Home "Family Feed"
Header: Circle name + lock icon. Body: chronological, visual-first Deed cards.
Persistent **+ floating action button**. Bottom tabs (V1): **Feed · Family Tree · Settings**.
Appreciation taps get a haptic buzz and a small animation. No ads, no suggested content, ever.

### Screen 5 — "Add Deed" story wizard
A full-screen wizard, **not** one long form. Four steps:
1. "Who is this great deed about?" (tree members + Add New Person)
2. "What's a title for this story?" + "When did this happen?"
3. "Add your memories." (Add Photo / Add Video / Record Audio)
4. "Tell the story." (large box, prompt: "What do you remember about this?")

Encouraging copy at each step ("Great!", "Almost there!").

### Screen 6 — Deed detail
Hero image/video, title, tags, full story in large legible type, appreciation bar with who reacted,
clean comment section. Reading mode: chrome recedes, content shines.

### Screen 7 — Interactive family tree
Pan-and-zoom canvas, photo nodes, parent/child/spouse lines.
Must be *fun to play with*. Tapping a node animates smoothly into the Profile screen.

### Screen 8 — Profile ("digital monument")
Photo, name, key dates, short About, and a feed of only that person's deeds.
Designed with respect, elegance and clarity. This is the payoff for building the tree.

### Screen 9 — Settings
Simple high-contrast list: My Account · Manage Family (admin) · Invite New Member ·
View Family Members · Help & Support · Log Out.
**Invite New Member** must be impossible to miss.

---

## Implemented design system (constraints, not suggestions)

> **Superseded.** The four-size / burgundy-and-gold system described below was the
> V1 implementation. It has been replaced by **"Kinship & Hearth"** — see
> **`docs/design.md`** for the current system, and `src/theme.ts` for the tokens.
> The principles above (accessibility, warmth, privacy-as-ambient) carry over
> unchanged; only the palette, type scale and role names moved on. This section is
> kept for provenance so the reasoning behind the change stays legible.

These were enforced in `src/theme.ts` and `src/components/Text.tsx`. Adding a value
outside them is a regression, not a style choice.

### Type: exactly 4 sizes, exactly 2 weights
| token | px | used for |
|---|---|---|
| `display` | 32 | screen title — the one thing noticed first |
| `heading` | 24 | section and card titles |
| `body` | 18 | body copy, story text, button labels, **text inputs** |
| `caption` | 14 | metadata, ALL-CAPS eyebrows, timestamps |

Eight semantic roles (`hero`, `title`, `heading`, `story`, `body`, `label`,
`caption`, `micro`) map onto those four sizes. Extra hierarchy comes from **font
family** (Lora serif = the family's words; Nunito sans = our chrome), **weight**, and
**ink opacity** — never a fifth size.

Text inputs are pinned to `body` so a story does not change size the moment it is saved.

### Colour: 60 / 30 / 10
- **60%** cream / paper / linen — the paper the app is printed on.
- **30%** one ink colour at three opacities: 100% headings, 80% body, 60% captions.
- **10%** accent: burgundy leads, gold and sage support.
- `burgundyWash` / `goldWash` / `sageWash` are the ~5% accent tints used for cards.
  Full-strength accent fills are reserved for primary actions, so the family's own
  photographs stay the most saturated thing on any screen.

### Spacing: 8-point grid
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Cards use a 24pt interior baseline
(`CARD_PADDING`). Related elements sit at 1×; the gap to the next group is 2×.

### Elevation
Two levels only — `shadow.card` (resting) and `shadow.lifted` (floating and
celebratory). Both tinted warm (`#3A2E22`); never neutral grey on a cream background.

---

## The peak moment (Peak-End Rule)

The emotional high point of this app is **the instant a memory stops being at risk of
being lost.** It is not a "post". `src/screens/DeedSharedScreen.tsx` owns it:

- A sage seal blooms out of a gold halo, with success haptics.
- The headline names the *ancestor*, not the action: "Joseph's story is safe now."
- It reports something true and concrete — the word count nobody else had written,
  and how many relatives can now read it.
- It closes with one gentle nudge ("who would remember this differently?") rather
  than a growth prompt.

This applies the **Vanity Mirror** principle: celebrate who the user is (the person
who made sure this survived), never what they clicked. The wizard `replace()`s
itself with this screen so Back cannot re-post.

## Accessibility checklist (definition of done for every screen)
- [ ] Every touchable ≥ 48pt and has an `accessibilityLabel`.
- [ ] Text scales to 200% without clipping or overlap.
- [ ] No information conveyed by colour alone.
- [ ] Screen reader order matches visual order.
- [ ] Nothing depends on a gesture that has no button equivalent.
