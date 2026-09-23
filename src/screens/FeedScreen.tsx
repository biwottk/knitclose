import React from "react";
import { Pressable, StyleSheet, View, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/Text";
import { Card } from "../components/Card";
import { DeedCard } from "../components/DeedCard";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { Button } from "../components/Button";
import { Icon, IconBadge } from "../components/Icon";
import { colors, motion, radii, shadow, spacing } from "../theme";
import { useStore } from "../store";
import { STORY_PROMPTS } from "../config";

/**
 * Screen 4 -- Home "Family Feed".
 * Chronological. No ads, no "suggested content", no algorithm. Just the family.
 */
export function FeedScreen({
  onOpenDeed, onAddDeed,
}: { onOpenDeed: (id: string) => void; onAddDeed: () => void }) {
  const { family, deeds, people } = useStore();
  const insets = useSafeAreaInsets();

  const sorted = [...deeds].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // "On This Day": surface a milestone from the tree so the feed always has warmth.
  const today = new Date();
  const onThisDay = people.filter((p) => {
    if (!p.birthDate) return false;
    const d = new Date(p.birthDate);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });

  const prompt = STORY_PROMPTS[today.getDay() % STORY_PROMPTS.length];

  return (
    <View style={styles.root}>
      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        // This is a pushed screen with a native-stack header, so the header already owns
        // the status-bar inset. Adding it again left a conspicuous blank band above the
        // journal and made the destination feel detached from the button that opened it.
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <View style={styles.header}>
              <AppText variant="title">{family.name} Circle</AppText>
              <PrivacyBadge text={"Private to " + family.name} />
            </View>

            {onThisDay.length > 0 ? (
              // Tinted card, so the tone carries the amber wash and its matching
              // faint edge rather than a hand-set backgroundColor pair.
              <Card tone="warm">
                <View style={styles.calloutHead}>
                  <IconBadge name="cake" size={34} tone="amber" />
                  <AppText variant="micro" color={colors.onTertiaryFixedVariant}>ON THIS DAY</AppText>
                </View>
                {onThisDay.map((p) => (
                  <AppText key={p.id} variant="story" style={{ marginTop: spacing.sm }}>
                    {p.name} was born on this day
                    {p.birthDate ? " in " + new Date(p.birthDate).getFullYear() : ""}.
                  </AppText>
                ))}
              </Card>
            ) : null}

            <Card tone="mint">
              <View style={styles.calloutHead}>
                <IconBadge name="quote" size={34} tone="mint" />
                <AppText variant="micro" color={colors.onPrimaryFixedVariant}>THIS WEEK'S PROMPT</AppText>
              </View>
              <AppText variant="story" style={{ marginTop: spacing.sm }}>{prompt}</AppText>
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <DeedCard deed={item} onPress={() => onOpenDeed(item.id)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <Card feature style={styles.empty}>
            {/*
              The empty-state hero was a candle emoji, which rendered as a different
              illustration on every OS and could not take the brand's colour. A large
              tinted badge holds the same "one small light" idea in the app's own set.
            */}
            <IconBadge name="flame" size={92} tone="amber" style={styles.emptyBadge} />
            <AppText variant="title" center style={{ marginTop: spacing.lg }}>
              Every family has a first story.
            </AppText>
            <AppText variant="story" center color={colors.onSurfaceVariant} style={{ marginTop: spacing.md }}>
              It doesn't have to be dramatic. The small things are what get forgotten
              first — a habit, a saying, the way someone laughed.
            </AppText>
            <Button
              title="Add the first story"
              icon="add"
              onPress={onAddDeed}
              style={{ marginTop: spacing.xl }}
            />
          </Card>
        }
      />

      {/* Persistent FAB -- always visible, never a hidden gesture. */}
      <Pressable
        onPress={onAddDeed}
        accessibilityRole="button"
        accessibilityLabel="Add a great deed"
        style={({ pressed }) => [
          styles.fab,
          { bottom: spacing.lg + insets.bottom },
          // Scales on press instead of dimming: a 68px surface that fades looks broken.
          pressed && { transform: [{ scale: motion.pressScale }] },
        ]}
      >
        {/* A vector plus rather than a "+" set in the hero type role, which was
            optically off-centre because text carries its own line box. */}
        <Icon name="add" size={30} color={colors.onPrimary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  list: { padding: spacing.md, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  header: { gap: spacing.sm, marginTop: spacing.sm },
  /** Leading badge + eyebrow: the same header rhythm the callouts share elsewhere. */
  calloutHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  empty: { marginTop: spacing.xl, paddingVertical: spacing.xxl },
  emptyBadge: { alignSelf: "center" },
  fab: {
    position: "absolute", right: spacing.lg,
    width: 68, height: 68, borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    // A forest-tinted glow, so the one always-present action visibly floats.
    ...shadow.primaryGlow,
  },
});
