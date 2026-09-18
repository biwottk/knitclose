# Close Knit — Design System

**"Kinship & Hearth."** The implemented source of truth is `src/theme.ts`; this
document explains the reasoning. Raw tokens live in
`design/kinship_hearth/DESIGN.md`, and the rendered comps are in `design/`.

> Where the prose in `DESIGN.md` and the Tailwind config inside each mockup's
> `code.html` disagreed, **the mockup config won** — that config is what the
> screenshots were actually rendered from.

---

## 1. The idea

A **print-inspired digital living room**: Editorial Warmth crossed with Humanist
Minimalism. It has to hold two things at once, and the tension between them is
the whole design problem:

| | Ordinary Tuesday | Timeless archive |
|---|---|---|
| Content | groceries, a school run, a photo of the dog | a 1978 cabin build, an elder's voice |
| Feel | immediate, cheap, disposable | permanent, attributed, dated |
| Surface | white cards, compact padding, terracotta | parchment, Merriweather, forest green |

The system deliberately **rejects** the high-velocity gamified mechanics of
conventional social platforms. No infinite-scroll dopamine, no vanity counters,
no engagement-bait notifications.

## 2. Colour

Grounded earthen pigments — linen, botanical ink, baked clay, parchment. No
synthetic cool whites, no electric primaries, and **explicitly no tech blue**.

| Role | Hex | Name | Owns |
|---|---|---|---|
| `primary` | `#07241A` | Forest Pine (deep) | primary buttons, nav state, headlines |
| `primaryContainer` | `#1E3A2F` | Forest Pine | heirloom framing, dark bubbles |
| `secondary` | `#A23E18` | Terracotta | Quick Share, urgent care, milestones |
| `secondaryContainer` | `#FE8357` | Terracotta (bright) | live pips, unread dots |
| `tertiaryFixedDim` | `#FDBA45` | Warm Amber | reminders, celebration, low supply |
| `onSurface` | `#1F1B18` | Dark Espresso | reading text (never `#000`) |
| `surface` | `#FFF8F5` | Warm parchment | the app canvas |
| `border` | `#E6DFD5` | Raw linen | every card hairline |

**Semantic discipline.** Colour carries meaning, so it is never decorative:

- **Forest green = permanence.** Anything green is about keeping something.
- **Terracotta = today.** Anything terracotta is spontaneous, live, or needs a
  person *now*. An unclaimed care slot is terracotta; a covered one is green.
- **Amber = a gentle nudge.** Reminders and low-supply warnings, never alarm.
  Amber nudges; it does not shout. Real alarm is `error`, and it is rare.

## 3. Typography

Multi-generational accessibility is a **foundational constraint, not a polish
pass**. Two families:

- **Merriweather** (serif) — names, archive headers, prompts, and the family's
  own words. Sturdy and legible at low brightness.
- **Inter** (sans) — functional chrome and metadata. Tall x-height, wide
  apertures, unambiguous `1` / `l` / `I`.

`AppText` exposes ten roles mapping onto the scale in `theme.ts`:

| Role | Token | Family | Used for |
|---|---|---|---|
| `hero` | headline-xl 28/38 | Merriweather 700 | the one line you read first |
| `title` | headline-lg 22/32 | Merriweather 700 | screen + major card titles |
| `subtitle` | headline-md 20/30 | Merriweather 700 | sections inside a card |
| `quote` | story-callout 18/32 | Merriweather italic | **the family's own words** |
| `story` | body-lg 18/28 | Inter 400 | narrative-first reading |
| `body` | body-md 16/24 | Inter 400 | baseline UI copy |
| `small` | body-sm 14/20 | Inter 400 | supporting detail |
| `label` | label-lg 16/22 | Inter 600 | buttons, list rows |
| `labelSm` | label-md 14/18 | Inter 600 | chips, compact metadata |
| `micro` | label-sm 12/16 | Inter 600 | ALL-CAPS eyebrows |

**Rules.** 16px is the reading baseline and 18px is used wherever there is real
prose. **Nothing goes below 12px, ever.** Long-form leading stays at 1.6×–1.75×.
`allowFontScaling` is on everywhere; the multiplier is only capped (generously,
at 1.8×) on `hero` and `title` so a huge system font cannot push a screen's
content out of reach.

