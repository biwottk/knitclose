/**
 * Domain types.
 *
 * The model is deliberately split along the product's central insight (ideas.md):
 * there are TWO SPEEDS of family memory, and they are different shapes of data.
 *
 *   Speed 1 -- "quick": a chat message, a voice note, a photo dump. Cheap to
 *              create, ephemeral in tone, high frequency. This is what earns the
 *              daily open and beats the family WhatsApp group.
 *   Speed 2 -- "heirloom": a Deed. Curated, attributed, dated, permanent.
 *
 * A quick thing can be PROMOTED into an heirloom thing (see `promotedToDeedId`),
 * which is how the archive gets fed by ordinary Tuesdays instead of by a wizard
 * nobody opens.
 */

/**
 * Reactions.
 *
 * 'hold' is "holding you in mind" -- the response a family actually wants to give bad
 * news. No social product offers it, because it cannot be dressed up as engagement, and
 * its absence is why every product in this space feels wrong at a funeral.
 *
 * These are not all offered at once: see REACTIONS_FOR_KIND. Offering "Applaud" on a
 * miscarriage is the kind of detail that makes somebody close an app for good.
 */
export type ReactionKind =
  | "applaud" | "inspire" | "cherish" | "love" | "hold" | "strength" | "laugh";

/**
 * What KIND of thing is being remembered -- the register, not the topic.
 *
 * WHY THIS EXISTS: "Great Deed" was both a container (permanent, attributed, dated --
 * correct) and a claim that the contents were admirable (the problem). A family also has
 * to record a cancer scare, a funeral, and the fact that nobody remembers who started
 * calling Leo "Bean". None of those file under Great Deeds, so they were not being
 * written down at all -- and an archive that only accepts achievements is a highlight
 * reel, which is not what a family is.
 *
 * This is deliberately SEPARATE from DeedTag. Tags are topic (Career, Kindness); kind is
 * register. They are orthogonal: "Dad's cancer scare, and how Claire moved in for six
 * weeks" is topic Kindness in the register hardTime.
 *
 * Each kind changes at least one real behaviour -- which reactions are offered, or
 * whether the entry may be resurfaced unprompted. A kind that changed nothing would be
 * decoration. See docs/memory_kinds.md.
 */
export type MemoryKind =
  | "greatDeed"   // something someone did that deserves remembering
  | "memory"      // something you remember; it does not have to be important
  | "milestone"   // a first, a last, a turning point
  | "hardTime"    // something difficult the family came through
  | "inMemory"    // remembering someone who has gone
  | "lore";       // the story that always gets told; the unexplainable nickname

export type DeedTag =
  | "Career" | "Kindness" | "Achievement" | "MilitaryService"
  | "Community" | "Faith" | "Craft" | "Recipe" | "Milestone";

export type MediaKind = "photo" | "video" | "audio";

export interface Media {
  id: string;
  kind: MediaKind;
  uri: string;
  /** Seconds. Videos are capped at 60s; audio is uncapped. */
  durationSec?: number;
  /**
   * Transcription of an audio recording.
   *
   * The server has always shaped this onto media rows (server/src/shape.ts) but the type
   * never declared it, so every caller that wanted a transcript had to carry its own copy
   * alongside -- which is why Message has a separate `transcript` field. It belongs here:
   * the transcript is a property of the recording, not of the thing the recording is
   * attached to.
   */
  transcript?: string;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string;
  /** ISO date or a fuzzy string like "circa 1890". */
  birthDate?: string;
  deathDate?: string;
  photoUri?: string;
  bio?: string;
  isLiving: boolean;
  /** Relationship edges -- a family is a graph, not a nested tree. */
  parentIds: string[];
  spouseIds: string[];
  /** Where they live now, for the family map. */
  location?: string;
  /**
   * Bereavement mode. When true the app must never generate a birthday nudge,
   * a "say hello" prompt, or a care reminder for this person again.
   * ideas.md is blunt about this: getting it wrong is unforgivable.
   */
  memorialised?: boolean;
}

// ---------------------------------------------------------------------------
// Visibility -- a single flat circle eventually fails a real family
// ---------------------------------------------------------------------------

