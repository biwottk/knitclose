import React from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, radii, spacing, TOUCH_MIN } from "../theme";
import { REACTIONS, REACTIONS_FOR_KIND, type Deed, type ReactionKind } from "../types";
import { useStore } from "../store";

/**
 * Appreciation, not a generic "Like".
 *
 * THE REACTIONS OFFERED DEPEND ON THE ENTRY'S KIND, and that is the most important thing
 * about this component. Every entry used to offer the same four, led by "Applaud" -- so
 * the app invited a family to applaud a bereavement, a miscarriage, a cancer scare. That
 * is the sort of detail that makes somebody close an app and not come back.
 *
 * A hard time offers Hold, Strength and Love. "Hold" is "holding you in mind": the
 * response a family actually wants to give bad news, and the one no social product ships
 * because it cannot be dressed up as engagement. See docs/memory_kinds.md.
 *
 * Visually: vector glyphs that FILL and take terracotta when yours is active, so "have I
 * reacted?" is readable at a glance rather than needing a border-colour comparison. The
 * pop is a spring on scale plus a brief lift -- appreciation should feel like it landed.
 */

/**
 * Semantic icon per reaction kind.
 *
 * EXPORTED because DeedDetailScreen draws the same reactions in its summary row. It used
 * to keep a private duplicate "because both are three lines long" -- and the duplicate
 * promptly went stale the moment three new kinds were added, which is exactly the failure
 * that argument invites.
 */
export const REACTION_ICONS: Record<ReactionKind, IconName> = {
  applaud: "applaud",
  inspire: "inspire",
  cherish: "cherish",
  love: "love",
  // A steadying hand rather than a heart: this is solidarity, not affection.
  hold: "handshake",
  strength: "flame",
  laugh: "reaction",
};

const ICONS = REACTION_ICONS;

const LABELS = new Map(REACTIONS.map((r) => [r.kind, r.label]));

export function ReactionBar({ deed, compact }: { deed: Deed; compact?: boolean }) {
  const { actions, currentUser } = useStore();

  // Fall back to the memory set rather than the deed set: if a kind is somehow unknown,
  // offering Cherish/Love/Laugh is gentle, whereas defaulting to Applaud is not.
  const offered = REACTIONS_FOR_KIND[deed.kind] ?? REACTIONS_FOR_KIND.memory;

  return (
    <View style={styles.row}>
      {offered.map((kind) => (
        <ReactionButton
          key={kind}
          kind={kind}
          label={LABELS.get(kind) ?? kind}
          count={(deed.reactions[kind] ?? []).length}
          mine={(deed.reactions[kind] ?? []).includes(currentUser.personId)}
          compact={compact}
          onPress={() => void actions.toggleReaction(deed.id, kind)}
        />
      ))}
    </View>
  );
}

function ReactionButton({
  kind, label, count, mine, compact, onPress,
}: {
  kind: ReactionKind; label: string; count: number; mine: boolean;
  compact?: boolean; onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const lift = React.useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 16 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }),
      ]),
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -5, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(lift, { toValue: 0, useNativeDriver: true, speed: 14 }),
      ]),
    ]).start();
    onPress();
  };

  const fg = mine ? colors.secondary : colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: mine }}
      accessibilityLabel={label + ". " + count + " so far." + (mine ? " You reacted." : "")}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        mine && styles.buttonMine,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }, { translateY: lift }] }}>
        <Icon name={ICONS[kind]} size={compact ? 16 : 18} color={fg} filled={mine} />
      </Animated.View>

      {!compact ? (
        <AppText variant="labelSm" color={fg} numberOfLines={1}>
          {label}
        </AppText>
      ) : null}

      {count > 0 ? (
        <AppText variant="mono" color={fg} style={styles.count}>{count}</AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm - 2 },
  button: {
    minHeight: TOUCH_MIN - 8,
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
  buttonCompact: {
    minHeight: 34, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
  },
  /** Yours: a terracotta wash rather than a border swap. */
  buttonMine: { backgroundColor: colors.secondaryFixed },
  count: { marginLeft: -1 },
});
