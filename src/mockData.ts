import type {
  ArchivePhoto, CareCircle, CareTask, Comment, CurrentUser, Deed, DoctorNote,
  EmergencyCard, Family, FamilyEvent, FamilyObject, Letter, MealSlot, Medication,
  Message, Nudge, Person, Recipe, Thread, VoiceRecording,
} from "./types";

/**
 * Seed content.
 *
 * Two jobs. First, a brand-new family must never see an empty feed
 * (docs/great_deeds_strategy.md section 1). Second, this is the fixture the
 * design was built against: the people, times and phrasing here match the
 * mockups in design/ so a screen can be compared side by side with its comp.
 *
 * The family is the Millers, matching the screen.png in each design folder.
 */

export const family: Family = { id: "fam1", name: "The Miller Family Circle", plan: "free" };

/** Sarah is the Family Champion: 45-65, organising everyone, worrying about Nana. */
export const currentUser: CurrentUser = {
  id: "u_sarah", name: "Sarah Miller", role: "admin", personId: "p_sarah",
};

// Unsplash stand-ins. Real families supply their own; these only exist so the
// layout is tested against actual photographs rather than grey boxes.
const PHOTO = {
  nana: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
  dave: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces",
  maya: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
  leo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  sarah: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces",
  claire: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
  marcus: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  orchard: "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=800&h=500&fit=crop",
  dog: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&h=600&fit=crop",
  dogNest: "https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?w=400&h=400&fit=crop",
  socks: "https://images.unsplash.com/photo-1516222338250-863216ce01ea?w=400&h=400&fit=crop",
  scones: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&h=500&fit=crop",
  bread: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&h=500&fit=crop",
  recipeCard: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=300&h=200&fit=crop",
  rhubarb: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=200&h=200&fit=crop",
  beefPot: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop",
  // Desaturated + sepia through Unsplash's imgix params so the stand-in reads as
  // an actual 1950s print rather than a modern colour snapshot.
  oldFamily:
    "https://images.unsplash.com/photo-1511895426328-dc8714191300" +
    "?w=800&h=600&fit=crop&sat=-100&sepia=55",
};

// ---------------------------------------------------------------------------
// People -- four living generations plus the ones we are preserving
// ---------------------------------------------------------------------------

export const people: Person[] = [
  { id: "p_arthur", name: "Grandpa Arthur", birthDate: "1929-03-04", deathDate: "2018-11-22",
    isLiving: false, parentIds: [], spouseIds: ["p_nana"],
    bio: "Built the cider press in 1978. Every autumn since, we have used it." },
  { id: "p_nana", name: "Nana Ruth", birthDate: "1945-11-12", isLiving: true,
    parentIds: [], spouseIds: ["p_arthur"], photoUri: PHOTO.nana, location: "Leeds, UK",
    bio: "Baked cardamom bread every Easter since 1968. Recovering from knee surgery." },
  { id: "p_dave", name: "Uncle Dave", birthDate: "1968-06-14", isLiving: true,
    parentIds: ["p_arthur", "p_nana"], spouseIds: [], photoUri: PHOTO.dave,
    location: "Scarborough, UK", bio: "Knows who everyone in the attic photos is. Mostly." },
  { id: "p_sarah", name: "Sarah Miller", birthDate: "1971-09-08", isLiving: true,
    parentIds: ["p_arthur", "p_nana"], spouseIds: ["p_marcus"], photoUri: PHOTO.sarah,
    location: "Vermont, USA", bio: "Started this family circle. Keeper of the shoeboxes." },
  { id: "p_marcus", name: "Marcus Miller", birthDate: "1970-01-30", isLiving: true,
    parentIds: [], spouseIds: ["p_sarah"], photoUri: PHOTO.marcus, location: "Vermont, USA" },
  { id: "p_claire", name: "Aunt Claire", birthDate: "1973-04-19", isLiving: true,
    parentIds: ["p_arthur", "p_nana"], spouseIds: [], photoUri: PHOTO.claire,
    location: "Leeds, UK", bio: "Does the morning care visits. The one who never drops the ball." },
  { id: "p_maya", name: "Maya", birthDate: "1999-08-21", isLiving: true,
    parentIds: ["p_sarah", "p_marcus"], spouseIds: [], photoUri: PHOTO.maya,
    location: "Bristol, UK", bio: "Owns Barnaby, the golden retriever menace." },
  { id: "p_leo", name: "Leo", birthDate: "2012-05-02", isLiving: true,
    parentIds: ["p_sarah", "p_marcus"], spouseIds: [], photoUri: PHOTO.leo,
    location: "Vermont, USA" },
];

