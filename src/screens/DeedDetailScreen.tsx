import React, { useState } from "react";
import { Alert, Image, StyleSheet, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { ReactionBar, REACTION_ICONS } from "../components/ReactionBar";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { SaveError } from "../components/SaveError";
import { colors, fonts, INPUT_MIN, radii, spacing, type }  from "../theme";
import { MEMORY_KINDS, REACTIONS, REACTIONS_FOR_KIND, memoryKind, tagLabel } from "../types";
import { useStore } from "../store";

/**
 * Screen 6 -- Deed detail. This is READING mode: the chrome recedes so the story
 * and the photographs carry the screen.
 */

// Reaction glyphs come from ReactionBar, which owns them. This file used to keep its own
// copy on the grounds that both were short; the copy then went stale as soon as new
// reaction kinds existed.

export function DeedDetailScreen({
  deedId, onOpenPerson,
}: { deedId: string; onOpenPerson: (id: string) => void }) {
  const { deeds, personById, commentsForDeed, actions } = useStore();
  const [draft, setDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<unknown>(null);

  const deed = deeds.find((d) => d.id === deedId);
  if (!deed) {
    return (
      <Screen><AppText variant="body">This story is no longer available.</AppText></Screen>
    );
  }

  const comments = commentsForDeed(deed.id);
  const photo = deed.media.find((m) => m.kind === "photo");

  /**
   * Only the reactions this KIND offers, and only those anybody actually gave. Iterating
   * all seven would show "Applaud 0" under a funeral.
   */
  const offered = REACTIONS_FOR_KIND[deed.kind] ?? REACTIONS_FOR_KIND.memory;
  const reactors = REACTIONS
    .filter((r) => offered.includes(r.kind))
    .map((r) => ({ ...r, count: (deed.reactions[r.kind] ?? []).length }))
    .filter((r) => r.count > 0);

  const postComment = async () => {
    const body = draft.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true); setCommentError(null);
    try {
      await actions.addComment(deed.id, body);
      // Clear only after the server confirms. Until then the words remain editable.
      setDraft("");
    } catch (err) {
      setCommentError(err);
    } finally {
      setCommentBusy(false);
    }
  };

  const flag = () => {
    // Private, admin-only review. No public "report" button that creates family drama
    // (docs/great_deeds_strategy.md section 4).
    Alert.alert(
      "Ask an admin to take a look?",
      "We'll quietly let the family admin know. Nobody else will be told, and nothing " +
        "changes on this post for now.",
      [
        { text: "Never mind", style: "cancel" },
        {
          text: "Let the admin know",
          onPress: () => {
            void actions.flagDeed(deed.id);
            Alert.alert("Thank you", "The family admin has been notified privately.");
          },
        },
      ],
    );
  };

  return (
    <Screen insetTop={false}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.hero} accessibilityLabel={deed.title} />
      ) : null}

      {/* The date gets a small clock so the eyebrow reads as a when, not a category. */}
      <View style={styles.whenRow}>
        <Icon name="clock" size={14} color={colors.secondary} strokeWidth={2.2} />
        <AppText variant="micro" color={colors.secondary}>
          {deed.whenText}
        </AppText>
      </View>
      {deed.whereText ? (
        <View style={styles.whenRow}>
          <Icon name="location" size={14} color={colors.secondary} strokeWidth={2.2} />
          <AppText variant="micro" color={colors.secondary}>{deed.whereText}</AppText>
        </View>
      ) : null}
      <AppText variant="hero">{deed.title}</AppText>

      <View style={styles.people}>
        {deed.personIds.map((id) => {
          const p = personById(id);
          if (!p) return null;
          return (
            <Button
              key={id}
              title={p.name}
              kind="outline"
              icon="chevronRight"
              iconTrailing
              onPress={() => onOpenPerson(id)}
              accessibilityLabel={"Open " + p.name + "'s profile"}
            />
          );
        })}
      </View>

      {deed.tags.length > 0 ? (
        <View style={styles.tags}>
          {deed.tags.map((t) => (
            <Chip key={t} label={tagLabel(t)} tone="mint" />
          ))}
        </View>
      ) : null}

      {/* The story itself: serif, large, generous line height. */}
      <AppText variant="quote" style={styles.story}>{deed.story}</AppText>

      <View style={styles.byline}>
        <Icon name="edit" size={14} color={colors.onSurfaceFaint} />
        <AppText variant="small">
          Added by {deed.authorName} {"·"} {new Date(deed.createdAt).toLocaleDateString()}
        </AppText>
      </View>

      <PrivacyBadge audience={deed.audience} />

      <View style={styles.rule} />

      <ReactionBar deed={deed} />
      {reactors.length > 0 ? (
        // A tally row of glyph + count. It used to concatenate the emoji straight
        // out of the data model, which no longer holds one; a real icon row also
        // lets the counts use tabular figures so they line up as they change.
        <View style={styles.tally}>
          {reactors.map((r) => (
            <View key={r.kind} style={styles.tallyItem}>
              <Icon
                name={REACTION_ICONS[r.kind]}
                size={15}
                color={colors.onSurfaceFaint}
                filled={r.kind === "love"}
              />
              <AppText variant="mono">{r.count}</AppText>
              <AppText variant="small">{r.label}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.rule} />

      <AppText variant="subtitle">
        {comments.length === 0 ? "Add to the story" : "The family remembers"}
      </AppText>

      {comments.map((c) => (
        // Nested inside the reading column: a flat tone keeps a run of comments from
        // reading as a stack of floating cards.
        <Card key={c.id} tone="low" elevation="flat">
          <View style={styles.commentHead}>
            <Avatar person={{
              id: c.authorId, name: c.authorName, isLiving: true,
              parentIds: [], spouseIds: [],
            }} size={36} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{c.authorName}</AppText>
              <AppText variant="small">
                {new Date(c.createdAt).toLocaleDateString()}
              </AppText>
            </View>
          </View>
          <AppText variant="body" style={{ marginTop: spacing.sm }}>{c.body}</AppText>
        </Card>
      ))}

      <SaveError
        error={commentError}
        title="We could not add this yet. Your words are still here."
      />
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Add to the story…"
        placeholderTextColor={colors.outline}
        accessibilityLabel="Add to the story"
        editable={!commentBusy}
      />
      <Button
        title={commentBusy ? "Adding to the story…" : commentError ? "Try adding again" : "Share my memory"}
        icon="send"
        onPress={() => void postComment()}
        disabled={!draft.trim() || commentBusy}
      />
      {commentError ? (
        <Button
          title="Discard this draft"
          kind="quiet"
          icon="trash"
          onPress={() => { setDraft(""); setCommentError(null); }}
        />
      ) : null}

      <Button title="Ask an admin to review this" kind="quiet" icon="shield" onPress={flag} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** cardLg rather than the old 32: the photo is a hero, not a sheet. */
  hero: {
    width: "100%", height: 280, borderRadius: radii.cardLg,
    backgroundColor: colors.surfaceContainer,
  },
  whenRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  people: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  story: { marginTop: spacing.sm },
  byline: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  /** The one hairline kept on this screen: a section rule is a genuine edge. */
  rule: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.sm },
  tally: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tallyItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 1 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: {
    minHeight: INPUT_MIN + 26,
    // Filled and recessed instead of outlined -- the same change made to every
    // other input in the refresh, so a field never reads as a boxed table cell.
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: type.bodyMd.fontSize, fontFamily: fonts.sans, color: colors.onSurface,
  },
});
