import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaInsetsContext,
  type Metrics,
} from "react-native-safe-area-context";
import { Dimensions, Platform } from "react-native";
import { useFonts } from "expo-font";
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { StoreProvider, useStore } from "./src/store";
import { RootNavigator } from "./src/navigation";
import { SignInScreen } from "./src/screens/SignInScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { api } from "./src/api";
import { AppText } from "./src/components/Text";
import { Button } from "./src/components/Button";
import { colors } from "./src/theme";

/**
 * Close Knit (repo/domain: knitclose).
 *
 * Auth is REAL: credentials go to the API (scrypt + signed token), and the token is
 * persisted so relaunching does not force a grandparent to log in again.
 */
type Phase = "checking" | "signedOut" | "onboarding" | "inApp";

/**
 * Lives inside StoreProvider so signing in can re-hydrate the store, and so the
 * family name chosen during onboarding is saved through the API.
 */
function Root({
  phase, setPhase,
}: { phase: Phase; setPhase: (p: Phase) => void }) {
  const { refresh } = useStore();

  /**
   * A stored token is checked ONCE on launch.
   *
   * Without this the app would show the sign-in screen to somebody who is already
   * signed in -- the token is in storage, so they would be typing a password the app
   * did not need.
   */
  React.useEffect(() => {
    if (phase !== "checking") return;
    let cancelled = false;
    (async () => {
      const session = await api.me().catch(() => null);
      if (cancelled) return;
      // A session means straight into the app: onboarding is for new circles only.
      setPhase(session ? "inApp" : "signedOut");
    })();
    return () => { cancelled = true; };
  }, [phase, setPhase]);

  if (phase === "checking") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (phase === "signedOut") {
    return (
      <SignInScreen
        onSignedIn={async (isNew) => {
          // Load the family before rendering it, so no screen flashes empty state.
          await refresh();
          setPhase(isNew ? "onboarding" : "inApp");
        }}
      />
    );
  }

  if (phase === "onboarding") {
    return (
      <OnboardingScreen
        onDone={async () => {
          await refresh();
          setPhase("inApp");
        }}
      />
    );
  }

  return (
    <StoreGate>
      <RootNavigator
        onSignOut={async () => {
          // Drop the token, or the next launch silently resumes the same session.
          await api.logout();
          setPhase("signedOut");
        }}
      />
    </StoreGate>
  );
}

/**
 * Holds the app back until the family is loaded, and says so plainly if it cannot be.
 *
 * WHY THIS EXISTS: without it, screens render against an empty store for a moment and
 * every one of them shows its empty state -- "no stories yet", "nobody here". For a
 * product whose entire promise is that a family's history is safe, telling somebody
 * their archive is empty because a request is still in flight is the worst possible
 * lie to tell. A network failure and an empty archive must never look the same.
 */
function StoreGate({ children }: { children: React.ReactNode }) {
  const { status, errorMessage, refresh } = useStore();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", gap: 16 }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText variant="body" color={colors.onSurfaceVariant}>Gathering your family...</AppText>
      </View>
    );
  }

  if (status === "error" && errorMessage) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", padding: 24, gap: 12 }}>
        <AppText variant="title" center>We could not reach your family</AppText>
        <AppText variant="body" center color={colors.onSurfaceVariant}>
          Nothing has been lost. This is a connection problem, and your stories are safe.
        </AppText>
        <AppText variant="small" center color={colors.onSurfaceFaint}>{errorMessage}</AppText>
        <Button title="Try again" onPress={() => void refresh()} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * DEV-ONLY safe-area override for the web preview.
 *
 * A desktop browser reports zero safe-area insets, which makes status-bar
 * collisions and home-indicator clipping invisible in it -- that is precisely how
 * a clipped header once shipped. Appending `?insetTop=59&insetBottom=34` to the
 * web URL forces phone-like insets so those bugs are reproducible without
 * physical hardware.
 *
 * Returns undefined (library default) on native and when no params are present,
 * so this can never affect a real build.
 *
 * Note: `initialMetrics` alone is not enough on web -- the provider re-measures the
 * DOM and replaces it with zero insets -- so the value is also pushed through
 * SafeAreaInsetsContext below.
 */
function devForcedMetrics(): Metrics | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);
  const top = Number(params.get("insetTop") ?? NaN);
  const bottom = Number(params.get("insetBottom") ?? NaN);
  if (!Number.isFinite(top) && !Number.isFinite(bottom)) return undefined;

  const { width, height } = Dimensions.get("window");
  return {
    insets: {
      top: Number.isFinite(top) ? top : 0,
      bottom: Number.isFinite(bottom) ? bottom : 0,
      left: 0,
      right: 0,
    },
    frame: { x: 0, y: 0, width, height },
  };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("checking");

  /**
   * Kinship & Hearth typography: Fraunces for anything narrative, Plus Jakarta
   * Sans for functional chrome.
   *
   * The serif italic is loaded explicitly because transcribed voice notes and
   * provenance lines are set as italic pull-quotes throughout -- synthesising an
   * italic by slanting the regular weight looks noticeably wrong on a serif.
   *
   * Four sans weights rather than three: 500 carries compact metadata where 400
   * is too faint and 600 too assertive, and that middle step is doing a lot of
   * the work in making the chrome look considered.
   */
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const forced = devForcedMetrics();

  const content = (
    <>
      <StatusBar style="dark" />
      <StoreProvider>
        <Root phase={phase} setPhase={setPhase} />
      </StoreProvider>
    </>
  );

  return (
    <SafeAreaProvider initialMetrics={forced}>
      {forced ? (
        // Dev preview only: pin insets so useSafeAreaInsets() cannot be reset to 0.
        <SafeAreaInsetsContext.Provider value={forced.insets}>
          {content}
        </SafeAreaInsetsContext.Provider>
      ) : (
        content
      )}
    </SafeAreaProvider>
  );
}
