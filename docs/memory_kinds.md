# What kinds of things can a family record?

Working note for the "diversify the memory kinds" change. Written before the code, so the
taxonomy is argued rather than accumulated.

---

## The problem with "Great Deed"

`Deed` is doing two jobs and only succeeding at one.

1. **A container.** Permanent, attributed, dated, audience-scoped, reactable. This part is
   right and nothing should change about it.
2. **A claim about worth.** The word "great" asserts that what follows was admirable.

Job 2 is what makes people freeze. Consider what a real family actually has to say:

- "Dad's cancer scare in 2019 — and how Claire moved in for six weeks."
- "The year we lost the house."
- "Grandad's funeral. Everybody came. It rained the whole way through."
- "Mum's first Christmas without him."
- "Nobody remembers who started calling Leo 'Bean', but it stuck for eleven years."
- "Barnaby ate an entire birthday cake off the table."

None of those file under **Great Deeds**. So they do not get written down — and the archive
becomes a highlight reel, which is not what a family is. `ideas.md` names the real
competitor as the family WhatsApp group, and families discuss illness, grief and stupid dog
stories there constantly. An archive that only accepts achievements loses to the group chat
on the one axis that matters: being where the family actually is.

## Why more tags do not fix it

There are already nine `DeedTag` values (`Career`, `Kindness`, `MilitaryService`…). They
describe **topic** — what the entry is *about*.

The missing axis is **register**: the emotional key the entry is written in. That is a
different question from topic, and the two are orthogonal. "Dad's cancer scare" is topic
`Kindness` (Claire moved in) in the register *hardship*. Adding a `Sad` tag alongside
`Career` conflates the axes and reads as a content warning rather than a way in.

Register matters because **it should change how the app behaves**, not merely how the entry
is labelled. That is the test for whether this is a real distinction or decoration.

## The proposal: MemoryKind

Six kinds. Each one is a different *invitation to write*, and each changes at least one
concrete behaviour.

| Kind | The prompt a user sees | What it changes |
|---|---|---|
| **Great Deed** | "Something someone did that deserves remembering" | Unchanged. The 4-step wizard, full attribution, `Applaud` leads. |
| **Memory** | "Something you remember — it does not have to be important" | The default. One screen, not four. `Cherish` leads. |
| **Milestone** | "A first, a last, a turning point" | Offers a date more insistently; feeds On This Day and the events radar. |
| **Hard time** | "Something difficult the family came through" | **No Applaud.** Reactions become `Hold` / `Strength` / `Love`. Never resurfaced by On This Day without asking. Defaults to `adults`. |
| **In memory** | "Remembering someone who has gone" | Attached to a memorialised person. Never generates a prompt. Excluded from the yearbook's celebratory framing. |
| **Family lore** | "The story that always gets told. The nickname nobody can explain" | Explicitly does not need a date or a subject. `Laugh` reaction. This is the in-joke slot, and it is the highest-volume kind in a real family. |

### The three that earn their place hardest

**Hard time** is the whole reason for this change. A family that has been through
something does not want it applauded, and the app currently offers "Applaud" as the first
reaction on every entry. Offering `Applaud` on a miscarriage is the kind of detail that
makes somebody close the app and not come back. It also must be excluded from
"On This Day" by default — resurfacing a bereavement unprompted on its anniversary is the
same class of error as the birthday reminder `ideas.md` calls *unforgivable*.

**Family lore** is the volume play. Every family has forty of these and zero of them are
"great deeds". They need no date, no subject, no ceremony — and they are what makes an
archive feel like *this* family rather than a genealogy database.

**Memory** becomes the default because the 4-step wizard is the wrong shape for
"I remember the smell of her kitchen". `ideas.md` is explicit that forcing everything
through the wizard is what turns a family app into a museum.

## Reactions have to move too

`REACTIONS` is currently a fixed four (`Applaud`, `Inspire`, `Cherish`, `Love`) applied to
everything. That is what forces a celebratory register onto every entry. Reactions become
**per-kind**:

| Kind | Reactions offered |
|---|---|
| Great Deed | Applaud · Inspire · Cherish · Love |
| Memory | Cherish · Love · Laugh |
| Milestone | Applaud · Cherish · Love |
| Hard time | **Hold** · Strength · Love |
| In memory | Cherish · Love · Hold |
| Family lore | Laugh · Cherish · Love |

