/**
 * Design tokens -- "Kinship & Hearth", 2020s refresh.
 *
 * The bones of the original system were right: warm earthen pigments, editorial
 * serif for the family's own words, no tech blue. What made it read as a mid-2010s
 * app was not the palette -- it was the *execution*: emoji standing in for icons,
 * hairline-boxed cards everywhere, flat single-value surfaces, cramped radii, and
 * no motion vocabulary at all.
 *
 * So this file keeps the brand and modernises the mechanics:
 *
 *   1. LOGO-DERIVED BRAND. Forest #1A4230 and terracotta #C1542F are sampled
 *      from the actual mark in design/screen.png, so the app and its logo finally
 *      agree. The old #07241A primary was so dark it read as black.
 *   2. SOFT DEPTH. Large radii (20/28) plus layered, warm-tinted, low-opacity
 *      shadows instead of a 1px box around everything. Borders are now the
 *      exception, used for genuine separation, not decoration.
 *   3. REAL TYPE SCALE. Fraunces (a modern variable-flavoured serif) and Plus
 *      Jakarta Sans, with optical letter-spacing per role -- the tight tracking on
 *      display sizes is most of what separates 2024 typography from 2014.
 *   4. MOTION AS A TOKEN. Durations and spring configs live here so transitions
 *      are consistent instead of hand-tuned per component.
 *
 * Multi-generational accessibility remains a hard constraint, not a polish pass:
 * 17px body baseline, nothing below 12px, and a mandatory 48x48 touch zone even
 * where the visible control is smaller.
 */

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * Surfaces. A warm neutral ladder. The canvas is very slightly cooler and
 * lighter than the old #FFF8F5 so that cards can sit ON it in pure white and
 * still be distinguishable without needing a border.
 */
const surface = {
  /** App canvas -- warm porcelain. */
  surface: "#FCF9F6",
  surfaceDim: "#EFE7E0",
  /** Cards. Pure white reads as "clean paper" against the warm canvas. */
  surfaceLowest: "#FFFFFF",
  surfaceLow: "#FAF5F1",
  surfaceContainer: "#F4EDE7",
  surfaceHigh: "#EDE4DC",
  surfaceHighest: "#E5DAD1",
  /** Dark inverse surface: espresso, for inverted bubbles and sheets. */
  inverseSurface: "#2B2622",
  inverseOnSurface: "#F7F1EC",
};

/** Ink. Espresso rather than pure black -- less eye strain on cheap screens. */
const ink = {
  onSurface: "#1C1917",
  onSurfaceVariant: "#5A524C",
  /** Metadata that must stay legible but recede. */
  onSurfaceFaint: "#857A72",
  outline: "#8A807A",
  /** Hairlines. Only where a real edge is needed. */
  outlineVariant: "#E7DED6",
};

/**
 * Primary -- Forest Pine, sampled from the logo's green strand (#1A4230).
 * Endurance, dignity, calm authority. Primary actions, navigation state,
 * archive/heirloom framing.
 */
const primary = {
  primary: "#1A4230",
  onPrimary: "#FFFFFF",
  /** Slightly lifted pine for large fills and dark cards. */
  primaryContainer: "#24543E",
  onPrimaryContainer: "#B8D5C5",
  /** Pale mint wash for tints and selected chips. */
  primaryFixed: "#D6EADD",
  primaryFixedDim: "#A9CBB8",
  onPrimaryFixed: "#08251A",
  onPrimaryFixedVariant: "#2A5C44",
  inversePrimary: "#A9CBB8",
};

/**
 * Secondary -- Terracotta, sampled from the logo's clay strand (#C1542F).
 * Hearth warmth, spontaneity, "someone did a thing today". Owns Quick Share,
 * live/urgent care states, and milestone moments.
 */
const secondary = {
  secondary: "#C1542F",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#E4753F",
  onSecondaryContainer: "#5E2109",
  secondaryFixed: "#FCE3D6",
  secondaryFixedDim: "#F3BFA5",
  onSecondaryFixed: "#431604",
  onSecondaryFixedVariant: "#8E3A18",
};

/**
 * Tertiary -- Warm Amber. Soft reminders, celebration, time-capsule unlocks.
 * Deliberately never alarmist: amber nudges, it does not shout.
 */
const tertiary = {
  tertiary: "#8A5A0B",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#B57A15",
  onTertiaryContainer: "#FFF0D2",
  tertiaryFixed: "#FDEBC8",
  tertiaryFixedDim: "#F2CE87",
  onTertiaryFixed: "#2E1D00",
  onTertiaryFixedVariant: "#6B4506",
};

const error = {
  error: "#B3261E",
  onError: "#FFFFFF",
  errorContainer: "#FCDAD6",
  onErrorContainer: "#8C1D18",
};

export const colors = {
  ...surface,
  ...ink,
  ...primary,
  ...secondary,
  ...tertiary,
  ...error,

  /** Warm hairline. Used sparingly now -- depth comes from shadow and tone. */
  border: "#EDE4DC",
  /** A stronger rule, for genuine structural division (composer, tab bar). */
  borderStrong: "#E0D5CB",
  white: "#FFFFFF",
  surfaceTint: "#2A5C44",

  /** Scrim keeps warmth: espresso at 45%, never a cold neutral grey. */
  scrim: "rgba(28, 25, 23, 0.45)",
};

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Fraunces for anything narrative -- names, archive headers, prompts, the
 * family's own words. It is a contemporary "soft serif" with real personality at
 * display sizes, which is what makes an editorial layout look current rather
 * than like a 2014 Merriweather blog.
 *
 * Plus Jakarta Sans for functional chrome: geometric-humanist, tall x-height,
 * unambiguous 1/l/I, and far less dated than Inter has become through ubiquity.
 *
 * Loaded in App.tsx.
 */
