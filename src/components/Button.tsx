import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, motion, radii, shadow, spacing, TOUCH_MIN } from "../theme";

/**
 * Buttons.
 *
 * WHAT CHANGED: the old buttons were 8px-radius rectangles with an emoji string
 * for an icon and no depth. These are pill-shaped by default (the contemporary
 * default for a primary action), take a semantic `icon` name that renders a real
 * vector glyph inheriting the label colour, and carry a hue-tinted shadow so a
 * primary action visibly sits above the page.
 *
 *   primary    solid Forest Pine + white     the one obvious action
 *   secondary  solid Terracotta              spontaneous / "today" actions
 *   tonal      mint tint, forest text        the modern default for mid-emphasis
 *   outline    ghost, 1.5px forest border    low pressure, easy to read
 *   quiet      text only                     tertiary utility
 *   danger     error container               destructive, still warm
 */
type Kind = "primary" | "secondary" | "tonal" | "outline" | "quiet" | "danger";

interface Props {
  title: string;
  onPress: () => void;
  kind?: Kind;
  /** Big, single-choice buttons used on onboarding screens. */
  large?: boolean;
  /** Compact height for inline placement next to text. */
  small?: boolean;
  subtitle?: string;
  disabled?: boolean;
  icon?: IconName;
  /** Puts the icon after the label -- for "next"/"continue" affordances. */
  iconTrailing?: boolean;
  /** Stretch to fill its parent row. */
  fill?: boolean;
  /** Square-ish 14px corners instead of a pill. For dense/utility rows. */
  squared?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const PALETTE: Record<Kind, {
  bg: string; fg: string; border: string; sub: string; glow?: ViewStyle;
}> = {
  primary: {
    bg: colors.primary, fg: colors.onPrimary,
    border: colors.primary, sub: colors.primaryFixedDim,
    glow: shadow.primaryGlow as ViewStyle,
  },
  secondary: {
    bg: colors.secondary, fg: colors.onSecondary,
    border: colors.secondary, sub: colors.secondaryFixed,
    glow: shadow.secondaryGlow as ViewStyle,
  },
  tonal: {
    bg: colors.primaryFixed, fg: colors.onPrimaryFixed,
    border: colors.primaryFixed, sub: colors.onPrimaryFixedVariant,
  },
  outline: {
    bg: "transparent", fg: colors.primary,
    border: colors.primary, sub: colors.onSurfaceVariant,
  },
  quiet: {
    bg: "transparent", fg: colors.onSurfaceVariant,
    border: "transparent", sub: colors.onSurfaceFaint,
  },
  danger: {
    bg: colors.errorContainer, fg: colors.onErrorContainer,
    border: colors.errorContainer, sub: colors.onErrorContainer,
  },
};

export function Button({
  title, onPress, kind = "primary", large, small, subtitle, disabled, icon,
  iconTrailing, fill, squared, style, accessibilityLabel,
}: Props) {
  const handlePress = () => {
    // Every meaningful action gets a small physical confirmation.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const palette = PALETTE[kind];
  const glyph = icon ? (
    <Icon name={icon} size={large ? 22 : small ? 16 : 18} color={palette.fg} />
  ) : null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: squared ? radii.control : radii.pill,
        },
        kind === "outline" && styles.outline,
        large && styles.large,
        small && styles.small,
        fill && styles.fill,
        // Only solid buttons float; a ghost or text button casting a shadow is
        // the kind of detail that makes a UI feel unresolved.
        !disabled && palette.glow ? palette.glow : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {!iconTrailing ? glyph : null}
        <View style={styles.labels}>
          <AppText
            variant={large ? "subtitle" : small ? "labelSm" : "label"}
            color={palette.fg}
            center
            numberOfLines={2}
            bold={large}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" color={palette.sub} center style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {iconTrailing ? glyph : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    justifyContent: "center",
  },
  /** The ghost variant gets a heavier rule so it holds its own visually. */
  outline: { borderWidth: 1.5 },
  /** Onboarding-scale buttons: impossible to mis-tap. */
  large: { minHeight: 92, paddingVertical: spacing.md, borderRadius: radii.cardLg },
  small: { minHeight: 38, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  fill: { flex: 1 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm + 2,
  },
  labels: { flexShrink: 1 },
  subtitle: { marginTop: 2 },
  pressed: { opacity: 0.9, transform: [{ scale: motion.pressScale }] },
  disabled: { opacity: 0.4 },
});