/**
 * Granular visibility, because divorce, estrangement and "adults only" are real
 * (ideas.md section 7). Every piece of content carries one of these.
 *
 *   everyone  -- the whole circle, including kids
 *   adults    -- health, money, wills; hidden from child accounts
 *   care      -- the care sub-circle for one relative only
 *   branch    -- one branch of the tree
 */
export type Audience = "everyone" | "adults" | "care" | "branch";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: "All family",
  adults: "Adults only",
  care: "Care circle",
  branch: "Selected relatives",
};

// ---------------------------------------------------------------------------
// Speed 2: heirloom Deeds
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  deedId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId?: string;
}

export interface Deed {
  id: string;
  /**
   * The register this entry is written in. Drives which reactions are offered and
   * whether On This Day may resurface it. Defaults to "memory" for new entries.
   */
  kind: MemoryKind;
  /**
   * Whether On This Day may bring this back unprompted.
   *
   * Derived from `kind` when created, but stored per entry so a family can decide that
   * one particular hard time IS worth seeing again -- "the year we nearly lost Dad, and
   * didn't" is sometimes exactly what somebody wants resurfaced. Their call, not ours.
   */
  mayResurface?: boolean;
  title: string;
  /** Human "when": may be fuzzy, e.g. "Summer of 1978". Always shown to the user. */
  whenText: string;
  /** Machine-sortable date when we can derive one. */
  whenDate?: string;
  /** Human place: deliberately fuzzy, e.g. "Nana's kitchen" or "Amboseli". */
  whereText?: string;
  story: string;
  /** People this deed is about. */
  personIds: string[];
  tags: DeedTag[];
  media: Media[];
  authorId: string;
  authorName: string;
  createdAt: string;
  /**
   * Reaction kind -> the people who gave it.
   *
   * PARTIAL, deliberately: a hard time has no 'applaud' key at all, because applaud is
   * never offered for it. A full Record would force every entry to carry seven empty
   * arrays and would let a UI bug surface a reaction the kind does not allow.
   */
  reactions: Partial<Record<ReactionKind, string[]>>;
  audience: Audience;
  /** Privately flagged for admin review -- never surfaced publicly. */
  flagged?: boolean;
  /** Set when this deed was promoted up from a chat message or voice note. */
  fromMessageId?: string;
}

// ---------------------------------------------------------------------------
// Speed 1: chat, voice notes, quick shares
// ---------------------------------------------------------------------------

/**
 * A chat thread. `kind` matters because the care thread is scoped to the care
 * sub-circle and must not leak a relative's medical detail to the whole family.
 */
export interface Thread {
  id: string;
  title: string;
  kind: "general" | "care" | "planning";
  audience: Audience;
  memberIds: string[];
}

/**
 * One message. A voice note is a message with `audio` plus a transcript --
 * transcription is the highest-value AI feature in the product because it turns
 * the way elders naturally communicate into something searchable (ideas.md 8).
 */
export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  /** Typed text. Absent on a pure voice note. */
  body?: string;
  audio?: Media;
  /** Auto-transcription of `audio`. Marked so nobody mistakes it for typed words. */
  transcript?: string;
  photos?: Media[];
  /**
   * Reaction key -> user ids. Lighter weight than a Deed's four named reactions.
   *
   * The keys are SEMANTIC WORDS ("love", "cherish"), not emoji characters. The UI
   * maps them to vector glyphs in ChatScreen's `reactionIcon`, which keeps
   * presentation out of the stored data -- and means the icon set can be retuned
   * without migrating anybody's messages.
   */
  reactions?: Record<string, string[]>;
  /** Read receipts, shown warmly ("Grandad saw this"), never as pressure. */
  seenBy?: string[];
  /** Set once this message has been lifted into the permanent archive. */
  promotedToDeedId?: string;
  /** Attached context, e.g. "Nana's Favorite Recipe". */
  contextLabel?: string;
}

// ---------------------------------------------------------------------------
// Care coordination -- the most defensible territory in the product
// ---------------------------------------------------------------------------