export const fonts = {
  serif: "Fraunces_400Regular",
  serifMedium: "Fraunces_600SemiBold",
  serifBold: "Fraunces_700Bold",
  serifItalic: "Fraunces_400Regular_Italic",
  sans: "PlusJakartaSans_400Regular",
  sansMedium: "PlusJakartaSans_500Medium",
  sansSemi: "PlusJakartaSans_600SemiBold",
  sansBold: "PlusJakartaSans_700Bold",
};

/**
 * The type scale, with OPTICAL LETTER-SPACING baked into each role.
 *
 * This is the single highest-leverage change in the refresh. Display type wants
 * negative tracking (-0.8 at 34px) and small caps labels want positive tracking
 * (+0.6 at 12px); shipping everything at 0 is what makes type look untuned.
 *
 * Body sizes went up a point (17px baseline) because this app is read by
 * grandparents, and 17 is the modern iOS reading default.
 */
export const type = {
  /** The one line you read first on a screen. */
  displayLg: { fontSize: 34, lineHeight: 42, letterSpacing: -0.8 },
  displayMd: { fontSize: 28, lineHeight: 36, letterSpacing: -0.6 },
  headlineLg: { fontSize: 23, lineHeight: 31, letterSpacing: -0.4 },
  headlineMd: { fontSize: 19, lineHeight: 27, letterSpacing: -0.2 },
  /** Pull-quotes, elder voices. Generous leading is load-bearing here. */
  storyCallout: { fontSize: 18, lineHeight: 30, letterSpacing: -0.1 },
  /** Narrative-first views. */
  bodyLg: { fontSize: 18, lineHeight: 28, letterSpacing: -0.1 },
  /** Baseline reading size. */
  bodyMd: { fontSize: 17, lineHeight: 25, letterSpacing: -0.1 },
  bodySm: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  labelLg: { fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  labelMd: { fontSize: 14, lineHeight: 19, letterSpacing: 0 },
  /** ALL-CAPS eyebrow. Hard floor -- never smaller. */
  labelSm: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
};

// ---------------------------------------------------------------------------
// Spacing -- 4pt rhythmic scale
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Screen edge margin on mobile. 20 rather than 16: modern phones are wide. */
export const SCREEN_MARGIN = 20;

/** Gap between stacked cards in a scrolling column. */
export const GUTTER = 14;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/**
 * Substantially rounder than before. 8px corners on a full-width card are the
 * clearest single tell of a mid-2010s layout; contemporary mobile UI sits at
 * 16-28 for containers and goes fully round for controls.
 */
export const radii = {
  sm: 8,
  DEFAULT: 12,
  /** Buttons, inputs, tooltips. */
  control: 14,
  /** Inset elements inside a card (media, sub-panels). */
  inner: 16,
  /** Cards, story modules, media containers. */
  card: 20,
  /** Large feature cards and hero surfaces. */
  cardLg: 26,
  /** Dialogs and bottom sheets. */
  sheet: 32,
  /** Avatars and pill filters. */
  pill: 9999,
};

/**
 * Minimum touch target, enforced even when the visible asset is smaller.
 * Mandatory rather than a guideline.
 */
export const TOUCH_MIN = 48;

/** Text inputs are taller than the touch floor so they are effortless to hit. */
export const INPUT_MIN = 52;

/** List and timeline rows keep this much vertical clearance from each other. */
export const ROW_MIN = 56;

// ---------------------------------------------------------------------------
// Elevation -- layered, warm-tinted, never a cold drop shadow
// ---------------------------------------------------------------------------

/**
 * Real elevation, finally. The old system had one nearly-invisible shadow and
 * leaned on a 1px border for every card, which is why everything looked like a
 * flat boxed table. These are still soft and warm -- the tint is espresso, never
 * neutral black -- but they actually separate layers.
 */
export const shadow = {
  /** Resting cards. Present, but quiet. */
  card: {
    shadowColor: "#3D2E22",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Cards that should feel picked up: hero modules, active states. */
  raised: {
    shadowColor: "#3D2E22",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  /** Overlays, sheets, modals. */
  overlay: {
    shadowColor: "#2B2118",
    shadowOpacity: 0.16,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  /** Floating pill controls and the tab bar, which cast upward. */
  floating: {
    shadowColor: "#3D2E22",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  /** Coloured buttons get a shadow tinted with their own hue. */
  primaryGlow: {
    shadowColor: "#1A4230",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondaryGlow: {
    shadowColor: "#C1542F",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

/** Standard hairline card edge. Now opt-in rather than automatic. */
export const hairline = { borderWidth: 1, borderColor: colors.border };

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Motion tokens. Having these centralised is what keeps press states, reveals
 * and reaction pops feeling like one system instead of twelve improvisations.
 */
export const motion = {
  /** Press feedback and micro-state. */
  fast: 140,
  /** Standard reveal / crossfade. */
  base: 240,
  /** Deliberate, "this matters" transitions. */
  slow: 380,
  /** Springs for anything that should feel physical. */
  spring: { damping: 16, stiffness: 190, mass: 0.9 },
  springBouncy: { damping: 11, stiffness: 220, mass: 0.8 },
  /** Scale applied to a pressed surface. Subtle -- 0.97, not 0.9. */
  pressScale: 0.97,
};

/** Opacity applied to a pressed low-emphasis surface. */
export const PRESSED_OPACITY = 0.7;
