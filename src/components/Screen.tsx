import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, GUTTER, SCREEN_MARGIN, shadow, spacing } from "../theme";

/**
 * Standard screen frame: warm canvas, 20pt screen margin, 14pt gutter between
 * stacked cards, optional sticky footer for a primary action.
 *
 * SAFE AREA -- read this before changing it.
 *
 * A screen presented WITHOUT a navigation header sits directly under the status
 * bar (clock, battery, notch). Without a top inset its first line of text collides
 * with the clock. That is exactly what shipped once, and it is invisible in a
 * desktop browser because a browser viewport reports zero insets -- so it has to be
 * reasoned about, not just eyeballed on the web build. Append
 * `?insetTop=59&insetBottom=34` to the web URL to reproduce phone insets.
 *
 * Default is `insetTop` ON, because too much breathing room is a cosmetic nit
 * while a clipped title is a broken screen. Pass `insetTop={false}` only when a
 * React Navigation header or our own AppHeader already occupies that space.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  insetTop = true,
  /** Extra bottom padding, e.g. to clear a floating composer. */
  bottomExtra = 0,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  insetTop?: boolean;
  bottomExtra?: number;
}) {
  const insets = useSafeAreaInsets();

  const topPad = insetTop ? { paddingTop: insets.top + spacing.sm } : null;
  const bottomPad = {
    paddingBottom: spacing.xl + bottomExtra + (footer ? 0 : insets.bottom),
  };

  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, topPad, bottomPad]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, topPad]}>{children}</View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(spacing.md, insets.bottom) },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.sm, gap: GUTTER },
  /**
   * The footer floats above the content on a shadow rather than being fenced off
   * by a top border -- the same change made everywhere else in the refresh.
   */
  footer: {
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.md,
    gap: spacing.sm,
    ...shadow.floating,
  },
});
