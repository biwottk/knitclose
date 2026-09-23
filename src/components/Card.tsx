import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, motion, radii, shadow, spacing } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

/**
 * The base surface of the whole app.
 *
 * WHAT CHANGED, AND WHY: previously every card was defined by a 1px hairline
 * around it, with a shadow so faint it was effectively absent. Repeat that forty
 * times down a scroll view and you get a boxed table -- the defining look of a
 * mid-2010s app. Now hierarchy comes from SOFT ELEVATION plus surface tone, with
 * borders reserved for the cases that genuinely need an edge (tinted cards on a
 * tinted background, where a shadow alone cannot separate them).
 *
 * Corners are 20 by default (26 for feature cards) rather than 8, which is the
 * other half of looking current.
 */
export type CardTone =
  /** Bleached paper. The default: the thing you are reading. */
  | "paper"
  /** One step warmer. Groups a set of controls without shouting. */
  | "low"
  /** Warmer still. Quiet panels and grouped sections. */
  | "container"
  /** Warmest neutral. Section wrappers holding other cards. */
  | "high"
  /** Terracotta wash: something is happening today and needs a person. */
  | "alert"
  /** Amber wash: a gentle reminder or a celebration, never alarmist. */
  | "warm"
  /** Mint wash: settled, positive, "this is handled". */
  | "mint"
  /** Forest pine, inverted text. Heirloom framing and archive prompts. */
  | "forest"
  /** Espresso, inverted text. Media-forward bubbles. */
  | "ink";

const TONES: Record<CardTone, { bg: string; border?: string }> = {
  paper: { bg: colors.surfaceLowest },
  low: { bg: colors.surfaceLow },
  container: { bg: colors.surfaceContainer },
  high: { bg: colors.surfaceHigh },
  // Tinted cards keep a faint same-hue edge: a warm shadow cannot separate a
  // terracotta card from a warm canvas on its own.
  alert: { bg: colors.secondaryFixed, border: colors.secondaryFixedDim },
  warm: { bg: colors.tertiaryFixed, border: colors.tertiaryFixedDim },
  mint: { bg: colors.primaryFixed, border: colors.primaryFixedDim },
  forest: { bg: colors.primary },
  ink: { bg: colors.inverseSurface },
};

export type CardElevation = "flat" | "card" | "raised";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  tone?: CardTone;
  /** Depth. `flat` is for cards nested inside another card. */
  elevation?: CardElevation;
  /** Larger 26px radius for hero/feature modules. */
  feature?: boolean;
  /** Makes the whole card a button, with a press-scale response. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({
  children, style, padded = true, tone = "paper", elevation = "card", feature,
  onPress, accessibilityLabel,
}: Props) {
  const t = TONES[tone];
  const reduceMotion = useReducedMotion();

  const surface = [
    styles.card,
    { backgroundColor: t.bg, borderRadius: feature ? radii.cardLg : radii.card },
    t.border ? { borderWidth: 1, borderColor: t.border } : null,
    elevation === "card" ? shadow.card : elevation === "raised" ? shadow.raised : null,
    padded && styles.padded,
    style,
  ];

  if (!onPress) return <View style={surface}>{children}</View>;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        surface,
        // A whole-card press scales rather than dimming: dimming a large surface
        // looks like a rendering glitch, while a 3% scale reads as physical.
        pressed
          ? (reduceMotion ? { opacity: 0.9 } : { transform: [{ scale: motion.pressScale }], opacity: 0.96 })
          : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  /** 18pt interior: generous enough that a family photo reads as a keepsake. */
  padded: { padding: spacing.md + 2 },
});
