import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/Text";
import { Avatar } from "../components/Avatar";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { colors, motion, radii, shadow, spacing } from "../theme";
import { shortName } from "../names";
import { useStore } from "../store";
import type { Person } from "../types";

/**
 * Screen 7 -- Interactive Family Tree.
 *
 * V1 uses generation rows inside a two-axis scroll view: it is genuinely pan-able,
 * it never breaks, and it works with a screen reader. A gesture-driven pinch-zoom
 * canvas is Sprint 6 work; shipping something explorable now beats shipping nothing.
 */
export function FamilyTreeScreen({
  onOpenPerson, onAddPerson,
}: { onOpenPerson: (id: string) => void; onAddPerson: () => void }) {
  const { people, family, currentUser } = useStore();
  const insets = useSafeAreaInsets();

  /**
   * A tree of one is you, alone.
   *
   * Rendering the generation machinery for a single node produces a lone card under the
   * heading "Earliest generation", which is both bleak and misleading. This screen is
   * also the true starting point of the product -- deeds are *about* people and care is
   * *for* a person -- so the empty state is the most important one in the app.
   */
  const isAlone = people.filter((p) => p.id !== currentUser.personId).length === 0;

  /** Assign each person a generation depth by walking up their parent edges. */
  const generations = useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const depthOf = (p: Person, seen = new Set<string>()): number => {
      if (seen.has(p.id) || p.parentIds.length === 0) return 0;
      seen.add(p.id);
      return 1 + Math.max(...p.parentIds.map((id) => {
        const parent = byId.get(id);
        return parent ? depthOf(parent, seen) : -1;
      }));
    };

    /**
     * A person who married into the family has no parent edges of their own, which
     * would naively place them in the earliest generation. Sit them beside their
     * spouse instead, so Carmen appears next to Miguel rather than above him.
     */
    const generationFor = (p: Person): number => {
      const own = depthOf(p);
      if (p.parentIds.length > 0) return own;
      const spouseDepths = p.spouseIds
        .map((id) => byId.get(id))
        .filter((s): s is Person => !!s && s.parentIds.length > 0)
        .map((s) => depthOf(s));
      return spouseDepths.length > 0 ? Math.max(...spouseDepths) : own;
    };

    const rows = new Map<number, Person[]>();
    for (const p of people) {
      const d = generationFor(p);
      rows.set(d, [...(rows.get(d) ?? []), p]);
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]);
  }, [people]);

  const GEN_LABELS = ["Earliest generation", "Their children", "Grandchildren", "Great-grandchildren"];

  return (
    <View style={styles.root}>
      {/* Tab screens have no navigation header, so clear the status bar ourselves. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="title">{family.name}</AppText>
        <PrivacyBadge text="Private to your family" />
        <AppText variant="small">Scroll to explore. Tap anyone to read their story.</AppText>
      </View>

      {isAlone ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="kinship"
            title="Just you, so far"
            body={
              "Add the people you want to remember -- living or gone. Everything else in " +
              "the app hangs off this: a story is about someone, and a care circle looks " +
              "after someone. Start with the oldest person you can name."
            }
            actionLabel="Add a family member"
            onAction={onAddPerson}
          />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.vertical}>
        {isAlone ? null : generations.map(([depth, members], i) => (
          <View key={depth} style={styles.generation}>
            <View style={styles.genLabel}>
              <Icon name="kinship" size={14} color={colors.onSurfaceFaint} strokeWidth={2.2} />
              <AppText variant="micro">
                {GEN_LABELS[depth] ?? "Generation " + (depth + 1)}
              </AppText>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}>
              {members.map((p) => (
                <PersonNode key={p.id} person={p} onPress={() => onOpenPerson(p.id)} />
              ))}
            </ScrollView>

            {i < generations.length - 1 ? <Connector /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The link between two generations.
 *
 * WHAT CHANGED: this was a flat 2px grey bar nudged into place with a hardcoded
 * marginLeft, which read as a stray border rather than as a relationship. It is now
 * a rounded mint stem with a node dot at its end -- the same visual language as the
 * rest of the graph -- and it is centred under the row instead of guessed at.
 */
function Connector() {
  return (
    <View style={styles.connectorWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.stem} />
      <View style={styles.stemDot} />
    </View>
  );
}

function PersonNode({ person, onPress }: { person: Person; onPress: () => void }) {
  const { personById } = useStore();
  const spouse = person.spouseIds.map((id) => personById(id)).find(Boolean);
  const year = (d?: string) => (d ? String(new Date(d).getFullYear()) : "");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        person.name +
        (person.isLiving ? "" : ", in loving memory") +
        (person.birthDate ? ", born " + year(person.birthDate) : "")
      }
      style={({ pressed }) => [
        styles.node,
        // Scales rather than dimming: a 132px card that fades looks like a glitch.
        pressed && { transform: [{ scale: motion.pressScale }] },
      ]}
    >
      <Avatar person={person} size={64} ring={!person.isLiving} />
      <AppText variant="label" center numberOfLines={2} style={{ marginTop: spacing.sm }}>
        {person.name}
      </AppText>
      {person.memorialised ? (
        <AppText variant="small" center>In loving memory</AppText>
      ) : (
        // Tabular figures so a column of life spans lines up digit for digit.
        <AppText variant="mono" center>
          {year(person.birthDate)}
          {person.deathDate ? " – " + year(person.deathDate) : person.birthDate ? " –" : ""}
        </AppText>
      )}
      {spouse ? (
        // The marriage link was an interlocking-rings dingbat, which is missing from
        // most Android system fonts and rendered as a hollow box there. A filled
        // terracotta heart says the same thing in the app's own icon set.
        <View style={styles.spouseRow}>
          <Icon name="heart" size={12} color={colors.secondary} filled />
          <AppText variant="small" color={colors.secondary} numberOfLines={1}>
            {shortName(spouse.name)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  vertical: { paddingBottom: spacing.xxl },
  emptyWrap: { paddingHorizontal: spacing.md },
  generation: { paddingHorizontal: spacing.md, gap: spacing.sm },
  genLabel: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  row: { gap: spacing.md, paddingVertical: spacing.sm, paddingRight: spacing.md },
  /**
   * A card, not a box: depth and a 20px radius instead of a hairline and a 32px
   * sheet radius, which made every relative look like a dialog.
   */
  node: {
    width: 132, alignItems: "center", padding: spacing.md,
    backgroundColor: colors.surfaceLowest, borderRadius: radii.card,
    ...shadow.card,
  },
  spouseRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    marginTop: spacing.xxs, maxWidth: "100%",
  },
  connectorWrap: { alignItems: "center", paddingVertical: spacing.xs },
  stem: { width: 3, height: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.primaryFixedDim },
  stemDot: {
    width: spacing.sm, height: spacing.sm, borderRadius: radii.pill,
    backgroundColor: colors.primaryFixedDim, marginTop: -1,
  },
});