// ---------------------------------------------------------------------------
// Chat -- the feature that replaces the family WhatsApp group
// ---------------------------------------------------------------------------

export const threads: Thread[] = [
  { id: "t_all", title: "All Family", kind: "general", audience: "everyone",
    memberIds: people.map((p) => p.id) },
  // Scoped to the care sub-circle: Nana's medical detail is not group chat.
  { id: "t_care", title: "Nana's Care", kind: "care", audience: "care",
    memberIds: ["p_sarah", "p_claire", "p_dave", "p_marcus"] },
  { id: "t_cousins", title: "Cousins Only", kind: "planning", audience: "branch",
    memberIds: ["p_maya", "p_leo"] },
];

export const messages: Message[] = [
  {
    id: "m1", threadId: "t_all", authorId: "p_nana", authorName: "Nana Ruth",
    createdAt: "2024-10-14T08:42:00Z",
    audio: { id: "a1", kind: "audio", uri: "mock://voice/nana-morning", durationSec: 102 },
    // Transcription is what makes an elder's voice searchable. It is presented as
    // a quotation, never silently merged into typed text.
    transcript:
      "Good morning darling! Claire brought over those delicious cinnamon scones and my " +
      "knee is feeling much better after the gentle morning garden stroll...",
    // Reaction keys are semantic words, not emoji characters: the UI maps them to
    // vector glyphs, so the data model carries meaning rather than presentation.
    reactions: { cherish: ["p_claire", "p_marcus", "p_leo"] },
    seenBy: ["p_nana", "p_marcus", "p_sarah", "p_claire", "p_maya", "p_dave", "p_leo"],
    contextLabel: "Hearth Voice",
  },
  {
    id: "m2", threadId: "t_all", authorId: "p_marcus", authorName: "Marcus",
    createdAt: "2024-10-14T08:58:00Z",
    body: "Claire's famous cinnamon glazed! Still piping hot. Dropping some at your door shortly!",
    photos: [{ id: "ph1", kind: "photo", uri: PHOTO.scones }],
    contextLabel: "Nana's Favorite Recipe",
    reactions: { love: ["p_sarah", "p_maya", "p_leo"] },
    seenBy: people.map((p) => p.id).slice(0, 7),
  },
  {
    id: "m3", threadId: "t_care", authorId: "p_claire", authorName: "Aunt Claire",
    createdAt: "2024-10-14T09:20:00Z",
    body: "Morning BP done: 124/78. She slept through the night for the first time this week.",
    seenBy: ["p_sarah", "p_marcus"],
  },
];

// ---------------------------------------------------------------------------
// Care -- who is visiting when, what the doctor said, which repeats are due
// ---------------------------------------------------------------------------

export const careCircles: CareCircle[] = [
  {
    id: "cc_nana", personId: "p_nana",
    status: "In good spirits · Gentle rest day", mood: "Bright",
    memberIds: ["p_sarah", "p_claire", "p_dave", "p_marcus"],
    recoveryWeek: 3,
    dietaryNote: "Low potassium & tender textures",
  },
];

export const careTasks: CareTask[] = [
  { id: "ct1", circleId: "cc_nana", kind: "medication",
    title: "Morning BP & Metoprolol (50mg)", timeText: "09:00 AM", date: "2024-10-14",
    done: true, result: "BP 124/78", claimedByName: "Claire",
    detail: "Administered by Claire" },
  { id: "ct2", circleId: "cc_nana", kind: "appointment",
    title: "Physical Therapy @ St. Jude", timeText: "01:30 PM", date: "2024-10-14",
    done: false, urgent: true,
    detail: "Knee extension & stability session. Room 204.",
    claimedByName: "Marcus", result: "Marcus picking up at 1:00 PM" },
  // The unclaimed slot is the entire point of the feature: it is visible, and
  // one tap makes it somebody's job instead of nobody's.
  { id: "ct3", circleId: "cc_nana", kind: "meal",
    title: "Dinner Drop-off & 30-min Check-in", timeText: "05:30 PM", date: "2024-10-14",
    done: false, urgent: true,
    detail: "Warm meal delivery and evening tea companionship." },
];

