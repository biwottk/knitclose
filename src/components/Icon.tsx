import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import {
  Archive, ArrowUp, Award, BellRing, BookHeart, BookOpen, BookmarkPlus, Cake,
  CalendarDays, Camera, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, CircleCheck, CirclePlus, Clock, Cloud, CloudRain, Download, Ear,
  Feather, Flame, Users as FamilyIcon, Gift, Handshake, Heart, HeartHandshake,
  House, Image as ImageIcon, Info, Leaf, Lock, type LucideIcon, MapPin, Mic,
  MessageCircle, MessageSquareText, Moon, Music, Network, Notebook, Package,
  PartyPopper, Pause, PenLine, Phone, Pill, Play, Plus, Quote, Scroll, Search,
  Send, Settings, Share2, Shield, ShieldCheck, SlidersHorizontal, Smile,
  Sparkles, Star, Stethoscope, Sun, Sunrise, Sunset, Trash2, TriangleAlert,
  Utensils, Video, Volume2, Waves, X, Zap,
} from "lucide-react-native";
import { colors, radii } from "../theme";

/**
 * The icon system.
 *
 * WHY THIS EXISTS: the previous build used emoji as its entire icon vocabulary
 * (🏡 💚 📖 🌳 🎤 📷 ✏️ …). Emoji are the single loudest signal that an interface
 * was assembled rather than designed. They render as a different artwork on every
 * OS and version, they carry colour and gloss the design system cannot control,
 * they cannot inherit a text colour or a stroke weight, and they cannot be
 * animated. A 2020s app uses a consistent stroke-based vector set.
 *
 * Lucide is that set here: geometrically consistent, 24px grid, 2px nominal
 * stroke, and it inherits colour and size like text should.
 *
 * Usage is by SEMANTIC NAME, not by library name -- `<Icon name="voice" />`
 * rather than importing Mic at the call site. That indirection means the whole
 * app's iconography can be retuned from this one map, and no screen ever couples
 * itself to lucide's export names.
 */
export type IconName =
  // Navigation
  | "hearth" | "chat" | "care" | "archive" | "kinship"
  // Actions
  | "voice" | "camera" | "photo" | "send" | "add" | "close" | "check"
  | "checkAll" | "edit" | "search" | "settings" | "share" | "download"
  | "trash" | "play" | "pause" | "speed" | "volume" | "waveform"
  | "bookmark" | "promote" | "filter" | "info"
  // Chevrons
  | "chevronDown" | "chevronUp" | "chevronLeft" | "chevronRight"
  // Meaning
  | "heart" | "love" | "cherish" | "applaud" | "inspire" | "reaction"
  | "sparkle" | "quote" | "lock" | "shield" | "privacy" | "people"
  | "person" | "calendar" | "clock" | "gift" | "cake" | "celebrate"
  | "milestone" | "star" | "flame" | "leaf" | "scroll" | "journal"
  | "recipe" | "meal" | "pill" | "medical" | "phone" | "location"
  | "video" | "music" | "note" | "listen" | "alert" | "tree" | "box"
  | "handshake" | "deed"
  // Weather / time of day
  | "sun" | "sunrise" | "sunset" | "moon" | "cloud" | "rain";

const MAP: Record<IconName, LucideIcon> = {
  // Navigation. `hearth` is a house, not a fireplace emoji; `kinship` is a
  // network graph rather than a tree, because the screen shows relationships.
  hearth: House,
  chat: MessageCircle,
  care: HeartHandshake,
  archive: BookOpen,
  kinship: Network,

  voice: Mic,
  camera: Camera,
  photo: ImageIcon,
  send: Send,
  add: Plus,
  close: X,
  check: Check,
  checkAll: CheckCheck,
  edit: PenLine,
  search: Search,
  settings: Settings,
  share: Share2,
  download: Download,
  trash: Trash2,
  play: Play,
  pause: Pause,
  speed: Zap,
  volume: Volume2,
  waveform: Waves,
  bookmark: BookmarkPlus,
  promote: BookHeart,
  filter: SlidersHorizontal,
  info: Info,

  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,

  heart: Heart,
  love: Heart,
  cherish: BookHeart,
  applaud: Award,
  inspire: Sparkles,
  reaction: Smile,
  sparkle: Sparkles,
  quote: Quote,
  lock: Lock,
  shield: Shield,
  privacy: ShieldCheck,
  people: FamilyIcon,
  person: FamilyIcon,
  calendar: CalendarDays,
  clock: Clock,
  gift: Gift,
  cake: Cake,
  celebrate: PartyPopper,
  milestone: BellRing,
  star: Star,
  flame: Flame,
  leaf: Leaf,
  scroll: Scroll,
  journal: Notebook,
  recipe: Utensils,
  meal: Utensils,
  pill: Pill,
  medical: Stethoscope,
  phone: Phone,
  location: MapPin,
  video: Video,
  music: Music,
  note: Feather,
  listen: Ear,
  alert: TriangleAlert,
  tree: Leaf,
  box: Package,
  handshake: Handshake,
  deed: Scroll,

  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  moon: Moon,
  cloud: Cloud,
  rain: CloudRain,
};

