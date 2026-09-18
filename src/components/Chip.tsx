import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, radii, spacing, TOUCH_MIN } from "../theme";

/**
 * Capsule chips: status pills, filter tags, and metadata badges.
 *
 * WHAT CHANGED: chips previously took an emoji string and rendered their label in
 * ALL-CAPS `micro` regardless of context, which made every pill shout. Now the
 * icon is a real vector glyph tinted to the chip's own foreground colour, and the
 * label defaults to sentence case at 14px -- `caps` is opt-in for the cases where
 * an eyebrow label is genuinely wanted.
 *
 * Visible height is 32px, which is below the touch floor, so any *pressable* chip
 * carries hitSlop to reach the mandated 48px zone while staying visually compact.
 */
export type ChipTone =
  | "neutral" | "terracotta" | "amber" | "forest" | "danger" | "mint"
  | "outline" | "ink";

const TONES: Record<ChipTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surfaceContainer, fg: colors.onSurfaceVariant, border: "transparent" },
  terracotta: { bg: colors.secondaryFixed, fg: colors.onSecondaryFixedVariant, border: "transparent" },
  amber: { bg: colors.tertiaryFixed, fg: colors.onTertiaryFixedVariant, border: "transparent" },
  forest: { bg: colors.primary, fg: colors.primaryFixed, border: "transparent" },
  danger: { bg: colors.errorContainer, fg: colors.onErrorContainer, border: "transparent" },
  mint: { bg: colors.primaryFixed, fg: colors.onPrimaryFixedVariant, border: "transparent" },
  /** Transparent with a hairline -- for filters in their unselected state. */
  outline: { bg: "transparent", fg: colors.onSurfaceVariant, border: colors.borderStrong },
  ink: { bg: "rgba(255,255,255,0.16)", fg: colors.inverseOnSurface, border: "transparent" },
};

interface Props {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  /** Fills the icon glyph -- for hearts and stars that read better solid. */
  iconFilled?: boolean;
  /** ALL-CAPS 12px eyebrow styling instead of sentence-case 14px. */
  caps?: boolean;
  /** Renders as a filter tag: outlined until selected, then forest green. */
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({
  label, tone = "neutral", icon, iconFilled, caps, selected, onPress,
}: Props) {
  // A chip that can be selected is a filter: unselected means outlined, not grey.
  const base = selected ? TONES.forest : selected === false ? TONES.outline : TONES[tone];
  const t = selected === undefined ? TONES[tone] : base;

  const inner = (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Icon name={icon} size={14} color={t.fg} filled={iconFilled} /> : null}
      <AppText
        variant={caps ? "micro" : "labelSm"}
        color={t.fg}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </AppText>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      // Visible height stays 32; the real touch target is padded out to 48.
      hitSlop={{ top: (TOUCH_MIN - 32) / 2, bottom: (TOUCH_MIN - 32) / 2, left: 6, right: 6 }}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  label: { flexShrink: 1 },
});