/** Who is being cared for, and the sub-circle allowed to see it. */
export interface CareCircle {
  id: string;
  personId: string;
  /** Free-text status in the family's own words, e.g. "Gentle rest day". */
  status: string;
  mood?: string;
  memberIds: string[];
  /** Week counter shown on the meal train, e.g. 3 -> "Week 3 of Recovery". */
  recoveryWeek?: number;
  dietaryNote?: string;
}

export type CareTaskKind = "medication" | "appointment" | "visit" | "meal" | "other";

export interface CareTask {
  id: string;
  circleId: string;
  kind: CareTaskKind;
  title: string;
  /** Human time, e.g. "09:00 AM". */
  timeText: string;
  /** ISO date this task belongs to. */
  date: string;
  detail?: string;
  done: boolean;
  /** Who has claimed it. Unclaimed slots are the whole point of the feature. */
  claimedById?: string;
  claimedByName?: string;
  /** Free-text result, e.g. "BP 124/78". */
  result?: string;
  /** Urgent enough to tint terracotta rather than sit quietly. */
  urgent?: boolean;
}

/** A doctor's note, captured live in clinic so it stops living in sibling texts. */
export interface DoctorNote {
  id: string;
  circleId: string;
  clinician: string;
  summary: string;
  createdAt: string;
  recordedByName: string;
  audio?: Media;
  /** A family member confirmed this is what was actually said. */
  validated?: boolean;
}

export interface Medication {
  id: string;
  circleId: string;
  name: string;
  dose: string;
  schedule: string;
  /** Days of supply left. Drives the amber "low supply" warning. */
  daysLeft: number;
  pharmacy?: string;
  /** Who is fetching the next repeat. */
  pickupByName?: string;
}

/** One slot on the meal train / help rota. Claimable, or deliberately open. */
export interface MealSlot {
  id: string;
  circleId: string;
  date: string;
  dayLabel: string;
  dateLabel: string;
  title?: string;
  detail?: string;
  claimedByName?: string;
}

/**
 * The emergency card. One screen, cached for offline: the thing you hand a
 * paramedic. Adults-only by construction.
 */
export interface EmergencyCard {
  personId: string;
  bloodType?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  clinicians: { role: string; name: string; phone: string }[];
  contacts: { relation: string; name: string; phone: string }[];
  powerOfAttorney?: string;
}

// ---------------------------------------------------------------------------
// The archive: recipes and "Who is this?"
// ---------------------------------------------------------------------------

/**
 * A family recipe. The most-requested heirloom there is, and trivial to build.
 * The handwritten card photo matters as much as the typed version -- it is the
 * primary source, in her handwriting.
 */
export interface Recipe {
  id: string;
  title: string;
  /** Whose recipe it is, by name, because that is the point. */
  attribution: string;
  personId?: string;
  /** The tradition line: "Baked every Easter morning since 1968 in Leeds." */
  provenance: string;
  origin?: string;
  originYear?: string;
  prepText?: string;
  yieldText?: string;
  photoUri?: string;
  /** Photo of the original handwritten card. */
  cardPhotoUri?: string;
  ingredients: string[];
  steps: string[];
  /** An elder talking through the tricky part. Preserves the tacit knowledge. */
  voiceNote?: Media;
  voiceNoteLabel?: string;
  tradition?: string;
  savedByCurrentUser?: boolean;
}

/**
 * An unidentified face in an old photo. ideas.md calls this "a race against
 * time" and the most urgent thing in the app: the elders who can answer these
 * are the ones we are racing.
 */
export interface FaceTag {
  id: string;
  /** Position as a 0-1 fraction of the photo, so it scales with any layout. */
  x: number;
  y: number;
  /** Confirmed name, or undefined while still unknown. */
  name?: string;
  /** A guess nobody has confirmed yet. Shown with a question mark. */
  guess?: string;
}

export interface ArchivePhoto {
  id: string;
  uri: string;
  /** Where it physically came from: "Great Aunt Eleanor's attic box (c. 1954)". */
  provenance: string;
  question: string;
  detail?: string;
  /** Elders we are specifically asking. */
  askingNames: string[];
  faces: FaceTag[];
  clues: { authorName: string; body: string; whenText: string }[];
}