`quote` is load-bearing: **a transcribed voice note is always set as an italic
serif pull-quote.** That styling is what makes an elder's speech read as
testimony rather than as app copy, and it visually separates what *she said* from
what *we wrote*.

## 4. Layout, shape, elevation

- **8pt rhythm.** `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48`. Screen margin
  and inter-card gutter are both 16.
- **Radii.** 8 controls · 16 cards · 24 sheets · pill avatars and chips.
- **Touch.** 48×48 minimum, **mandatory even where the visible control is
  smaller** — compact chips keep a 32px body and reach 48 via `hitSlop`. Inputs
  are 52px; list rows clear 56px.
- **Elevation is tonal, not floating.** A card is defined by its 1px linen
  hairline and interior padding. Shadows are barely-there and always warm-tinted
  (`#24201D`, never a cold grey). Hierarchy comes from stepping through the
  surface tones via `Card tone=`.

`Card` tones: `paper` → `low` → `container` → `high` (a tonal ladder), plus
three semantic ones: `alert` (terracotta), `warm` (amber), `forest` (inverted).

## 5. Navigation

Five persistent, labelled tabs. The **order encodes the strategy**:

```
Hearth   Chat   Care   │  Archive   │  Kinship
└── daily utility ─────┘  permanence   structure
```

Daily utility comes first because a family app whose first tab is a family tree
is a museum. Five is the practical ceiling for a bar that stays legible for a
grandparent, so **Settings lives behind the header avatar** rather than taking a
sixth slot, and the full chronological journal is a pushed screen rather than a
tab — it is a place you go looking, not the front door.

Nothing hides behind a gesture. Everything is reachable by a labelled control.

## 6. Signature components

**`VoiceNote`** — arguably the most important component in the app. Large
high-contrast play control, deterministic waveform (never `Math.random()`, which
would flicker on re-render), and the transcript beneath as a quotation, always
badged *Auto-Transcribed · Searchable*. Voice is how the least tech-confident
members will actually contribute, so the microphone is never more than one tap
away — it lives in `AppHeader` on every screen.

**`AppHeader`** — wordmark, section, and the **always-visible family-circle
name**. That name is the ambient form of the privacy promise: you can see which
circle you are speaking into *before* you say anything.

**`PrivacyBadge`** — takes an `audience`, because "only your family" stops being
specific enough once granular visibility exists. A care note and a baby photo are
both private, but not to the same people.

## 7. Non-negotiables

These are product ethics expressed as design constraints.

1. **Two speeds, equal billing.** Quick Share sits beside Record a Deed on the
   Hearth, and Quick Share is on the **left**, where the thumb lands first.
   Funnelling everything through the 4-step wizard is what turns a family app
   into a museum.
2. **Make the gap visible.** In Care, an uncovered slot is the loudest thing on
   screen with the only filled button in its row. The failure mode of family
   care is not disagreement, it is diffusion of responsibility — one tap must
   turn "someone should" into "I will".
3. **Bereavement mode is sacred.** `memorialise` freezes a profile *and* purges
   every automated prompt about that person. An automated birthday reminder for
   someone who died last month is the wound that makes a family delete the app
   and tell everyone why.
4. **AI reduces work; it never manufactures memory.** Transcription and OCR, yes.
   Invented stories, AI-animated portraits of the dead, or fabricated
   "memories", never. A human always approves what enters the archive —
   `PromotePrompt` suggests, and only a person confirms.
5. **Privacy is ambient, not a settings page.** The circle name is in the header
   and the audience is on the content.
6. **Warmth over urgency.** Read receipts say "Grandad saw this", never a
   surveillance grid. Radar counts prompt action without shaming anyone.

## 8. Voice

Plain and warm. Never "Upload media to S3" — always "Add a Photo or Video".
Permissions ask in our voice: *"May we use your camera to add a photo to your
Great Deed?"* Reactions are **Applaud / Inspire / Cherish / Love** because this
is appreciation, not likes.
