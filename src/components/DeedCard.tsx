import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Card } from "./Card";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { PrivacyBadge } from "./PrivacyBadge";
import { ReactionBar } from "./ReactionBar";
import { Avatar } from "./Avatar";
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
export function DeedCard({
  deed, onPress, variant = "journal",
}: {
  deed: Deed;
  onPress: () => void;
  /** Hearth previews; Journal preserves the richer archival metadata. */
  variant?: "hearth" | "journal";
}) {
  const hearth = variant === "hearth";
  const { personById, commentsForDeed } = useStore();
  const about = deed.personIds.map((id) => personById(id)?.name).filter(Boolean).join(", ");
  const photo = deed.media.find((m) => m.kind === "photo");
  const commentCount = commentsForDeed(deed.id).length;
  const hasAudio = deed.media.some((m) => m.kind === "audio");
  const meta = memoryKind(deed.kind);
  const author = personById(deed.authorId);
  const posted = new Date(deed.createdAt).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Card padded={false} feature>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={"Open story: " + deed.title}
        style={({ pressed }) => (pressed ? { opacity: 0.94 } : null)}
      >
        {/*
          Social-feed orientation: who shared it and when comes before the content.
          The archive used to begin with an anonymous photograph, which is beautiful in
          reading mode but oddly context-free in a home feed.
        */}
        <View style={styles.authorHeader}>
          {author ? (
            <Avatar person={author} size={38} />
          ) : (
            <View style={styles.authorFallback}>
              <Icon name="person" size={18} color={colors.primary} />
            </View>
          )}
          <View style={styles.authorCopy}>
            <AppText variant="labelSm" numberOfLines={1}>{deed.authorName}</AppText>
            <AppText variant="small" color={colors.onSurfaceFaint} numberOfLines={1}>
              {posted} · {meta.label}
            </AppText>
          </View>
          {!hearth ? <Icon name="chevronRight" size={17} color={colors.onSurfaceFaint} /> : null}
        </View>

        {photo ? (
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: photo.uri }}
              style={[styles.hero, hearth && styles.heroHearth]}
              accessibilityLabel={deed.title}
            />
            {/* Metadata rides on the image, which is how a modern editorial card
                gives the photograph the full width it deserves. */}
            <View style={styles.heroTags}>
              <View style={styles.heroPill}>
                <Icon name="clock" size={13} color={colors.inverseOnSurface} />
                <AppText
                  variant="micro"
                  color={colors.inverseOnSurface}
                  numberOfLines={2}
                  style={styles.heroPillText}
                >
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
            {!hearth && deed.kind !== "memory" ? (
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

          {deed.whereText ? (
            <View style={styles.aboutRow}>
              <Icon name="location" size={14} color={colors.onSurfaceFaint} />
              <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={1}>
                {deed.whereText}
              </AppText>
            </View>
          ) : null}

          {!hearth && about ? (
            <View style={styles.aboutRow}>
              <Icon name="people" size={14} color={colors.onSurfaceFaint} />
              <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={1}>
                {about}
              </AppText>
            </View>
          ) : null}

          <AppText variant="quote" numberOfLines={hearth ? 2 : 3} color={colors.onSurfaceVariant}>
            {deed.story}
          </AppText>

          {!hearth && deed.tags.length > 0 ? (
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
        {/* Named reactions are intentional on the home feed. The archive-specific icons
            are not universally guessable, and the user should not need to open the story
            just to learn that a button means Cherish, Hold or Applaud. */}
        <ReactionBar deed={deed} />

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
  authorHeader: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2,
  },
  authorCopy: { flex: 1, minWidth: 0, gap: 1 },
  authorFallback: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primaryFixed,
  },
  heroWrap: { position: "relative" },
  hero: { width: "100%", height: 240, backgroundColor: colors.surfaceContainer },
  /** Stable editorial crop on a phone; avoids fixed-height panoramic stretching on tablets. */
  heroHearth: { height: undefined, aspectRatio: 16 / 10 },
  heroTags: {
    position: "absolute", left: spacing.md - 2, right: spacing.md - 2, bottom: spacing.md - 2,
    flexDirection: "row", gap: spacing.sm - 2, flexWrap: "wrap",
  },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 1,
    maxWidth: "100%",
    // Translucent espresso reads on any photograph, light or dark.
    backgroundColor: "rgba(28, 25, 23, 0.62)",
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  heroPillText: { flexShrink: 1 },
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
    minHeight: 48,
  },
});
