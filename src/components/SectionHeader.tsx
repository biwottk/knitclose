import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, spacing, TOUCH_MIN } from "../theme";

/**
 * The repeating rhythm of every screen: a heading on the left, an optional quiet
 * action or count on the right.
 *
 * WHAT CHANGED: the icon is a real vector glyph rendered in the brand's forest
 * green rather than an emoji, and a tappable action now carries a chevron so it
 * reads as navigation instead of as decorative coloured text.
 *
 * Pulling this out keeps the ~twelve section headings across the app from drifting
 * apart by a few pixels each, which is how a print-inspired layout quietly stops
 * looking designed.
 */
export function SectionHeader({
  title, icon, action, actionLabel, onAction, compact,
}: {
  title: string;
  icon?: IconName;
  /** Plain right-hand text, e.g. "Week 3 of Recovery". */
  action?: string;
  /** Tappable right-hand text, e.g. "View all 28". */
  actionLabel?: string;
  onAction?: () => void;
  /** Sans label rather than serif -- for headings inside a card. */
  compact?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon ? (
          <Icon
            name={icon}
            size={compact ? 17 : 20}
            color={colors.primary}
            strokeWidth={2.1}
          />
        ) : null}
        <AppText
          variant={compact ? "label" : "subtitle"}
          style={styles.title}
          numberOfLines={2}
        >
          {title}
        </AppText>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={12}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        >
          <AppText variant="labelSm" color={colors.secondary}>{actionLabel}</AppText>
          <Icon name="chevronRight" size={15} color={colors.secondary} />
        </Pressable>
      ) : action ? (
        // numberOfLines={1} is deliberate: a right-hand status that wraps to two
        // lines pushes the row's height around and reads as a broken layout. If it
        // does not fit on one line, the label is too long for the slot.
        <AppText
          variant="labelSm"
          color={colors.onSurfaceFaint}
          numberOfLines={1}
          style={styles.actionText}
        >
          {action}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 30,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, flexShrink: 1 },
  title: { flexShrink: 1 },
  action: {
    flexDirection: "row", alignItems: "center", gap: 2,
    minHeight: TOUCH_MIN - 16, justifyContent: "center", flexShrink: 0,
  },
  actionText: { flexShrink: 1, textAlign: "right" },
});
