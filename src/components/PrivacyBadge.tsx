import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { colors, radii, spacing } from "../theme";
import { AUDIENCE_LABEL, type Audience } from "../types";

/**
 * Constant reassurance, not a buried settings page. Appears on every post and at
 * the top of any screen holding sensitive material.
 *
 * WHAT CHANGED: the padlock is a real stroked glyph instead of the 🔒 emoji, and
 * the label is sentence case at 14px rather than shouted 12px caps -- a privacy
 * promise delivered in ALL-CAPS reads as a warning label, which is the opposite of
 * the intended tone. The `plain` variant now has no background at all, so it can
 * sit quietly in a card footer.
 *
 * When an `audience` is passed the badge names it, because "only your family" is
 * not specific enough once granular visibility exists -- a care note and a baby
 * photo are both private, but not to the same people. Being explicit here is what
 * lets a family trust the app with the awkward stuff.
 */
export function PrivacyBadge({
  text,
  audience,
  tone = "soft",
}: {
  text?: string;
  audience?: Audience;
  tone?: "soft" | "plain" | "strong";
}) {
  const label =
    text ??
    (audience && audience !== "everyone"
      ? AUDIENCE_LABEL[audience] + " · not the whole circle"
      : "Only your family can see this");

  const strong = tone === "strong";
  const fg = strong ? colors.onSecondaryFixedVariant : colors.onSurfaceFaint;

  return (
    <View
      style={[
        styles.wrap,
        tone === "soft" && styles.soft,
        strong && styles.strong,
      ]}
      accessible
      accessibilityLabel={"Private. " + label}
    >
      {/* Nudged down by a hair so the glyph optically aligns to the cap height
          of the first line rather than to the line box. */}
      <Icon name={strong ? "privacy" : "lock"} size={14} color={fg} strokeWidth={2.2} />
      <AppText variant="labelSm" color={fg} numberOfLines={2} style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // `flex-start` rather than `center`: the strong variant can name six people
    // and wrap to two lines, and a vertically centred padlock beside a two-line
    // label sits visibly adrift of the first word.
    flexDirection: "row", alignItems: "flex-start", gap: spacing.xs + 2,
    alignSelf: "flex-start", paddingVertical: spacing.xs,
    borderRadius: radii.card,
  },
  soft: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.sm + 2,
  },
  strong: {
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
  },
  label: { flexShrink: 1, marginTop: 1 },
});
