import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Button } from "./Button";
import { Card } from "./Card";
import { IconBadge, type IconName } from "./Icon";
import { colors, spacing } from "../theme";

/**
 * The empty state.
 *
 * WHY THIS IS A REAL COMPONENT AND NOT AN AFTERTHOUGHT: every family starts empty, so
 * this is the FIRST thing most users ever see in each tab. It used to be papered over
 * with another family's seed data, which was both a privacy failure and a missed
 * chance -- the moment somebody has nothing is the moment they most need telling what
 * to do.
 *
 * The rules it follows:
 *
 *  - Name what belongs here, in the family's language, not the app's ("Nobody has
 *    written down a recipe yet", not "No records found").
 *  - Say why it is worth doing. A blank archive is not self-explanatory; the reason is
 *    the whole motivation.
 *  - Offer EXACTLY ONE next action. Two choices at zero content is a decision a new
 *    user cannot make, and it is how people bounce.
 *  - Never look like an error. Warm tone, no alert colour, no exclamation mark.
 */
export function EmptyState({
  icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary, compact,
}: {
  icon: IconName;
  title: string;
  /** One or two sentences: what goes here, and why it matters. */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /** A quieter alternative, e.g. "Invite the family" where that is a real second path. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Inside an existing card or a short section, rather than filling a tab. */
  compact?: boolean;
}) {
  const content = (
    <View style={[styles.inner, compact && styles.innerCompact]}>
      {/*
        A tinted badge rather than a large illustration: it reads as "this space is
        ready" instead of "something is missing", and it costs no asset pipeline.
      */}
      <IconBadge name={icon} size={compact ? 44 : 56} tone="mint" />

      <AppText variant={compact ? "subtitle" : "title"} center>{title}</AppText>

      <AppText
        variant="body"
        center
        color={colors.onSurfaceVariant}
        style={styles.body}
      >
        {body}
      </AppText>

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          icon="add"
          style={styles.action}
        />
      ) : null}

      {secondaryLabel && onSecondary ? (
        <Button title={secondaryLabel} kind="quiet" onPress={onSecondary} />
      ) : null}
    </View>
  );

  // Compact renders bare so it can sit inside a card that already has a surface.
  return compact ? content : <Card style={styles.card}>{content}</Card>;
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  inner: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  innerCompact: { paddingVertical: spacing.md, gap: spacing.sm + 2 },
  // Measured line length: centred prose past ~34em is markedly harder to read, and
  // this text is doing the work of teaching somebody what the app is for.
  body: { maxWidth: 320 },
  action: { alignSelf: "stretch", marginTop: spacing.xs },
});
