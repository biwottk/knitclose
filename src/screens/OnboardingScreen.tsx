import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { Logo } from "../components/Logo";
import { colors, fonts, INPUT_MIN, radii, spacing, type }  from "../theme";
import { useStore } from "../store";

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
type Step = "choose" | "create" | "join";

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { actions } = useStore();
  const [step, setStep] = useState<Step>("choose");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

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

      <Button
        title={busy ? "Setting up..." : creating ? "Create our circle" : "Join my family"}
        icon={creating ? "add" : "check"}
        disabled={value.trim().length === 0 || busy}
        onPress={async () => {
          setBusy(true);
          // The circle already exists at this point -- signing up created it -- so this
          // step only gives it the name the family will recognise. Persisting it here
          // rather than in local state is the difference between a name that survives
          // a reinstall and one that does not.
          if (creating) await actions.setFamilyName(value.trim());
          onDone();
        }}
      />
      <Button title="Go back" kind="quiet" icon="chevronLeft" onPress={() => setStep("choose")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: spacing.xxl },
  header: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
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