export const doctorNotes: DoctorNote[] = [
  {
    id: "dn1", circleId: "cc_nana", clinician: "Dr. Amara Post-Op Review",
    createdAt: "2024-10-13T15:00:00Z", recordedByName: "Claire", validated: true,
    summary:
      "Right knee is healing beautifully with zero sign of infection. We can reduce the " +
      "heavy compression wrap to evening wear only. Next routine checkup in exactly 4 weeks.",
    audio: { id: "a2", kind: "audio", uri: "mock://voice/dr-amara", durationSec: 102 },
  },
];

export const medications: Medication[] = [
  { id: "md1", circleId: "cc_nana", name: "Calcium + Vitamin D3", dose: "1 tab daily",
    schedule: "with breakfast", daysLeft: 6, pharmacy: "Walgreens on Main",
    pickupByName: "Marcus" },
  { id: "md2", circleId: "cc_nana", name: "Lisinopril (10mg)", dose: "Blood pressure control",
    schedule: "Nightly at 8:00 PM", daysLeft: 28 },
];

export const mealSlots: MealSlot[] = [
  { id: "ms1", circleId: "cc_nana", date: "2024-10-25", dayLabel: "WED", dateLabel: "25",
    title: "Sarah's Chicken & Veggie Broth", detail: "Low sodium, brings extra sourdough rolls",
    claimedByName: "Sarah" },
  { id: "ms2", circleId: "cc_nana", date: "2024-10-26", dayLabel: "THU", dateLabel: "26",
    detail: "Nana loves pasta, stew, or mild curries" },
  { id: "ms3", circleId: "cc_nana", date: "2024-10-27", dayLabel: "FRI", dateLabel: "27",
    title: "Tom & Kids Dinner Night", detail: "Mild Shepherd's Pie + puzzle hour",
    claimedByName: "Tom" },
];

/**
 * Offline-available by design. This is the screen you hand a paramedic, so it
 * must never depend on a network round-trip.
 */
export const emergencyCards: EmergencyCard[] = [
  {
    personId: "p_nana",
    bloodType: "O+",
    allergies: ["Penicillin", "Shellfish"],
    conditions: ["Hypertension", "Right knee replacement (Sep 2024)"],
    medications: ["Metoprolol 50mg", "Lisinopril 10mg", "Calcium + D3"],
    clinicians: [
      { role: "Surgeon", name: "Dr. Amara Okafor", phone: "+44 113 496 0182" },
      { role: "GP", name: "Dr. Ellis Hartley", phone: "+44 113 496 7741" },
    ],
    contacts: [
      { relation: "Daughter (primary)", name: "Aunt Claire", phone: "+44 7700 900 118" },
      { relation: "Daughter", name: "Sarah Miller", phone: "+1 802 555 0143" },
    ],
    powerOfAttorney: "Aunt Claire holds health & welfare LPA (registered 2023)",
  },
];

// ---------------------------------------------------------------------------
// Recipe box -- the cheapest emotional win available
// ---------------------------------------------------------------------------

