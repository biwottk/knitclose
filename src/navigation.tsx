import React from "react";
import { Platform } from "react-native";
import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TabBar } from "./components/TabBar";
import { colors, fonts, type } from "./theme";
import type { MemoryKind } from "./types";

import { HearthScreen } from "./screens/HearthScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { CareScreen } from "./screens/CareScreen";
import { ArchiveScreen } from "./screens/ArchiveScreen";
import { FamilyTreeScreen } from "./screens/FamilyTreeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { DeedDetailScreen } from "./screens/DeedDetailScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AddDeedScreen } from "./screens/AddDeedScreen";
import { AddMemoryScreen } from "./screens/AddMemoryScreen";
import { AddPersonScreen } from "./screens/AddPersonScreen";
import { AddRecipeScreen } from "./screens/AddRecipeScreen";
import { DeedSharedScreen } from "./screens/DeedSharedScreen";
import { FeedScreen } from "./screens/FeedScreen";

/**
 * Navigation shell.
 *
 * FIVE persistent tabs, matching the mockups: Hearth, Chat, Care, Archive,
 * Kinship. The ordering encodes the strategy from ideas.md -- daily utility
 * first (Hearth, Chat, Care), permanence second (Archive), structure third
 * (Kinship). A family app whose first tab is a family tree is a museum.
 *
 * Everything is reachable by a labelled button; nothing hides behind a gesture
 * (docs/great_deeds_ui_ux.md section 1). Five tabs is the practical ceiling for
 * a bar that must stay tappable and legible for a grandparent, which is why
 * Settings lives behind the header avatar rather than taking a sixth slot.
 */

export type RootStackParams = {
  Tabs: undefined;
  DeedDetail: { deedId: string };
  Profile: { personId: string };
  /** The 4-step wizard. Reached from the kind picker for great deeds only. */
  AddDeed: undefined;
  /**
   * "Add to the archive": pick a memory kind, then a form that fits it.
   *
   * `kind` skips the picker when the caller already knows -- e.g. "Remember them" on a
   * memorialised person's profile goes straight to the inMemory form.
   */
  AddMemory: { kind?: MemoryKind } | undefined;
  AddPerson: undefined;
  AddRecipe: undefined;
  DeedShared: { deedId: string };
  Settings: undefined;
  Feed: undefined;
};

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator();

const navTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.surface,
    card: colors.surfaceLowest,
    text: colors.onSurface,
    border: colors.border,
    notification: colors.secondary,
  },
  fonts: {
    regular: { fontFamily: fonts.sans, fontWeight: "400" },
    medium: { fontFamily: fonts.sansMedium, fontWeight: "600" },
    bold: { fontFamily: fonts.sansBold, fontWeight: "700" },
    heavy: { fontFamily: fonts.sansBold, fontWeight: "800" },
  },
};

/**
 * The tab bar itself lives in components/TabBar.tsx: it is a custom bar so the
 * active state can animate and the icons can change stroke weight, neither of
 * which the default implementation supports. It also owns its own safe-area
 * handling -- a fixed-height bar clipped the labels behind the home indicator on
 * notched iPhones, and a browser reports a zero inset, so that class of bug only
 * appears on real hardware.
 */
