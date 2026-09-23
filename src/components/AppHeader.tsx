import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./Text";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LogoBadge } from "./Logo";
import { colors, radii, spacing, TOUCH_MIN } from "../theme";
import { useStore } from "../store";

/**
 * The persistent top bar: the mark, the family circle being spoken into, a
 * one-tap microphone, and the profile dot.
 *
 * WHAT CHANGED:
 *   - The green heart emoji is gone; the real logo mark sits in a soft squircle.
 *   - The wordmark is gone from the header entirely. Repeating "Close Knit" on
 *     every screen of an app the user has already opened is 2010s chrome; the
 *     mark identifies the app, and the space is given to the thing that actually
 *     changes -- WHICH CIRCLE you are speaking into.
 *   - The section name is now the primary line (serif, 19px) with the circle
 *     beneath it as a real tappable switcher with a chevron, instead of three
 *     competing 12px caps labels separated by bullets.
 *   - No bottom border. The header sits on the same canvas as the content and is
 *     separated by space, which is what stops the app looking like a stack of
 *     boxed panels.
 *
 * The circle name is always on screen on purpose: it is the ambient version of the
 * privacy promise -- you can see which circle you are speaking into before you say
 * anything, rather than trusting a setting you cannot see.
 *
 * The microphone is in the header of every screen because voice is the lowest
 * possible barrier for the least tech-confident members. It must never be more
 * than one tap away.
 */
export function AppHeader({
  section, onPressMic, onPressProfile, onPressCircle,
  micAccessibilityLabel = "Open family chat to send a voice note",
  showUnread = false,
}: {
  section: string;
  onPressMic?: () => void;
  onPressProfile?: () => void;
  onPressCircle?: () => void;
  /** Must describe what the handler actually does; navigation is not recording. */
  micAccessibilityLabel?: string;
  /** Only render a dot from a real unread count/state. */
  showUnread?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { family, currentUser, personById } = useStore();
  const me = personById(currentUser.personId);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <LogoBadge size={40} />

          <View style={styles.titles}>
            <AppText variant="subtitle" numberOfLines={1} style={styles.section}>
              {section}
            </AppText>

            {onPressCircle ? (
              <Pressable
                onPress={onPressCircle}
                accessibilityRole="button"
                accessibilityLabel={"Family circle: " + family.name + ". Switch circle."}
                hitSlop={10}
                style={({ pressed }) => [styles.circleRow, pressed && styles.circlePressed]}
              >
                <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={1}>
                  {family.name}
                </AppText>
                <Icon name="chevronDown" size={14} color={colors.onSurfaceFaint} />
              </Pressable>
            ) : (
              // One circle: identity and privacy context, not a fake switch.
              <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={2}>
                {family.name}
              </AppText>
            )}
          </View>
        </View>

        <View style={styles.right}>
          {onPressMic ? (
            <Pressable
              onPress={onPressMic}
              accessibilityRole="button"
              accessibilityLabel={micAccessibilityLabel}
              hitSlop={6}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Icon name="voice" size={21} color={colors.primary} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={onPressProfile}
            accessibilityRole="button"
            accessibilityLabel={"Your profile and settings, " + currentUser.name}
            hitSlop={6}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <Avatar person={me} size={36} />
            {/* A dot is system status, not decoration: render only from real state. */}
            {showUnread ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 4,
    paddingBottom: spacing.sm + 2,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, minHeight: 52,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, flexShrink: 1 },
  titles: { flexShrink: 1, gap: 1 },
  section: { flexShrink: 1 },
  circleRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    alignSelf: "flex-start", minHeight: TOUCH_MIN,
    paddingRight: spacing.xs, borderRadius: radii.sm,
  },
  circlePressed: { opacity: 0.6 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 0 },
  iconButton: {
    width: TOUCH_MIN - 4, height: TOUCH_MIN - 4, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  avatarButton: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2,
    alignItems: "center", justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  dot: {
    position: "absolute", right: 4, bottom: 4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.secondary,
    borderWidth: 2.5, borderColor: colors.surface,
  },
});
