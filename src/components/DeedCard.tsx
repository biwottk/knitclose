import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Card } from "./Card";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { PrivacyBadge } from "./PrivacyBadge";
import { ReactionBar } from "./ReactionBar";
import { colors, radii, spacing } from "../theme";
import { memoryKind, tagLabel } from "../types";
import type { Deed } from "../types";
import { useStore } from "../store";

/**
 * Visual-first feed card. The family's photo is the hero; our chrome stays quiet.
 *
 * WHAT CHANGED: the photo now bleeds to the card's rounded corners with a soft
 * scrim and the date sitting ON the image, rather than being a flat rectangle with
 * a caption block bolted underneath. Tags are tinted pills instead of hard-edged
 * mint boxes, and the footer's comment affordance carries a real icon.
 */
export function DeedCard({ deed, onPress }: { deed: Deed; onPress: () => void }) {
  const { personById, commentsForDeed } = useStore();
  const about = deed.personIds.map((id) => personById(id)?.name).filter(Boolean).join(", ");
  const photo = deed.media.find((m) => m.kind === "photo");
  const commentCount = commentsForDeed(deed.id).length;
  const hasAudio = deed.media.some((m) => m.kind === "audio");
  const meta = memoryKind(deed.kind);

  return (
    <Card padded={false} feature>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={"Open story: " + deed.title}
        style={({ pressed }) => (pressed ? { opacity: 0.94 } : null)}
      >
        {photo ? (
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.hero}
              accessibilityLabel={deed.title}
            />
            {/* Metadata rides on the image, which is how a modern editorial card
                gives the photograph the full width it deserves. */}
            <View style={styles.heroTags}>
              <View style={styles.heroPill}>
                <Icon name="clock" size={13} color={colors.inverseOnSurface} />
                <AppText variant="micro" color={colors.inverseOnSurface}>
                  {deed.whenText}
                </AppText>
              </View>
              {hasAudio ? (
                <View style={styles.heroPill}>
                  <Icon name="voice" size={13} color={colors.inverseOnSurface} />
                  <AppText variant="micro" color={colors.inverseOnSurface}>
                    Voice
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.body}>
          {/*
            The KIND, stated before the title.
            
            A reader needs to know the register before they read the words: arriving at
            "The autumn Dad was in hospital" expecting a celebration is jarring, and it is
            the difference between an archive that feels considerate and one that does not.
            "A memory" is omitted -- it is the default and the commonest, so labelling it
            would be noise on most cards.
          */}
          <View style={styles.metaRow}>
            {deed.kind !== "memory" ? (
              <View style={styles.kindPill}>
                <Icon name={meta.icon as never} size={12} color={colors.onPrimaryFixedVariant} />
                <AppText variant="micro" color={colors.onPrimaryFixedVariant}>
                  {meta.label}
                </AppText>
              </View>
            ) : null}
            {!photo ? (
              <AppText variant="micro" color={colors.secondary}>{deed.whenText}</AppText>
            ) : null}
          </View>

          <AppText variant="title">{deed.title}</AppText>

          {about ? (
            <View style={styles.aboutRow}>
              <Icon name="people" size={14} color={colors.onSurfaceFaint} />
              <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={1}>
                {about}
              </AppText>
            </View>
          ) : null}

          <AppText variant="quote" numberOfLines={3} color={colors.onSurfaceVariant}>
            {deed.story}
          </AppText>

          {deed.tags.length > 0 ? (
            <View style={styles.tags}>
              {deed.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <AppText variant="micro" color={colors.onPrimaryFixedVariant}>
                    {tagLabel(t)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.footer}>
        <ReactionBar deed={deed} compact />

        <View style={styles.footerMeta}>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={
              "Read and add to the story. " + commentCount + " notes so far."
            }
            hitSlop={8}
            style={({ pressed }) => [styles.commentRow, pressed && { opacity: 0.6 }]}
          >
            <Icon name="chat" size={15} color={colors.onSurfaceFaint} />
            <AppText variant="labelSm" color={colors.onSurfaceVariant}>
              {commentCount === 0
                ? "Add to the story"
                : commentCount + (commentCount === 1 ? " note" : " notes")}
            </AppText>
          </Pressable>

          {/* Privacy reassurance on EVERY post, not just in settings. */}
          <PrivacyBadge tone="plain" audience={deed.audience} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroWrap: { position: "relative" },
  hero: { width: "100%", height: 240, backgroundColor: colors.surfaceContainer },
  heroTags: {
    position: "absolute", left: spacing.md - 2, bottom: spacing.md - 2,
    flexDirection: "row", gap: spacing.sm - 2, flexWrap: "wrap",
  },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 1,
    // Translucent espresso reads on any photograph, light or dark.
    backgroundColor: "rgba(28, 25, 23, 0.62)",
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  body: { padding: spacing.md + 2, gap: spacing.sm - 2 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  kindPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primaryFixed,
    borderRadius: radii.pill,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm - 2, marginTop: spacing.xs },
  tag: {
    backgroundColor: colors.primaryFixed, borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 4, paddingVertical: 5,
  },
  footer: {
    paddingHorizontal: spacing.md + 2, paddingBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  footerMeta: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, flexWrap: "wrap",
  },
  commentRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    minHeight: 30,
  },
});