function TabsNavigator({
  onSignOut, onOpenSettings,
}: { onSignOut: () => void; onOpenSettings: () => void }) {
  return (
    <Tabs.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="Hearth"
        options={{ tabBarLabel: "Hearth" }}
      >
        {({ navigation }) => (
          <HearthScreen
            onOpenDeed={(deedId) => navigation.navigate("DeedDetail", { deedId })}
            // The kind picker, not the wizard: most of what a family wants to keep is
            // not a "great deed", and sending everything through the wizard is what made
            // the archive a highlight reel.
            onAddDeed={() => navigation.navigate("AddMemory")}
            onQuickShare={() => navigation.navigate("Chat")}
            onOpenChat={() => navigation.navigate("Chat")}
            onOpenCare={() => navigation.navigate("Care")}
            onOpenPerson={(personId) => navigation.navigate("Profile", { personId })}
            onOpenProfile={onOpenSettings}
          />
        )}
      </Tabs.Screen>

      <Tabs.Screen
        name="Chat"
        options={{ tabBarLabel: "Chat" }}
      >
        {() => <ChatScreen onOpenProfile={onOpenSettings} />}
      </Tabs.Screen>

      <Tabs.Screen
        name="Care"
        options={{ tabBarLabel: "Care" }}
      >
        {({ navigation }) => (
          <CareScreen
            onOpenProfile={onOpenSettings}
            // A care circle needs a person, so the empty state can hand off to the tree.
            onOpenKinship={() => navigation.navigate("Kinship")}
          />
        )}
      </Tabs.Screen>

      <Tabs.Screen
        name="Archive"
        options={{ tabBarLabel: "Archive" }}
      >
        {({ navigation }) => (
          <ArchiveScreen
            onOpenProfile={onOpenSettings}
            onAddRecipe={() => navigation.navigate("AddRecipe")}
          />
        )}
      </Tabs.Screen>

      <Tabs.Screen
        name="Kinship"
        options={{ tabBarLabel: "Kinship" }}
      >
        {({ navigation }) => (
          <FamilyTreeScreen
            onOpenPerson={(personId) => navigation.navigate("Profile", { personId })}
            onAddPerson={() => navigation.navigate("AddPerson")}
          />
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

export function RootNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          /**
           * The pushed-screen header sits on the SAME canvas as its content, with
           * no shadow and no bottom hairline. A white header strip over a warm
           * canvas re-introduced exactly the boxed, panelled look the refresh
           * removes everywhere else.
           */
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          // Note: native-stack's headerTitleStyle only accepts font family/size/
          // weight and colour -- letterSpacing is not supported here, so the serif
          // title carries its default tracking rather than the scale's.
          headerTitleStyle: {
            fontFamily: fonts.serifBold,
            fontSize: type.headlineMd.fontSize,
            color: colors.onSurface,
          },
          headerTintColor: colors.primary,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="Tabs" options={{ headerShown: false }}>
          {({ navigation }) => (
            <TabsNavigator
              onSignOut={onSignOut}
              onOpenSettings={() => navigation.navigate("Settings")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="DeedDetail" options={{ title: "A Great Deed" }}>
          {({ route, navigation }) => (
            <DeedDetailScreen
              deedId={route.params.deedId}
              onOpenPerson={(personId) => navigation.push("Profile", { personId })}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Profile" options={{ title: "Their Story" }}>
          {({ route, navigation }) => (
            <ProfileScreen
              personId={route.params.personId}
              onOpenDeed={(deedId) => navigation.push("DeedDetail", { deedId })}
            />
          )}
        </Stack.Screen>

        {/* The full chronological archive. Reachable, but deliberately not a tab:
            it is a place you go looking, not the app's front door. */}
        <Stack.Screen name="Feed" options={{ title: "The Family Journal" }}>
          {({ navigation }) => (
            <FeedScreen
              onOpenDeed={(deedId) => navigation.push("DeedDetail", { deedId })}
              onAddDeed={() => navigation.navigate("AddMemory")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Settings" options={{ title: "Settings" }}>
          {({ navigation }) => (
            <SettingsScreen
              onOpenPerson={(personId) => navigation.push("Profile", { personId })}
              onSignOut={onSignOut}
            />
          )}
        </Stack.Screen>

        {/*
          The kind picker. This is now the default "add" destination everywhere, and the
          4-step wizard below is reached only by choosing "A great deed" from it.
        */}
        <Stack.Screen
          name="AddMemory"
          options={{
            title: "Add to the archive",
            presentation: Platform.OS === "ios" ? "modal" : "card",
          }}
        >
          {({ route, navigation }) => (
            <AddMemoryScreen
              initialKind={route.params?.kind}
              onDone={(deedId) => navigation.replace("DeedShared", { deedId })}
              onCancel={() => navigation.goBack()}
              // Great deeds keep the full wizard. replace(), so Back does not land the
              // user on the picker they have already answered.
              onOpenWizard={() => navigation.replace("AddDeed")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="AddDeed"
          options={{
            title: "Record a Great Deed",
            presentation: Platform.OS === "ios" ? "modal" : "card",
          }}
        >
          {({ navigation }) => (
            <AddDeedScreen
              // Replace the wizard so Back from the celebration cannot re-post.
              onDone={(deedId) => navigation.replace("DeedShared", { deedId })}
              onCancel={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="AddPerson"
          options={{
            title: "Add a family member",
            presentation: Platform.OS === "ios" ? "modal" : "card",
          }}
        >
          {({ navigation }) => (
            <AddPersonScreen
              // Straight to their profile: seeing the person you just added is the
              // confirmation, and it is where you would add their story next.
              onDone={(personId) => navigation.replace("Profile", { personId })}
              onCancel={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="AddRecipe"
          options={{
            title: "Add a recipe",
            presentation: Platform.OS === "ios" ? "modal" : "card",
          }}
        >
          {({ navigation }) => (
            <AddRecipeScreen
              onDone={() => navigation.goBack()}
              onCancel={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>

        {/* The peak moment. No header: nothing competes with the celebration. */}
        <Stack.Screen
          name="DeedShared"
          options={{
            headerShown: false,
            presentation: Platform.OS === "ios" ? "modal" : "card",
            gestureEnabled: false,
          }}
        >
          {({ route, navigation }) => (
            <DeedSharedScreen
              deedId={route.params.deedId}
              onDone={() => navigation.popTo("Tabs")}
              onViewDeed={(deedId) => {
                navigation.popTo("Tabs");
                navigation.navigate("DeedDetail", { deedId });
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
