import React from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./Text";
import { Icon, type IconName } from "./Icon";
import { colors, fonts, radii, shadow, spacing } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

/**
 * The bottom navigation bar.
 *
 * WHY IT IS CUSTOM: React Navigation's default bar gave us an emoji glyph inside a
 * static amber pill on a bordered white strip -- flat, dated, and unable to animate
 * between states. Owning the bar buys three things that matter:
 *
 *   1. A REAL ACTIVE STATE. The selected tab's icon lifts and its pill grows in on
 *      a spring, so switching tabs is a transition rather than a repaint.
 *   2. THE ICON CHANGES WEIGHT, not just colour: active tabs draw at a heavier
 *      stroke and filled where the glyph supports it. That is legible to someone
 *      who cannot distinguish forest green from grey.
 *   3. A FLOATING BAR. It sits on a soft upward shadow instead of a 1px top border,
 *      matching every other surface in the refresh.
 *
 * FIVE persistent tabs: Hearth, Chat, Care, Archive, Kinship. The ordering encodes
 * the strategy -- daily utility first, permanence second, structure third. A family
 * app whose first tab is a family tree is a museum.
 *
 * Labels are always visible. Icon-only navigation is a comprehension tax on exactly
 * the family members this product cannot afford to lose.
 */

const ICONS: Record<string, IconName> = {
  Hearth: "hearth",
  Chat: "chat",
  Care: "care",
  Archive: "archive",
  Kinship: "kinship",
};

/** Bar content height, excluding the bottom safe-area inset added at runtime. */
export const TAB_BAR_HEIGHT = 64;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rail = Platform.OS === "android" && width >= 800;

  return (
    <View
      style={[
        styles.bar,
        rail ? styles.rail : { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        rail && { paddingTop: insets.top + spacing.md },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === "string" ? options.tabBarLabel : route.name;

        return (
          <TabItem
            key={route.key}
            label={label}
            icon={ICONS[route.name] ?? "hearth"}
            focused={focused}
            rail={rail}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress", target: route.key, canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label, icon, focused, rail, onPress,
}: { label: string; icon: IconName; focused: boolean; rail: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  /** Drives both the pill's growth and the icon's lift from one value. */
  const anim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    if (reduceMotion) { anim.setValue(focused ? 1 : 0); return; }
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [focused, anim, reduceMotion]);

  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const lift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.item, rail && styles.itemRail]}
    >
      <View style={styles.iconSlot}>
        {/* The mint pill grows behind the glyph rather than snapping on. */}
        <Animated.View
          style={[
            styles.pill,
            { opacity: anim, transform: [{ scale: pillScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ translateY: lift }] }}>
          <Icon
            name={icon}
            size={23}
            color={focused ? colors.primary : colors.onSurfaceFaint}
            strokeWidth={focused ? 2.4 : 1.9}
          />
        </Animated.View>
      </View>

      {/*
        Sentence case, not ALL-CAPS. Capitalised tab labels are a strong 2010s
        tell, and caps also cost legibility for the older readers this app is
        explicitly built for -- word shapes disappear when every letter is a
        rectangle. Weight and colour carry the active state instead.
      */}
      <AppText
        variant="labelSm"
        color={focused ? colors.primary : colors.onSurfaceFaint}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[styles.label, focused && styles.labelOn]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceLowest,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...shadow.floating,
    // The web build needs an explicit stacking context for the shadow to paint
    // above scrolled content.
    ...(Platform.OS === "web" ? { zIndex: 10 } : null),
  },
  rail: {
    width: 96, height: "100%", flexDirection: "column", alignItems: "center",
    paddingHorizontal: spacing.xs, gap: spacing.sm,
  },
  item: {
    flex: 1, alignItems: "center", gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  itemRail: { flex: 0, width: 88, minHeight: 68, justifyContent: "center" },
  iconSlot: {
    width: 52, height: 30,
    alignItems: "center", justifyContent: "center",
  },
  pill: {
    position: "absolute",
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: colors.primaryFixed,
    borderRadius: radii.pill,
  },
  label: { fontSize: 12, lineHeight: 15, letterSpacing: -0.1 },
  /** The active label steps up a weight rather than changing size. */
  labelOn: { fontFamily: fonts.sansBold },
});
