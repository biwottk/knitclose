import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { Avatar } from "../components/Avatar";
import { DeedCard } from "../components/DeedCard";
import { Icon, IconBadge } from "../components/Icon";
import { SectionHeader } from "../components/SectionHeader";
import { colors, spacing } from "../theme";
import { shortName } from "../names";
import { useStore } from "../store";

/**
 * Screen 8 -- Profile, the "digital monument".
 * A person's legacy page. Designed with respect, elegance and restraint.
 */
export function ProfileScreen({
  personId, onOpenDeed,
}: { personId: string; onOpenDeed: (id: string) => void }) {
  const { personById, deedsForPerson } = useStore();
  const person = personById(personId);

  if (!person) {
    return <Screen><AppText variant="body">We couldn't find that person.</AppText></Screen>;
  }

  const deeds = deedsForPerson(person.id);
  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <Screen insetTop={false}>
      <View style={styles.monument}>
        <Avatar person={person} size={132} ring={!person.isLiving} />
        <AppText variant="hero" center style={{ marginTop: spacing.md }}>{person.name}</AppText>

        {person.birthDate ? (
          // Dates sit in the tabular role: two of them side by side visibly
          // misalign in proportional figures.
          <View style={styles.datesRow}>
            <Icon name="calendar" size={14} color={colors.onSurfaceFaint} />
            <AppText variant="mono" center>
              {fmt(person.birthDate)}
              {person.deathDate ? "  —  " + fmt(person.deathDate) : ""}
            </AppText>
          </View>
        ) : null}

        {!person.isLiving || person.memorialised ? (
          // A pill rather than a floating caps line, so the most delicate label on
          // the screen is held deliberately instead of reading as leftover metadata.
          <Chip label="In loving memory" tone="terracotta" icon="leaf" caps />
        ) : null}
      </View>

      {person.bio ? (
        <Card tone="container" elevation="flat">
          <AppText variant="quote">{person.bio}</AppText>
        </Card>
      ) : null}

      <View style={styles.rule} />

      {/* The shared section rhythm, so this heading matches every other screen. */}
      <SectionHeader
        icon="archive"
        title={
          deeds.length === 0
            ? "No stories yet"
            : deeds.length === 1 ? "1 great deed" : deeds.length + " great deeds"
        }
      />

      {deeds.length === 0 ? (
        <Card feature style={styles.empty}>
          <IconBadge name="quote" size={72} tone="mint" style={styles.emptyBadge} />
          <AppText variant="story" center style={{ marginTop: spacing.lg }}>
            Nobody has written anything about {shortName(person.name)} yet.
          </AppText>
          <AppText variant="body" center color={colors.onSurfaceVariant} style={{ marginTop: spacing.md }}>
            You could be the first. Even one memory means they won't be a name and two
            dates to whoever comes next.
          </AppText>
        </Card>
      ) : (
        deeds.map((d) => (
          <DeedCard key={d.id} deed={d} onPress={() => onOpenDeed(d.id)} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monument: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  datesRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  empty: { paddingVertical: spacing.xxl },
  emptyBadge: { alignSelf: "center" },
  /** A genuine section edge -- the only hairline left on the page. */
  rule: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.sm },
});