export interface IconProps {
  name: IconName;
  /** Visual size in points. Defaults to 20 -- reads alongside 17px body text. */
  size?: number;
  color?: string;
  /**
   * Stroke weight. Lucide's default 2 is right for standalone icons; 2.25 gives
   * small icons enough presence, and 1.75 keeps large ones from looking heavy.
   */
  strokeWidth?: number;
  /** Renders the glyph filled as well as stroked (hearts, stars, play). */
  filled?: boolean;
}

/**
 * Names that reached this component but are not in MAP. Tracked so the warning
 * fires once per bad name instead of once per render, which would flood the log.
 */
const warned = new Set<string>();

export function Icon({ name, size = 20, color = colors.onSurface, strokeWidth, filled }: IconProps) {
  /**
   * WHY THE FALLBACK: `MAP[name]` is typed as always present, but several call
   * sites look a glyph up through a `Record<string, IconName>` keyed on store data
   * (reaction keys, thread kinds, route names). TypeScript types those lookups as
   * total when they are not, so a name that is merely absent used to evaluate to
   * `undefined` and render as `<undefined />`.
   *
   * React's failure for that is "Element type is invalid", thrown from inside this
   * component -- which unmounts the entire screen and shows a blank white page. A
   * missing 20px glyph is a cosmetic problem; taking down the Archive tab is not.
   * So an unknown name degrades to a visible placeholder and a loud dev warning.
   */
  const Glyph = MAP[name] ?? MAP.info;
  if (!MAP[name] && !warned.has(name)) {
    warned.add(name);
    console.warn(`<Icon name="${name}"> is not in the icon map -- falling back to "info".`);
  }

  const weight = strokeWidth ?? (size <= 16 ? 2.25 : size >= 32 ? 1.75 : 2);

  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={weight}
      fill={filled ? color : "none"}
    />
  );
}

/**
 * An icon inside a tinted round container -- the standard "leading affordance"
 * for a list row, a card header, or a callout.
 *
 * Pulling this out matters because the pattern appears ~20 times across the app,
 * and hand-rolling it each time is how the sizes drifted apart before.
 */
export function IconBadge({
  name, size = 40, tone = "neutral", iconSize, style, square,
}: {
  name: IconName;
  /** Container size. The glyph is scaled to ~48% of it. */
  size?: number;
  tone?: IconBadgeTone;
  iconSize?: number;
  style?: ViewStyle;
  /** Squircle rather than a circle -- for app-chrome affordances. */
  square?: boolean;
}) {
  const t = BADGE_TONES[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: square ? Math.round(size * 0.32) : size / 2,
          backgroundColor: t.bg,
        },
        style,
      ]}
    >
      <Icon name={name} size={iconSize ?? Math.round(size * 0.48)} color={t.fg} />
    </View>
  );
}

export type IconBadgeTone =
  | "neutral" | "primary" | "primarySoft" | "secondary" | "secondarySoft"
  | "amber" | "mint" | "paper" | "danger";

const BADGE_TONES: Record<IconBadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceContainer, fg: colors.onSurfaceVariant },
  primary: { bg: colors.primary, fg: colors.onPrimary },
  primarySoft: { bg: colors.primaryFixed, fg: colors.onPrimaryFixedVariant },
  secondary: { bg: colors.secondary, fg: colors.onSecondary },
  secondarySoft: { bg: colors.secondaryFixed, fg: colors.onSecondaryFixedVariant },
  amber: { bg: colors.tertiaryFixed, fg: colors.onTertiaryFixedVariant },
  mint: { bg: colors.primaryFixed, fg: colors.primary },
  paper: { bg: colors.surfaceLowest, fg: colors.primary },
  danger: { bg: colors.errorContainer, fg: colors.onErrorContainer },
};

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
});
