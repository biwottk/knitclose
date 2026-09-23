import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { colors, shadow, spacing } from "../theme";
import { shortName } from "../names";
import { useStore } from "../store";

/**
 * THE PEAK MOMENT (Peak-End Rule).
 *
 * A user has just written down a piece of family history that might otherwise have
 * been lost. That is the emotional high point of the entire app, and previously it
 * was rewarded by a modal silently closing -- the exact "app falls off without
 * closure" anti-pattern.
 *
 * Two rules from the design skill shape this screen:
 *
 *  - "The Vanity Mirror": celebrate WHO the user is, not what they clicked.
 *    So the headline is about the person they preserved and the relatives who can
 *    now read it -- never "Post created successfully".
 *
 *  - Design the ending: affirm what happened, then give one gentle next step.
 *
 * WHAT CHANGED IN THE REFRESH: the seal was a bare tick character set in the hero
 * type role, which is a text glyph pretending to be artwork -- different shape and
 * weight on every platform, and unable to carry the celebration. It is now a
 * layered forest medallion with a celebrate glyph, the halo blooms behind it, and
 * the vertical rhythm is deliberately loose so the screen reads as an occasion
 * rather than as another dense card stack.
 */
export function DeedSharedScreen({
  deedId, onDone, onOpenJournal,
}: { deedId: string; onDone: () => void; onOpenJournal: () => void }) {
  const { deeds, people, personById, family } = useStore();
  const deed = deeds.find((d) => d.id === deedId);

  // Entrance: the card settles into place, the seal blooms behind it.
  const rise = useRef(new Animated.Value(0)).current;
  const bloom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.timing(rise, {
        toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.spring(bloom, {
        toValue: 1, useNativeDriver: true, speed: 6, bounciness: 12,
      }),
    ]).start();
  }, [rise, bloom]);

  if (!deed) {
    return (
      <Screen>
        <AppText variant="body">That story has been saved.</AppText>
        <Button title="Back to the feed" onPress={onDone} />
      </Screen>
    );
  }

  const subjects = deed.personIds
    .map((id) => personById(id)?.name)
    .filter((n): n is string => !!n);

  const firstNames = subjects.map(shortName);
  const who =
    firstNames.length === 0 ? "your family"
    : firstNames.length === 1 ? firstNames[0]
    : firstNames.slice(0, -1).join(", ") + " and " + firstNames[firstNames.length - 1];

  // How many relatives can now read this. Concrete and personal, not a vanity metric.
  const audience = Math.max(people.length - 1, 0);

  const storyWords = deed.story.trim() ? deed.story.trim().split(/\s+/).length : 0;

  return (
    <Screen
      footer={
        <>
          <Button title="Open the Family Journal" icon="journal" onPress={onOpenJournal} />
          <Button title="Back to the Hearth" kind="quiet" icon="hearth" onPress={onDone} />
        </>
      }
    >
      <Animated.View
        style={{
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        }}
      >
        <View style={styles.sealWrap}>
          {/* Soft glow behind the seal: blur-free depth via a tinted halo. */}
          <Animated.View
            style={[
              styles.halo,
              { transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                opacity: bloom.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
            ]}
          />
          {/* An inner ring gives the medallion two layers of depth, which is what
              stops a single flat circle reading as a loading spinner's backdrop. */}
          <Animated.View
            style={[
              styles.ring,
              { transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                opacity: bloom },
            ]}
          />
          <Animated.View
            style={[styles.seal, { transform: [{ scale: bloom }] }]}
            accessible
            accessibilityLabel="Saved to your family's archive"
          >
            {/* The celebrate glyph, not a tick: a tick confirms a form submitted,
                while this screen is marking that something was preserved. */}
            <Icon name="celebrate" size={40} color={colors.onPrimary} strokeWidth={1.75} />
          </Animated.View>
        </View>

        {/* The Vanity Mirror: this is about the person, and about the user as the
            one who made sure the story survived. */}
        <AppText variant="hero" center style={styles.headline}>
          {who}'s story is safe now.
        </AppText>

        <AppText variant="story" center color={colors.onSurfaceVariant} style={styles.subhead}>
          {storyWords >= 40
            ? "You wrote " + storyWords + " words that nobody else in this family had written down."
            : "You wrote something down that nobody else in this family had."}
        </AppText>

        {/*
          The receipt is the one raised, feature-radius surface on the screen, so the
          eye lands on the title of the thing that was just preserved.
        */}
        <Card tone="paper" elevation="raised" feature style={styles.receipt}>
          <View style={styles.receiptHead}>
            <Icon name="archive" size={15} color={colors.primary} strokeWidth={2.1} />
            <AppText variant="micro">SAVED IN THE FAMILY JOURNAL</AppText>
          </View>
          {/* display rather than title: on the peak screen the story's own name is
              the second thing you read, and it should carry weight. */}
          <AppText variant="display" style={{ marginTop: spacing.sm }}>{deed.title}</AppText>
          <AppText variant="small" style={{ marginTop: spacing.xs }}>
            {deed.whenText}
          </AppText>

          {subjects.length > 0 ? (
            <View style={styles.faces}>
              {deed.personIds.map((id) => {
                const p = personById(id);
                return p ? <Avatar key={id} person={p} size={40} ring={!p.isLiving} /> : null;
              })}
              <AppText variant="small" style={{ flex: 1, marginLeft: spacing.sm }}>
                Added to {subjects.length === 1 ? "their profile" : "their profiles"} forever
              </AppText>
            </View>
          ) : null}
        </Card>

        {audience > 0 ? (
          <View style={styles.audience}>
            <Icon name="people" size={17} color={colors.onSurfaceFaint} />
            <AppText variant="body" center style={styles.audienceText}>
              {audience} {audience === 1 ? "person" : "people"} in {family.name} can read
              this in the Family Journal. You can always find it from the Hearth.
            </AppText>
          </View>
        ) : null}

        {/* The gentle nudge to return -- closure, not a growth prompt. */}
        <Card tone="mint" style={styles.nextUp}>
          <View style={styles.receiptHead}>
            <Icon name="sparkle" size={15} color={colors.onPrimaryFixedVariant} />
            <AppText variant="micro" color={colors.onPrimaryFixedVariant}>WHILE YOU'RE HERE</AppText>
          </View>
          <AppText variant="story" style={{ marginTop: spacing.xs }}>
            Is there anyone who would remember this differently? Their version is worth
            keeping too.
          </AppText>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sealWrap: {
    alignItems: "center", justifyContent: "center",
    height: 160, marginTop: spacing.xl,
  },
  halo: {
    position: "absolute",
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.tertiaryFixed,
  },
  ring: {
    position: "absolute",
    width: 118, height: 118, borderRadius: 59,
    backgroundColor: colors.primaryFixed,
  },
  /** Forest, because this is the archive: permanent, not "today". */
  seal: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadow.overlay,
  },
  headline: { marginTop: spacing.xl },
  subhead: { marginTop: spacing.md },
  /** Deliberately generous: the whitespace is doing the celebrating. */
  receipt: { marginTop: spacing.xxl },
  receiptHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  faces: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginTop: spacing.lg,
  },
  audience: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.md,
  },
  audienceText: { flexShrink: 1 },
  nextUp: { marginTop: spacing.xxl },
});
