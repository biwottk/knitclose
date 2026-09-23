import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { FormActions } from "../components/FormActions";
import { Card } from "../components/Card";
import { IconBadge } from "../components/Icon";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { Logo } from "../components/Logo";
import { colors, fonts, INPUT_MIN, radii, spacing, type }  from "../theme";
import { useStore } from "../store";
import { api } from "../api";
import { SaveError } from "../components/SaveError";

/**
 * Screen 2 -- First-run onboarding.
 *
 * This is the single most important flow in the product: the "Family Champion" either
 * succeeds here and brings their whole family, or we lose the entire group
 * (docs/great_deeds_strategy.md section 1).
 *
 * So: two enormous buttons and nothing else on the screen.
 *
 * WHAT CHANGED: the choice step now opens on the real lockup rather than going
 * straight into a headline, because this is the second screen anyone sees and the
 * brand mark previously appeared nowhere. The lockup already carries the wordmark,
 * so the name is not also set as text beneath it.
 */
type Step = "choose" | "create" | "join" | "confirm";

type InvitePreview = {
  familyName: string; inviterName: string; role: string; expiresAt: string;
};

function invitationToken(value: string): string {
  const trimmed = value.trim();
  const marker = "/invite/";
  const at = trimmed.indexOf(marker);
  return at >= 0 ? trimmed.slice(at + marker.length).split(/[?#]/)[0] : trimmed;
}

export function OnboardingScreen({
  onDone, initialInviteToken,
}: { onDone: () => void; initialInviteToken?: string }) {
  const { actions } = useStore();
  const [step, setStep] = useState<Step>(initialInviteToken ? "join" : "choose");
  const [value, setValue] = useState(initialInviteToken ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);

  React.useEffect(() => {
    if (!initialInviteToken) return;
    setBusy(true); setError(null);
    api.previewInvitation(initialInviteToken)
      .then((result) => { setPreview(result); setStep("confirm"); })
      .catch(setError)
      .finally(() => setBusy(false));
  }, [initialInviteToken]);

  if (step === "choose") {
    return (
      <Screen>
        <View style={styles.brand}>
          <Logo variant="lockup" size={96} />
        </View>

        <View style={styles.header}>
          <AppText variant="display" center>Let's find your family.</AppText>
          {/* Centred, because on this screen the promise is the subtitle. */}
          <View style={styles.centred}>
            <PrivacyBadge text="Private, invitation only" />
          </View>
        </View>

        {/* Icons on the two large choices: the visual difference between starting
            something and joining something should not rest on the copy alone. */}
        <Button
          large
          icon="add"
          title="Create a New Family Circle"
          subtitle="Start your family's story. You'll be the admin."
          onPress={() => { setStep("create"); setValue(""); }}
        />
        <Button
          large
          kind="outline"
          icon="people"
          title="I Have an Invitation"
          subtitle="Someone in your family already started one."
          onPress={() => { setStep("join"); setValue(""); }}
        />
      </Screen>
    );
  }

  if (step === "confirm" && preview) {
    return (
      <Screen
        footer={(keyboardVisible) => (
          <FormActions
            keyboardVisible={keyboardVisible}
            error={error}
            title={busy ? "Joining your family…" : "Join " + preview.familyName}
            compactTitle={busy ? "Joining…" : "Join family"}
            icon="people"
            disabled={busy}
            onPress={async () => {
              if (busy) return;
              setBusy(true); setError(null);
              try {
                await api.redeemInvitation(invitationToken(value));
                await onDone();
              } catch (err) {
                setError(err);
                setBusy(false);
              }
            }}
            secondaryTitle="This is not my family"
            secondaryIcon="chevronLeft"
            onSecondary={() => { setStep("join"); setPreview(null); setError(null); }}
          />
        )}
      >
        <View style={styles.header}>
          <IconBadge name="people" size={56} tone="mint" />
          <AppText variant="display">You were invited to {preview.familyName}</AppText>
          <AppText variant="story" color={colors.onSurfaceVariant}>
            {preview.inviterName} invited you. Confirm the family name before joining—this
            invitation changes which private circle you are opening.
          </AppText>
        </View>
        <Card tone="mint" style={styles.invitePreview}>
          <AppText variant="subtitle">{preview.familyName}</AppText>
          <AppText variant="body" color={colors.onPrimaryFixedVariant}>
            Invited by {preview.inviterName} · Access as {preview.role}
          </AppText>
          <PrivacyBadge text="Only members of this family circle can see what is inside" />
        </Card>
      </Screen>
    );
  }

  const creating = step === "create";

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display">
          {creating ? "What's your family's name?" : "Enter your invitation code"}
        </AppText>
        <AppText variant="body" color={colors.onSurfaceVariant}>
          {creating
            ? "Something everyone will recognise, like “The Garcia Family”."
            : "It's in the message or email that invited you."}
        </AppText>
      </View>

      <TextInput
        style={[styles.input, !creating && styles.code]}
        value={value}
        onChangeText={setValue}
        placeholder={creating ? "The Garcia Family" : "GARCIA-2026"}
        placeholderTextColor={colors.outline}
        autoCapitalize={creating ? "words" : "characters"}
        accessibilityLabel={creating ? "Family name" : "Invitation code"}
      />

      <SaveError
        error={error}
        title={creating ? "We could not create the circle." : "We could not verify that invitation."}
      />

      <Button
        title={busy ? "Setting up..." : creating ? "Create our circle" : "Join my family"}
        icon={creating ? "add" : "check"}
        disabled={value.trim().length === 0 || busy}
        onPress={async () => {
          if (busy) return;
          setBusy(true); setError(null);
          try {
            if (creating) {
              await actions.setFamilyName(value.trim());
              await onDone();
            } else {
              const token = invitationToken(value);
              const result = await api.previewInvitation(token);
              setPreview(result);
              setStep("confirm");
              setBusy(false);
            }
          } catch (err) {
            setError(err);
            setBusy(false);
          }
        }}
      />
      <Button title="Go back" kind="quiet" icon="chevronLeft" onPress={() => setStep("choose")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: spacing.xxl },
  header: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  invitePreview: { gap: spacing.sm },
  centred: { alignItems: "center" },
  input: {
    minHeight: INPUT_MIN + 6,
    // Filled and recessed instead of a 1.5px outlined box -- the same treatment
    // every other input in the app got in the refresh.
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    fontSize: type.bodyMd.fontSize,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  /** An invitation code is a string to be read back character by character. */
  code: { fontVariant: ["tabular-nums"], letterSpacing: type.labelSm.letterSpacing },
});