`Hold` is "holding you in mind" — the gesture a family actually wants for bad news, and the
one no social product offers because it cannot be monetised as engagement. `Love` is on
every list: it is the one response that is never wrong.

## What this is NOT

- **Not a mood picker.** Six fixed kinds, chosen because each changes behaviour. A free
  "how did this feel?" field would be a tag by another name.
- **Not a content warning system.** `Hard time` changes reactions and resurfacing; it does
  not blur the entry or demand a click-through. A family's own history does not need to be
  hidden from them.
- **Not AI-inferred.** The person writing chooses the kind. Guessing the register of a
  family's own grief from its text is exactly the "AI manufactures memory" line
  `ideas.md` refuses to cross.

## Consequences elsewhere

- **On This Day** must filter by kind, not just date. Currently it resurfaces anything with
  a `whenDate`.
- **The yearbook** (post-V1) cannot frame a year celebratorily if it contains `hardTime`
  entries. Noted now so the data supports it later.
- **Bereavement mode** gains a real destination: memorialising someone should invite
  `inMemory` entries rather than only freezing a profile.
- **`DeedTag` stays exactly as it is.** Topic and register are orthogonal, and conflating
  them was the thing to avoid.

## Built

All six, as proposed. What actually shipped:

- `memory_kind` domain + `may_resurface` column (`002_memory_kinds.sql`). Existing rows
  became `greatDeed`; the column default for NEW rows is `memory`.
- `REACTIONS_FOR_KIND` in `src/types.ts`, and `ReactionBar` renders from it.
- **The server enforces it.** `POST /deeds/:id/reactions` returns **422** for a reaction the
  kind does not allow. The client only rendering the permitted set is not enough: without
  the server check anybody could POST `{"kind":"applaud"}` to a bereavement and it would be
  stored and shown to the family forever.
- `AddMemoryScreen`: pick the kind, then a form that fits. Great deeds hand off to the
  existing 4-step wizard; the other five get one screen.
- On This Day filters `mayResurface`, verified across months rather than only on today's
  date — the funeral is 29 November and a naive month-match would surface it.
- Resurfacing consent is offered **only** for the kinds where it is a real question. Asking
  "shall we remind you of this every year?" about a driving test is noise; asking it about a
  bereavement is the difference between care and cruelty.
- `hardTime` defaults to `adults`, so a child account never receives it.

The seed fixture now spans all six kinds. A fixture of three achievements is the
highlight-reel problem in miniature, and the design gets judged against the fixture.

## The routing bug this change also fixed

Every "add" button in the app pointed at the Great Deed wizard:

| Button | Went to | Now goes to |
|---|---|---|
| Hearth "Record a Deed" | `AddDeed` | `AddMemory` (the kind picker) |
| Kinship "Add a family member" | `AddDeed` | `AddPerson` |
| Archive "Add the first recipe" | `AddDeed` | `AddRecipe` |
| Feed "+" | `AddDeed` | `AddMemory` |

For "add a family member" this was worse than a wrong screen. The wizard's step 1 asks
*which family member the deed is about* and `canAdvance` refuses to advance until one is
chosen — so a new user with an empty tree hit a **hard dead end on their first day**.
`POST /people` already existed and nothing was wired to it; `POST /recipes` did not exist
at all, which made the most-requested heirloom in the product impossible to create.

`AddPersonScreen` and `AddRecipeScreen` are built for this audience specifically:

- **Dates are free text.** "circa 1890" and "sometime in the war" are real answers about a
  great-grandparent, and a date picker cannot express either.
- **Relationships are optional.** Somebody typing a name off the back of a shoebox
  photograph may not know how they connect, and refusing the entry loses the name.
- **The handwritten recipe card comes first**, above the typed ingredients, because it is
  the primary source — it is in her handwriting, and that is what families grieve losing.
- **Ingredients are one textarea, split on newlines.** A repeating "add ingredient" row is
  more app-like and much worse for a grandparent, who will type a list the way they would
  write it on paper.

## Naming

`Deed` remains the type name in code — renaming it touches 40 files for no user-visible
gain, and "a deed" is also just "a thing done". But **the UI stops saying "Great Deed"**
except for the `greatDeed` kind itself. The tab is already called Archive; the button
becomes "Add to the archive", and the kind is chosen inside.
