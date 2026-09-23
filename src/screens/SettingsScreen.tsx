import React from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { colors, motion, radii, shadow, spacing, TOUCH_MIN } from "../theme";
import { APP_NAME, PRIVACY_PROMISE } from "../config";
import { useStore } from "../store";
import { api } from "../api";
import { SaveError } from "../components/SaveError";

/**
 * Screen 9 -- Settings.
 * A simple, high-contrast list. "Invite New Member" is the most prominent thing here,
 * because the Family Champion must never have to hunt for it.
 */
export function SettingsScreen({
  onOpenPerson, onSignOut,
}: { onOpenPerson: (id: string) => void; onSignOut: () => void }) {
  const { family, currentUser, people, deeds } = useStore();
  const isAdmin = currentUser.role === "admin";
  const [inviteBusy, setInviteBusy] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<unknown>(null);

  const invite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      const invitation = await api.createInvitation("member");
      const link = `knitclose://invite/${invitation.token}`;
      await Share.share({
        title: `Join ${family.name} on ${APP_NAME}`,
        url: link,
        message:
          currentUser.name + " invited you to join " + family.name +
          " on " + APP_NAME + " — a private place for our family's stories.\n\n" +
          "Open this invitation: " + link + "\n\n" +
          "Or paste this one-time code in the app:\n" + invitation.token + "\n\n" +
          "It expires in " + invitation.expiresInDays + " days and works once.",
      });
    } catch (err) {
      setInviteError(err);
    } finally {
      setInviteBusy(false);
    }
  };

  const flaggedCount = deeds.filter((d) => d.flagged).length;

  return (
    <Screen>
      <AppText variant="title">Settings</AppText>

      <Card>
        <View style={styles.meRow}>
          <Avatar person={people.find((p) => p.id === currentUser.personId)} size={56} />
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">{currentUser.name}</AppText>
            <AppText variant="small">
              {isAdmin ? "Family admin" : "Family member"} {"·"} {family.name}
            </AppText>
          </View>
        </View>
      </Card>

      <SaveError
        error={inviteError}
        title="We could not create the invitation. Nothing was shared."
      />

      {/* The single most important control for the Family Champion. */}
      <Pressable
        onPress={() => void invite()}
        disabled={inviteBusy || !isAdmin}
        accessibilityRole="button"
        accessibilityLabel="Invite a new family member"
        style={({ pressed }) => [
          styles.invite,
          pressed && { transform: [{ scale: motion.pressScale }] },
        ]}
      >
        {/*
          * The label used to carry an envelope emoji padded with spaces inside the
          * string itself, so it could not inherit the label's colour and drifted out
          * of alignment as the OS font size grew. It is a real icon in its own
          * container beside the text now.
          */}
        <View style={styles.inviteRow}>
          <IconBadge name="send" size={46} tone="paper" square />
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle" color={colors.onPrimary}>
              {inviteBusy ? "Creating invitation…" : "Invite New Member"}
            </AppText>
            <AppText variant="small" color={colors.primaryFixed} style={{ marginTop: spacing.xxs }}>
              Send a private invitation link
            </AppText>
          </View>
          <Icon name="chevronRight" size={20} color={colors.primaryFixedDim} />
        </View>
      </Pressable>

      <Section title="My Account">
        <Row icon="person" label="Name and email" value="Preview" onPress={() => previewFeature()} />
        <Row icon="lock" label="Change password" value="Preview" onPress={() => previewFeature()} />
        <Row
          icon="hearth"
          label="My profile page"
          onPress={() => onOpenPerson(currentUser.personId)}
          last
        />
      </Section>

      {isAdmin ? (
        <Section title="Manage Family">
          <Row icon="people" label={"Family members (" + people.length + ")"} value="Preview" onPress={() => previewFeature()} />
          <Row
            icon="shield"
            label="Posts needing review"
            value={flaggedCount > 0 ? String(flaggedCount) : "None"}
            onPress={() =>
              Alert.alert(
                "Posts needing review",
                flaggedCount === 0
                  ? "Nothing needs your attention right now."
                  : flaggedCount + " post(s) have been quietly flagged for you to look at.",
              )
            }
          />
          <Row icon="edit" label="Family name" value="Preview" onPress={() => previewFeature()} last />
        </Section>
      ) : null}

      <Section title="Our Promise">
        <Row
          icon="privacy"
          label="Why this app is private"
          onPress={() => Alert.alert("Our promise", PRIVACY_PROMISE)}
        />
        <Row
          icon="download"
          label="Download all our stories"
          value="Preview"
          onPress={() =>
            Alert.alert(
              "Your data is always yours",
              "Heirloom export turns your family's stories into a printable book. " +
                "It's on the way — and you'll always be able to download everything you've added.",
            )
          }
        />
        <Row icon="info" label="Help & Support" value="Preview" onPress={() => previewFeature()} last />
      </Section>

      <Card tone="container" elevation="flat">
        <PrivacyBadge text={"You are in the " + family.name + " circle only"} tone="plain" />
        {/* Family names already read as "The Garcia Family", so never prefix another article. */}
      </Card>

      <Pressable
        onPress={() =>
          Alert.alert("Log out?", "You can always sign back in.", [
            { text: "Stay", style: "cancel" },
            { text: "Log out", style: "destructive", onPress: onSignOut },
          ])
        }
        accessibilityRole="button"
        accessibilityLabel="Log out"
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.75 }]}
      >
        <AppText variant="label" color={colors.error} center>Log Out</AppText>
      </Pressable>
    </Screen>
  );
}

function previewFeature() {
  Alert.alert("Preview", "This is a planned feature and is not available yet. Nothing will change when you close this message.");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="micro">{title}</AppText>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

/**
 * A settings row.
 *
 * WHAT CHANGED: every row is separated by a hairline that ran the full width, which
 * is the boxed-table look the refresh removed. The rule is now inset past the
 * leading badge so the list reads as grouped items, the last row carries none at
 * all, and the trailing chevron is a real glyph instead of the "›" character --
 * which is a typographic bracket, not an arrow, and rendered at a different size on
 * every platform.
 */
function Row({
  icon, label, value, onPress, last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  /** Drops the separating rule -- the card's own edge already ends the list. */
  last?: boolean;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label + (value ? ", " + value : "")}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceLow }]}
      >
        <IconBadge name={icon} size={36} tone="mint" />
        <AppText variant="body" style={{ flex: 1 }}>{label}</AppText>
        {value ? <AppText variant="small">{value}</AppText> : null}
        <Icon name="chevronRight" size={18} color={colors.onSurfaceFaint} />
      </Pressable>
      {!last ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  meRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  invite: {
    backgroundColor: colors.primary, borderRadius: radii.cardLg,
    padding: spacing.md + 2, minHeight: 88, justifyContent: "center",
    // A forest glow, matching the primary button: the one action that must be found.
    ...shadow.primaryGlow,
  },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: {
    minHeight: TOUCH_MIN + 8, flexDirection: "row", alignItems: "center",
    gap: spacing.sm + 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  /**
   * Inset rule: it starts past the leading badge rather than fencing the whole card
   * edge to edge, which is what made the old list read as a table.
   */
  divider: {
    height: 1, backgroundColor: colors.outlineVariant,
    marginLeft: spacing.md + 36 + spacing.sm + 4,
  },
  logout: {
    minHeight: TOUCH_MIN, justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLowest, marginTop: spacing.sm,
    ...shadow.card,
  },
});