export const recipes: Recipe[] = [
  {
    id: "r1",
    title: "Nana Ruth's Cardamom & Apple Braided Bread",
    attribution: "Nana Ruth", personId: "p_nana",
    provenance:
      "Baked every Easter morning since 1968 in Leeds. The secret is double-cardamom " +
      "pods ground by hand in the mortar, never pre-ground.",
    origin: "Leeds, UK", originYear: "1968",
    prepText: "Prep: 45m", yieldText: "Yield: 2 Loaves",
    photoUri: PHOTO.bread, cardPhotoUri: PHOTO.recipeCard,
    tradition: "Sunday Tradition",
    ingredients: [
      "500g strong white flour",
      "12 green cardamom pods, hulled and ground by hand",
      "2 Bramley apples, coarsely grated",
      "150ml whole milk, blood warm",
      "7g dried yeast",
      "80g salted butter, softened",
      "60g caster sugar, plus extra for the crust",
    ],
    steps: [
      "Warm the milk to blood temperature -- if it feels like nothing on your wrist, it is right.",
      "Grind the cardamom in the mortar until the kitchen smells of it. Do not use pre-ground.",
      "Mix, then knead 10 minutes. Prove until doubled, about 90 minutes by the radiator.",
      "Fold in the grated apple, divide into three, and braid loosely -- it will tighten as it proves.",
      "Second prove 40 minutes. Bake 190C for 30-35 minutes until it sounds hollow underneath.",
    ],
    voiceNote: { id: "a3", kind: "audio", uri: "mock://voice/nana-proofing", durationSec: 48 },
    voiceNoteLabel: "Nana on proofing the dough",
  },
  {
    id: "r2", title: "Great Grandma Ida's Rhubarb Crumble",
    attribution: "Great Grandma Ida",
    provenance: "With custard pouring notes, written on the back of a betting slip.",
    photoUri: PHOTO.rhubarb, prepText: "Prep: 20m", yieldText: "Yield: 6",
    ingredients: ["600g forced rhubarb", "175g plain flour", "110g demerara", "100g cold butter"],
    steps: ["Roast the rhubarb dry first, or you will get soup.", "Rub the crumble coarse -- lumps are correct."],
  },
  {
    id: "r3", title: "Grampa Joe's Stout Beef Pot",
    attribution: "Grampa Joe",
    provenance: "Voice tip recorded by Uncle Dave, who insists the stout must be flat.",
    photoUri: PHOTO.beefPot, prepText: "Prep: 3h", yieldText: "Yield: 8",
    ingredients: ["1.2kg beef shin", "500ml stout, left open overnight", "4 carrots", "2 onions"],
    steps: ["Brown the shin properly. Grey meat makes grey stew.", "Three hours at 150C. No shortcuts."],
    voiceNote: { id: "a4", kind: "audio", uri: "mock://voice/dave-stout", durationSec: 36 },
    voiceNoteLabel: "Uncle Dave on why the stout must be flat",
  },
];

// ---------------------------------------------------------------------------
// "Who is this?" -- a race against time
// ---------------------------------------------------------------------------

