import React, { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Logo } from "../components/Logo";
import { Icon } from "../components/Icon";
import { colors, fonts, INPUT_MIN, radii, spacing, type }  from "../theme";
import { APP_NAME, APP_TAGLINE, PRIVACY_PROMISE } from "../config";
import { api, ApiError } from "../api";

/**
 * Screen 1 -- Sign Up / Log In.
 * Earn trust in the first second: warm parchment background (never sterile white) and an
 * explicit, plain-language privacy promise the user can read BEFORE signing up.
 *
 * The brand moment is the real lockup from src/components/Logo. The lockup already
 * contains the wordmark, so the name is deliberately NOT also printed as text --
 * doing both is what made the old header feel doubled up.
 *
 * THIS IS NOW REAL AUTH. It calls the API, which hashes with scrypt and returns a
 * signed token; `onSignedIn` fires only after the server has accepted the
 * credentials. Sign-up creates the account, the family circle, and the person row in
 * one transaction, so a new user lands in a working circle rather than a broken one.
 */
export function SignInScreen({ onSignedIn }: { onSignedIn: (isNew: boolean) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPromise, setShowPromise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);

    // Validate before the round trip so the message is instant and specific.
    if (!email.trim() || !email.includes("@")) return setError("Please enter your email address.");
    if (!password) return setError("Please enter your password.");
    if (mode === "up" && !displayName.trim()) return setError("Please enter your name.");
    if (mode === "up" && password.length < 10) {
      // Length over character classes: easier for a grandparent, and stronger.
      return setError("Please choose a password of at least 10 characters.");
    }

    setBusy(true);
    try {
      if (mode === "in") {
        await api.login(email.trim(), password);
        onSignedIn(false);
      } else {
        await api.signup({
          email: email.trim(), password, displayName: displayName.trim(),
        });
        // A brand-new circle needs naming, so onboarding follows sign-up only.
        onSignedIn(true);
      }
    } catch (err) {
      setError(err instanceof ApiError
        ? err.message
        : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <Logo variant="lockup" size={104} />
        <AppText variant="body" center color={colors.onSurfaceVariant}>{APP_TAGLINE}</AppText>
      </View>

      <Card feature>
        <AppText variant="subtitle">
          {mode === "in" ? "Welcome back" : "Create your account"}
        </AppText>

        {mode === "up" ? (
          <Field
            label="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
            autoCapitalize="words"
            editable={!busy}
          />
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          editable={!busy}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          editable={!busy}
        />

        {/*
          The error sits directly above the button that produced it, in the error
          container tone. A wrong password is an ordinary event, not an alarm, so it
          is stated plainly and never in a modal that has to be dismissed.
        */}
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Icon name="alert" size={16} color={colors.onErrorContainer} />
            <AppText variant="small" color={colors.onErrorContainer} style={{ flexShrink: 1 }}>
              {error}
            </AppText>
          </View>
        ) : null}

        {busy ? (
          // Replacing the button rather than disabling it: on a slow connection a
          // greyed-out button reads as "broken", whereas a spinner reads as "working".
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="small" color={colors.onSurfaceVariant}>
              {mode === "in" ? "Signing you in..." : "Creating your circle..."}
            </AppText>
          </View>
        ) : (
          <Button
            title={mode === "in" ? "Sign In" : "Sign Up"}
            onPress={submit}
            style={{ marginTop: spacing.md }}
          />
        )}

        {/*
          A rule with the word set into it, rather than a bare centred "or" floating
          in vertical space -- the standard modern divider, and it makes the two
          groups of sign-in options read as alternatives.
        */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <AppText variant="micro">or</AppText>
          <View style={styles.dividerLine} />
        </View>

        {/*
          Apple and Google buttons carry NO icon. The Button component takes a
          semantic name from our own set, and a third party's mark is not ours to
          approximate with a lucide glyph; the old code passed an empty string and
          the letter "G", neither of which is an icon name at all.
        */}
        {/*
          These are UI only: no OAuth provider is configured yet. They say so when
          tapped rather than silently signing somebody in, because a button that
          appears to work and then drops you into another account's data would be a
          far worse bug than a missing feature.
        */}
        <Button
          title="Continue with Apple"
          kind="outline"
          onPress={() => setError("Apple sign-in is not connected yet. Please use your email and password.")}
        />
        <Button
          title="Continue with Google"
          kind="outline"
          onPress={() => setError("Google sign-in is not connected yet. Please use your email and password.")}
          style={{ marginTop: spacing.sm }}
        />

        <Button
          title={mode === "in" ? "New here? Create an account" : "I already have an account"}
          kind="quiet"
          onPress={() => { setMode(mode === "in" ? "up" : "in"); setError(null); }}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Trust link, deliberately on the very first screen. */}
      <Button
        title={"Why is " + APP_NAME + " private? Read our promise."}
        kind="quiet"
        icon="privacy"
        onPress={() => setShowPromise(true)}
      />

      <Modal visible={showPromise} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          {/* Sheet radius, because this is a modal surface and not a list card. */}
          <Card style={styles.modalCard} elevation="raised">
            <View style={styles.modalHead}>
              <Icon name="privacy" size={22} color={colors.primary} />
              <AppText variant="title">Our promise</AppText>
            </View>
            <AppText variant="story" style={{ marginTop: spacing.sm }}>
              {PRIVACY_PROMISE}
            </AppText>
            <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.md }}>
              There is no public profile, no search, and no way for anyone outside your family
              circle to find you here.
            </AppText>
            <Button
              title="Close"
              onPress={() => setShowPromise(false)}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({ label, ...rest }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.outline}
        autoCapitalize="none"
        accessibilityLabel={label}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.md, alignItems: "center" },
  error: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radii.inner,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  busy: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginTop: spacing.md, minHeight: INPUT_MIN,
  },
  input: {
    minHeight: INPUT_MIN,
    marginTop: spacing.xs,
    // Filled and recessed rather than outlined: the field reads as somewhere to
    // type because of its tone, not because of a 1.5px box around it.
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    fontSize: type.bodyMd.fontSize,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  divider: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm + 2,
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  modalBackdrop: {
    // The scrim keeps its warmth: espresso at 45%, never a cold neutral grey.
    flex: 1, backgroundColor: colors.scrim,
    justifyContent: "center", padding: spacing.md,
  },
  modalCard: { padding: spacing.lg, borderRadius: radii.sheet },
  modalHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
