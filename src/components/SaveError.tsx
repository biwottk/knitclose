import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { colors, radii, spacing } from "../theme";
import { ApiError } from "../api";

/**
 * What to show when a save fails, INLINE, directly above the button that failed.
 *
 * WHY NOT Alert.alert: it is a no-op on the web build, so a failed save there produced
 * nothing at all -- the button just un-greyed. On a phone a modal is dismissed and gone,
 * and the person is left wondering whether to tap again. A banner stays until the next
 * attempt, sits beside the action it refers to, and is read by screen readers as it
 * appears.
 *
 * The first line is the same reassurance every Add screen already promised in its alert:
 * nothing typed has been lost. The second line is the REAL reason, because "check your
 * connection" is wrong advice when the server said "invalid kind" or a photo was too big.
 */
export function SaveError({
  error,
  title = "We could not save this. Your words are still here.",
}: { error: unknown; title?: string }) {
  if (!error) return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Icon name="alert" size={18} color={colors.onErrorContainer} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" color={colors.onErrorContainer}>
          {title}
        </AppText>
        <AppText variant="small" color={colors.onErrorContainer}>
          {describe(error)}
        </AppText>
      </View>
    </View>
  );
}

/** Plain language first; the server's own words when it gave any. */
export function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 401) return "Your session has ended. Please sign in again and try once more.";
    if (error.status === 413) return "That photo or video is too large to send. Try a smaller one.";
    if (error.status === 415) return "That kind of file cannot be added here.";
    return error.message;
  }
  const m = error instanceof Error ? error.message : String(error);
  return m || "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radii.inner,
    padding: spacing.sm + 2,
  },
});