// ---------------------------------------------------------------------------
// Coordination: calendar, birthdays, milestones
// ---------------------------------------------------------------------------

export type EventKind =
  | "birthday" | "anniversary" | "gathering" | "appointment" | "milestone";

export interface FamilyEvent {
  id: string;
  kind: EventKind;
  title: string;
  date: string;
  /** Derived for birthdays/anniversaries from the tree, so nobody types them. */
  auto?: boolean;
  personIds: string[];
  location?: string;
  note?: string;
  /** Who has said they are coming. */
  rsvpYes?: string[];
  /** Claimable potluck items -- ends the "we have five trifles" phone call. */
  potluck?: { id: string; item: string; claimedByName?: string }[];
}

/**
 * A "Thinking of you" target: one tap, zero composition cost, which matters
 * enormously for the least tech-confident members.
 */
export interface Nudge {
  personId: string;
  /** The warm verb shown under their face, e.g. "Send Tea". */
  action: string;
}

// ---------------------------------------------------------------------------
// Family + user
// ---------------------------------------------------------------------------

export interface Family {
  id: string;
  name: string;
  plan: "free" | "premium";
}

export interface CurrentUser {
  id: string;
  name: string;
  /** `child` accounts never see `adults` content. */
  role: "admin" | "member" | "child";
  personId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The four ways to appreciate a deed. Deliberately not a generic "Like".
 *
 * These carry no icon any more: the emoji they used to hold have been replaced by
 * vector glyphs, and the kind -> glyph mapping lives in ReactionBar next to the
 * component that draws it. Keeping presentation out of the data model is what lets
 * the icon set be retuned without touching types.
 */
export const REACTIONS: { kind: ReactionKind; label: string }[] = [
  { kind: "applaud", label: "Applaud" },
  { kind: "inspire", label: "Inspire" },
  { kind: "cherish", label: "Cherish" },
  { kind: "love", label: "Love" },
  { kind: "hold", label: "Hold" },
  { kind: "strength", label: "Strength" },
  { kind: "laugh", label: "Laugh" },
];

/**
 * Which reactions each kind offers.
 *
 * THE POINT OF THE WHOLE CHANGE. Every entry used to offer the same four, led by
 * "Applaud" -- so the app invited a family to applaud a bereavement. Now a hard time
 * offers Hold, Strength and Love, and nothing else.
 *
 * 'love' appears in every list on purpose: it is the one response that is never wrong.
 */
export const REACTIONS_FOR_KIND: Record<MemoryKind, ReactionKind[]> = {
  greatDeed: ["applaud", "inspire", "cherish", "love"],
  memory: ["cherish", "love", "laugh"],
  milestone: ["applaud", "cherish", "love"],
  // No applaud, no inspire. Nobody wants their hardest year applauded.
  hardTime: ["hold", "strength", "love"],
  inMemory: ["cherish", "love", "hold"],
  lore: ["laugh", "cherish", "love"],
};

/**
 * How each kind presents itself: the invitation to write, and how it behaves.
 *
 * The prompts are the feature. "Record a Great Deed" makes people freeze because they
 * must first decide their story is great; "Something you remember -- it doesn't have to
 * be important" gives permission, which is what an empty archive actually needs.
 */
export interface MemoryKindMeta {
  kind: MemoryKind;
  /** Short label for chips and headings. */
  label: string;
  /** The invitation, second person, plain language. */
  prompt: string;
  /** An example, so nobody has to guess the register. */
  example: string;
  /** Semantic icon name from the app's own set. */
  icon: string;
  /**
   * Whether On This Day may resurface this unprompted. False for grief: ideas.md is
   * blunt that an automated reminder about a death is unforgivable, and an anniversary
   * of a miscarriage is the same error.
   */
  resurfaceByDefault: boolean;
  /** Whether the entry needs a subject. Lore often has none -- it is about "us". */
  needsPerson: boolean;
  /** Whether the full 4-step wizard is warranted, or one short screen is enough. */
  wizard: boolean;
  /** Defaults to adults-only. Illness and money are not children's business. */
  adultsByDefault: boolean;
}

export const MEMORY_KINDS: MemoryKindMeta[] = [
  {
    kind: "memory",
    label: "A memory",
    prompt: "Something you remember",
    example: "The smell of her kitchen on a Saturday morning.",
    icon: "cherish",
    resurfaceByDefault: true,
    needsPerson: false,
    wizard: false,
    adultsByDefault: false,
  },
  {
    kind: "greatDeed",
    label: "A great deed",
    prompt: "Something someone did that deserves remembering",
    example: "Grandpa built a cabin by hand for the family, summer of 1978.",
    icon: "deed",
    resurfaceByDefault: true,
    needsPerson: true,
    // The only kind that keeps the 4-step wizard: it is right for a curated,
    // attributed, dated story and wrong for everything else.
    wizard: true,
    adultsByDefault: false,
  },
  {
    kind: "milestone",
    label: "A milestone",
    prompt: "A first, a last, a turning point",
    example: "Maya passed her driving test on the third go.",
    icon: "milestone",
    resurfaceByDefault: true,
    needsPerson: true,
    wizard: false,
    adultsByDefault: false,
  },
  {
    kind: "hardTime",
    label: "A hard time",
    prompt: "Something difficult the family came through",
    example: "Dad's cancer scare in 2019, and how Claire moved in for six weeks.",
    icon: "care",
    // Never resurfaced unprompted.
    resurfaceByDefault: false,
    needsPerson: false,
    wizard: false,
    // Illness and money are adults-only by default. The author can widen it.
    adultsByDefault: true,
  },
  {
    kind: "inMemory",
    label: "In memory",
    prompt: "Remembering someone who has gone",
    example: "Grandad's funeral. Everybody came. It rained the whole way through.",
    icon: "leaf",
    resurfaceByDefault: false,
    needsPerson: true,
    wizard: false,
    adultsByDefault: false,
  },
  {
    kind: "lore",
    label: "Family lore",
    prompt: "The story that always gets told",
    example: "Nobody remembers who started calling Leo \"Bean\", but it stuck for eleven years.",
    icon: "sparkle",
    resurfaceByDefault: true,
    // Lore is about "us", not about one person. Demanding a subject is what stops these
    // being written, and a real family has forty of them.
    needsPerson: false,
    wizard: false,
    adultsByDefault: false,
  },
];

export function memoryKind(kind: MemoryKind): MemoryKindMeta {
  return MEMORY_KINDS.find((k) => k.kind === kind) ?? MEMORY_KINDS[0];
}

export const ALL_TAGS: DeedTag[] = [
  "Career", "Kindness", "Achievement", "MilitaryService", "Community",
  "Faith", "Craft", "Recipe", "Milestone",
];

/** Tags are stored PascalCase but shown with spaces. */
export function tagLabel(tag: DeedTag): string {
  return tag.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Can this user see this content? Child accounts are excluded from adults-only
 * material (health, money, wills) as a hard rule, not a preference.
 */
export function canView(user: CurrentUser, audience: Audience): boolean {
  if (audience === "adults") return user.role !== "child";
  return true;
}
// ---------------------------------------------------------------------------
// The Archive: letters and the voice vault
//
// Both are HEIRLOOMS -- objects a family goes looking for deliberately, months later.
// That is the test for what belongs in the Archive at all, and it is why each has its own
// shape rather than being a tagged timeline entry: a letter has a sender and a date
// received, a recipe has ingredients. See docs/archive_contents.md.
// ---------------------------------------------------------------------------

export type LetterKind = "letter" | "card" | "diary" | "note" | "telegram";

export const LETTER_KIND_LABEL: Record<LetterKind, string> = {
  letter: "Letter",
  card: "Card",
  diary: "Diary page",
  note: "Note",
  telegram: "Telegram",
};

/**
 * A handwritten letter, card or diary page.
 *
 * The photograph of the ORIGINAL is the primary source -- it is in their hand -- and the
 * transcript exists so it can be searched and read on a phone. Same division of labour as
 * a recipe and its handwritten card.
 */
export interface Letter {
  id: string;
  kind: LetterKind;
  title: string;
  fromName?: string;
  fromPersonId?: string;
  toName?: string;
  toPersonId?: string;
  /** Fuzzy: "spring 1944", "postmarked but undated". */
  whenText?: string;
  whenDate?: string;
  /**
   * The typed text. Until transcriptConfirmed is true this is a DRAFT -- possibly an OCR
   * guess -- and the UI must not present it as the writer own words.
   */
  transcript?: string;
  transcriptConfirmed: boolean;
  provenance?: string;
  /** Who physically holds the original. Stops a family losing track of the object. */
  heldByName?: string;
  imageUri?: string;
  /** Multi-page originals, in order. */
  pages: Media[];
  /** An elder reading it aloud: the words in a living voice that knew the writer. */
  reading?: Media;
  audience: Audience;
  createdAt: string;
}

/**
 * A recording kept in the voice vault.
 *
 * Not a new kind of media -- the audio lives in `media` like any other. This is the
 * curation decision: somebody said this recording is worth finding again.
 */
export interface VoiceRecording {
  id: string;
  title: string;
  /** Whose voice it is. The most important field here. */
  speakerName: string;
  speakerPersonId?: string;
  /** The question being answered, preserved so the answer stays legible in fifty years. */
  prompt?: string;
  whenText?: string;
  whenDate?: string;
  /** Set when it was lifted out of a chat message. */
  fromMessageId?: string;
  audio: Media;
  audience: Audience;
  createdAt: string;
}
// ---------------------------------------------------------------------------
// Objects & Heirlooms
// ---------------------------------------------------------------------------

export type ObjectKind =
  | "jewellery" | "furniture" | "tool" | "textile" | "book" | "instrument"
  | "artwork" | "crockery" | "medal" | "property" | "keepsake";

export const OBJECT_KIND_LABEL: Record<ObjectKind, string> = {
  jewellery: "Jewellery",
  furniture: "Furniture",
  tool: "Tool",
  textile: "Textile",
  book: "Book",
  instrument: "Instrument",
  artwork: "Artwork",
  crockery: "Crockery",
  medal: "Medal",
  property: "Place",
  keepsake: "Keepsake",
};

/**
 * Where an object is.
 *
 * "lost" is a first-class state, not an omission: recording that nobody knows where the ring
 * went is real information, and it stops the same question being asked at every funeral.
 */
export type ObjectStatus = "held" | "lost" | "givenAway" | "destroyed";

export const OBJECT_STATUS_LABEL: Record<ObjectStatus, string> = {
  held: "In the family",
  lost: "Nobody knows where it is",
  givenAway: "Passed outside the family",
  destroyed: "Gone",
};

/** One link in the chain of people who have held an object. */
export interface Custody {
  id: string;
  personId?: string;
  holderName: string;
  /** Fuzzy: "after the funeral" is how families actually date these. */
  fromText?: string;
  fromDate?: string;
  /** How it came to them. "She left it to me" is the sentence that matters. */
  note?: string;
}

/**
 * A family object: the ring, the clock, the toolbox.
 *
 * THE CUSTODY CHAIN IS THE POINT. An heirloom differs from a merely old thing precisely by
 * having a record of who has carried it, and "where did the ring go?" is the question this
 * exists to answer -- a real and slightly poisonous one that an archive can defuse.
 */
export interface FamilyObject {
  id: string;
  name: string;
  kind: ObjectKind;
  story: string;
  originText?: string;
  originYear?: string;
  originPersonId?: string;
  originPersonName?: string;
  /** Current holder, denormalised from the last custody entry for cheap listing. */
  heldByPersonId?: string;
  heldByName?: string;
  /** "The blue box on top of the wardrobe" -- the detail that actually finds a thing. */
  whereKept?: string;
  status: ObjectStatus;
  statusNote?: string;
  imageUri?: string;
  photos: Media[];
  /** Oldest first, so the object reads as a provenance. */
  custody: Custody[];
  audience: Audience;
  createdAt: string;
}