export const archivePhotos: ArchivePhoto[] = [
  {
    id: "ap1", uri: PHOTO.oldFamily,
    provenance: "Found in Great Aunt Eleanor's attic box (c. 1954)",
    question: "Do you recognize the young girl holding the calico ragdoll?",
    detail:
      "Uncle Dave thought it might be Aunt Beth when she was six in Scarborough, but the " +
      "dates on the back suggest Leeds.",
    askingNames: ["Nana Ruth", "Uncle Dave"],
    // Coordinates are 0-1 fractions of the photo, so they survive any layout.
    faces: [
      { id: "f1", x: 0.36, y: 0.63, guess: "Uncle Arthur?" },
      { id: "f2", x: 0.50, y: 0.60, name: "Great Aunt Eleanor" },
      { id: "f3", x: 0.60, y: 0.62, guess: "Girl with bow" },
      { id: "f4", x: 0.78, y: 0.60, guess: "Woman in pale dress" },
    ],
    clues: [
      { authorName: "Nana Ruth", whenText: "Yesterday",
        body: "That's definitely Clara's hair ribbon -- she wore it every Whitsun." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Calendar -- birthdays auto-fill from the tree so nobody types them
// ---------------------------------------------------------------------------

export const events: FamilyEvent[] = [
  { id: "e1", kind: "birthday", title: "Nana Ruth turns 80", date: "2024-11-12",
    auto: true, personIds: ["p_nana"],
    note: "The big one. Collective memory book is being bound for it." },
  { id: "e2", kind: "gathering", title: "Annual Apple Cider Pressing", date: "2024-10-24",
    personIds: ["p_sarah", "p_marcus", "p_leo", "p_maya"], location: "Vermont orchard",
    rsvpYes: ["p_sarah", "p_marcus", "p_leo"],
    potluck: [
      { id: "pl1", item: "Doughnuts", claimedByName: "Maya" },
      { id: "pl2", item: "Flask of tea" },
      { id: "pl3", item: "The press cloths", claimedByName: "Marcus" },
    ] },
  { id: "e3", kind: "appointment", title: "Nana: physio @ St. Jude", date: "2024-10-14",
    personIds: ["p_nana"], location: "Room 204" },
  { id: "e4", kind: "milestone", title: "Maya's first house completion", date: "2024-11-01",
    personIds: ["p_maya"], note: "Modern milestone -- not a birth or a wedding, still enormous." },
];

/** One-tap warm pings. Zero composition cost is the whole design goal. */
export const nudges: Nudge[] = [
  { personId: "p_nana", action: "Send Tea" },
  { personId: "p_dave", action: "Cheer" },
  { personId: "p_maya", action: "Sunshine" },
  { personId: "p_leo", action: "High-Five" },
];

// ---------------------------------------------------------------------------
// The archive -- speed 2
//
// Deliberately spans ALL SIX memory kinds, because the fixture is what the design gets
// judged against and a set of three achievements is exactly the highlight-reel problem
// docs/memory_kinds.md exists to fix. A real family's archive holds a cider press, a
// cancer scare, a funeral and a dog eating a cake -- and the app has to look right
// holding all of them at once.
// ---------------------------------------------------------------------------

export const deeds: Deed[] = [
  {
    id: "d1",
    kind: "greatDeed",
    title: "The Annual Apple Cider Pressing",
    whenText: "October 24, 2021",
    whenDate: "2021-10-24",
    story:
      "Grandpa Arthur built that wooden press in 1978. Every autumn since, we gather at " +
      "the orchard barn to press fresh cider until our fingers are sticky and cold.\n\n" +
      "We picked 42 pounds of Honeycrisp that year. Leo was small enough to sit in the " +
      "empty crate, and he did, for most of the afternoon.",
    personIds: ["p_arthur", "p_sarah", "p_leo"],
    tags: ["Craft", "Community"],
    media: [{ id: "m_orchard", kind: "photo", uri: PHOTO.orchard }],
    authorId: "p_sarah", authorName: "Sarah Miller",
    createdAt: "2021-10-24T18:00:00Z",
    audience: "everyone",
    reactions: { applaud: ["p_dave", "p_claire"], inspire: ["p_maya"],
      cherish: ["p_nana", "p_marcus"], love: ["p_leo"] },
  },
  {
    id: "d2",
    kind: "greatDeed",
    title: "Built a cabin by hand for the family",
    whenText: "Summer of 1978",
    whenDate: "1978-07-01",
    story:
      "Grandpa Arthur spent three months of evenings and every weekend that summer " +
      "clearing the plot by the lake. He borrowed a truck, felled the pines himself, and " +
      "worked from a drawing he kept folded in his shirt pocket.\n\nHe always said the " +
      "cabin was for us, not for him. Every grandchild has slept under that roof. The door " +
      "still sticks in August, and nobody has ever wanted to fix it.",
    personIds: ["p_arthur"],
    tags: ["Craft", "Kindness"],
    media: [],
    authorId: "p_dave", authorName: "Uncle Dave",
    createdAt: "2024-05-18T14:02:00Z",
    audience: "everyone",
    reactions: { applaud: ["p_sarah", "p_claire"], inspire: ["p_sarah"], cherish: ["p_maya"], love: [] },
  },
  {
    id: "d3",
    kind: "greatDeed",
    title: "Fed the whole street after the storm",
    whenText: "October 1996",
    whenDate: "1996-10-12",
    story:
      "The power was out for six days. Nana Ruth cooked on a camp stove in the driveway " +
      "and refused to let a single pot go to the family alone. She said it would spoil " +
      "otherwise, but the freezer was full and we all knew what she was doing.",
    personIds: ["p_nana"],
    tags: ["Kindness", "Community"],
    media: [],
    authorId: "p_sarah", authorName: "Sarah Miller",
    createdAt: "2024-09-02T09:15:00Z",
    audience: "everyone",
    reactions: { applaud: ["p_dave"], inspire: ["p_dave", "p_claire"],
      cherish: ["p_sarah", "p_maya"], love: ["p_claire"] },
  },

  /**
   * A HARD TIME. The reason the whole taxonomy exists.
   *
   * Note what it does NOT have: no applaud, no inspire. It carries 'hold' -- the response
   * a family actually wants to give this -- and mayResurface is false, so On This Day will
   * never spring it on anybody in October.
   *
   * Audience is 'adults': Leo is nine.
   */
  {
    id: "d4",
    kind: "hardTime",
    title: "The autumn Dad was in hospital",
    whenText: "October 2019",
    whenDate: "2019-10-08",
    story:
      "Six weeks, and for the first two nobody said the word out loud. Claire moved into " +
      "the spare room and did the early visits so Sarah could keep the school run going." +
      "\n\n" +
      "He came home on a Tuesday. We are writing it down because it was the hardest thing " +
      "this family has done together, and because Claire never once mentioned that she had " +
      "put her own life on hold to do it.",
    personIds: ["p_arthur", "p_claire"],
    tags: ["Kindness"],
    media: [],
    authorId: "p_sarah", authorName: "Sarah Miller",
    createdAt: "2019-11-20T20:30:00Z",
    audience: "adults",
    mayResurface: false,
    reactions: { hold: ["p_dave", "p_nana"], strength: ["p_marcus"], love: ["p_maya"] },
  },

  /**
   * IN MEMORY. Attached to a person who has died; never resurfaced automatically.
   */
  {
    id: "d5",
    kind: "inMemory",
    title: "Grandad's funeral",
    whenText: "November 2018",
    whenDate: "2018-11-29",
    story:
      "It rained the entire way through and nobody moved. Dave read the thing about the " +
      "cabin and got most of the way to the end." +
      "\n\n" +
      "The church was full of people we had never met who all knew exactly who he was.",
    personIds: ["p_arthur"],
    tags: [],
    media: [],
    authorId: "p_claire", authorName: "Aunt Claire",
    createdAt: "2018-12-02T11:00:00Z",
    audience: "everyone",
    mayResurface: false,
    reactions: { cherish: ["p_sarah", "p_dave", "p_nana"], love: ["p_maya", "p_marcus"], hold: ["p_leo"] },
  },

  /**
   * FAMILY LORE. No subject, no real date -- and that is the point. A family has forty of
   * these and none of them survive a generation unless somebody writes them down.
   */
  {
    id: "d6",
    kind: "lore",
    title: "Why Leo is called Bean",
    whenText: "Nobody can agree",
    story:
      "Maya says she started it. Marcus says it was Nana. Nana says she would never have " +
      "called a baby a legume." +
      "\n\n" +
      "Eleven years later he still answers to it, and two of his teachers think it is his " +
      "actual name.",
    personIds: [],
    tags: [],
    media: [],
    authorId: "p_maya", authorName: "Maya",
    createdAt: "2024-03-11T19:45:00Z",
    audience: "everyone",
    reactions: { laugh: ["p_sarah", "p_dave", "p_claire", "p_marcus"], cherish: ["p_nana"] },
  },

  /**
   * A MEMORY. Small, undated, unimportant, and exactly the kind of thing the 4-step
   * wizard was scaring people away from writing.
   */
  {
    id: "d7",
    kind: "memory",
    title: "Saturday mornings in her kitchen",
    whenText: "The nineties, mostly",
    story:
      "Radio 4 on too loud, the good butter out on the counter going soft, and whatever was " +
      "in the oven being checked far more often than it needed to be.",
    personIds: ["p_nana"],
    tags: [],
    media: [],
    authorId: "p_dave", authorName: "Uncle Dave",
    createdAt: "2024-08-14T08:20:00Z",
    audience: "everyone",
    reactions: { cherish: ["p_sarah", "p_claire"], love: ["p_nana"] },
  },

  /**
   * A MILESTONE. Modern, small, and worth marking -- ideas.md section 6 is explicit that
   * these are not just births and weddings.
   */
  {
    id: "d8",
    kind: "milestone",
    title: "Maya passed her driving test",
    whenText: "3 September 2024",
    whenDate: "2024-09-03",
    story: "Third attempt. She rang from the test centre car park before she rang her mother.",
    personIds: ["p_maya"],
    tags: ["Achievement"],
    media: [],
    authorId: "p_marcus", authorName: "Marcus",
    createdAt: "2024-09-03T14:10:00Z",
    audience: "everyone",
    reactions: { applaud: ["p_sarah", "p_nana", "p_dave"], love: ["p_leo"] },
  },
];

export const comments: Comment[] = [
  { id: "c1", deedId: "d2", authorId: "p_sarah", authorName: "Sarah Miller",
    body: "I still have the folded drawing. It was in his toolbox.",
    createdAt: "2024-05-18T19:20:00Z" },
  { id: "c2", deedId: "d2", authorId: "p_maya", authorName: "Maya",
    body: "He let me hammer exactly one nail and then quietly took it out later.",
    createdAt: "2024-05-19T08:05:00Z" },
  { id: "c3", deedId: "d1", authorId: "p_leo", authorName: "Leo",
    body: "I remember the crate. It was a good crate.",
    createdAt: "2024-10-25T07:30:00Z" },
];

// STORY_PROMPTS moved to src/config.ts and DAILY_CHUCKLE was deleted: both were
// product copy rather than fixture data, and having screens import them from here is
// what let this file reach the runtime at all. Nothing outside server/src/seed.ts may
// import this module.
// ---------------------------------------------------------------------------
// The Letter Box
//
// One letter with a confirmed transcription and one WITHOUT, because the unconfirmed state
// is a real state the UI has to look right in -- an OCR guess is a draft until a human has
// read it against the original.
// ---------------------------------------------------------------------------

export const letters: Letter[] = [
  {
    id: "let1",
    kind: "letter",
    title: "Arthur to Ruth, the week before the wedding",
    fromName: "Grandpa Arthur",
    fromPersonId: "p_arthur",
    toName: "Nana Ruth",
    toPersonId: "p_nana",
    whenText: "14 March 1967",
    whenDate: "1967-03-14",
    transcript:
      "My dearest Ruth,\n\nI have counted it out and it is eleven days. Mother has been " +
      "making lists at me since Sunday and I have agreed to all of it because I am not " +
      "listening to a word.\n\nI walked past the plot by the lake again on Thursday. One " +
      "day, Ruth. Not this year and probably not the next, but one day there will be " +
      "something standing on it that I built, and you will complain about the door.",
    transcriptConfirmed: true,
    provenance: "Nana Ruth bedside drawer",
    heldByName: "Nana Ruth",
    pages: [],
    audience: "everyone",
    createdAt: "2024-06-02T10:00:00Z",
  },
  {
    id: "let2",
    kind: "card",
    title: "Great Aunt Eleanor, Christmas card",
    fromName: "Great Aunt Eleanor",
    whenText: "Postmarked 1954, undated",
    // Deliberately unconfirmed AND obviously imperfect: this is what a machine reading of
    // difficult handwriting actually looks like, and the UI must present it as a draft.
    transcript:
      "Dearest all — a very happy Christmas from [illegible] and the girls. The weather " +
      "here has been [illegible] frightful but we managed the walk on Boxing Day as always.",
    transcriptConfirmed: false,
    provenance: "Great Aunt Eleanor attic box (c. 1954)",
    heldByName: "Uncle Dave",
    pages: [],
    audience: "everyone",
    createdAt: "2024-07-19T16:30:00Z",
  },
];

// ---------------------------------------------------------------------------
// The Voice Vault
//
// Both entries carry the QUESTION they answered, because an answer without its question is
// half a record once nobody remembers what was asked.
// ---------------------------------------------------------------------------

export const voices: VoiceRecording[] = [
  {
    id: "vr1",
    title: "Nana Ruth on her first job",
    speakerName: "Nana Ruth",
    speakerPersonId: "p_nana",
    prompt: "What was your first job, and what did it pay?",
    whenText: "Recorded March 2024",
    whenDate: "2024-03-16",
    audio: {
      id: "a_first_job", kind: "audio", uri: "mock://voice/nana-first-job", durationSec: 214,
      transcript:
        "The mill office, and I was fifteen. Four pounds twelve a week and I gave three of " +
        "it to my mother without being asked, because that is simply what you did. I bought " +
        "a coat with the first month that was entirely the wrong colour.",
    },
    audience: "everyone",
    createdAt: "2024-03-16T14:00:00Z",
  },
  {
    id: "vr2",
    title: "Uncle Dave on the attic photographs",
    speakerName: "Uncle Dave",
    speakerPersonId: "p_dave",
    prompt: "What is a phrase your parents said that nobody says any more?",
    whenText: "Recorded August 2024",
    whenDate: "2024-08-04",
    audio: {
      id: "a_phrase", kind: "audio", uri: "mock://voice/dave-phrase", durationSec: 96,
      transcript:
        "Dad used to say a thing was going to be a fine old how do you do. Never explained " +
        "it, never once said it about anything that turned out well.",
    },
    audience: "everyone",
    createdAt: "2024-08-04T19:20:00Z",
  },
];
// ---------------------------------------------------------------------------
// Objects & Heirlooms
//
// One object with a real THREE-LINK custody chain (the point of the feature), and one that
// is LOST -- because "nobody knows where it went" is a state the UI has to look right in,
// and it is the state families most need the archive to hold.
// ---------------------------------------------------------------------------

export const objects: FamilyObject[] = [
  {
    id: "obj1",
    name: "Nana Ruth's engagement ring",
    kind: "jewellery",
    story:
      "Arthur paid it off over fourteen months and never told her that, though she worked " +
      "it out from the pawnbroker's receipt he left in a coat pocket in 1969.\n\n" +
      "She wore it every day for fifty-one years and took it off exactly twice: once for " +
      "the knee surgery, and once to let Maya try it on.",
    originText: "Bought in Leeds",
    originYear: "1966",
    originPersonId: "p_nana",
    originPersonName: "Nana Ruth",
    heldByPersonId: "p_nana",
    heldByName: "Nana Ruth",
    whereKept: "The blue box on top of the wardrobe",
    status: "held",
    photos: [],
    custody: [
      { id: "oc1", personId: "p_nana", holderName: "Nana Ruth", fromText: "1966",
        note: "Arthur proposed on the steps of the town hall in the rain." },
    ],
    audience: "everyone",
    createdAt: "2024-04-02T11:00:00Z",
  },
  {
    id: "obj2",
    name: "Grandpa Arthur's carpentry chest",
    kind: "tool",
    story:
      "The chest he built the cabin out of, and then kept the tools in for forty years. " +
      "Dave has it now and still uses the chisels, which is what Arthur would have wanted " +
      "far more than it sitting in a case.",
    originText: "Made it himself from the offcuts",
    originYear: "1978",
    originPersonId: "p_arthur",
    originPersonName: "Grandpa Arthur",
    heldByPersonId: "p_dave",
    heldByName: "Uncle Dave",
    whereKept: "His workshop in Scarborough",
    status: "held",
    photos: [],
    // Three links: this is what a provenance looks like, and what a single
    // current-holder field would have thrown away.
    custody: [
      { id: "oc2", personId: "p_arthur", holderName: "Grandpa Arthur", fromText: "1978" },
      { id: "oc3", personId: "p_nana", holderName: "Nana Ruth", fromText: "After the funeral, 2018",
        note: "She could not bear to have it moved out of the house at first." },
      { id: "oc4", personId: "p_dave", holderName: "Uncle Dave", fromText: "Spring 2021",
        note: "She asked him to take it because it should be used." },
    ],
    audience: "everyone",
    createdAt: "2024-05-18T15:00:00Z",
  },
  {
    id: "obj3",
    name: "The Bible with the family names in the front",
    kind: "book",
    story:
      "Births and marriages written inside the cover in six different hands, the earliest " +
      "in 1871. It went missing somewhere between clearing the house and the removal van.",
    originYear: "c. 1860",
    // LOST -- and the note is what makes the record useful rather than just sad.
    status: "lost",
    statusNote:
      "Last certainly seen at the house clearance in November 2018. Claire thinks it may " +
      "have gone into a box of the good crockery.",
    photos: [],
    custody: [
      { id: "oc5", holderName: "The Miller family", fromText: "1871" },
    ],
    audience: "everyone",
    createdAt: "2024-09-30T09:00:00Z",
  },
];
