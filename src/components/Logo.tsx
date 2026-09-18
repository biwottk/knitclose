import React from "react";
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";
import { colors, radii, shadow } from "../theme";

/**
 * The Close Knit mark.
 *
 * The brand is two interlocked knot-hearts in forest and terracotta -- the whole
 * product thesis in one glyph. Previously the app drew a green heart EMOJI in the
 * header and spelled the name out in text beside it, which meant the actual logo
 * appeared nowhere in the product.
 *
 * The assets here are extracted from design/screen.png by scripts/extract-logo.cjs,
 * which recovers a true alpha channel from the mockup's checkerboard backdrop and
 * emits tight crops:
 *
 *   assets/logo-mark.png      the knot alone, transparent
 *   assets/logo-lockup.png    knot + CLOSE KNIT wordmark, transparent
 *   assets/logo-wordmark.png  the wordmark alone, transparent
 *
 * Because the wordmark is part of the artwork, screens that show the lockup do not
 * also need to render the name as text -- doing both is why the old header felt
 * cluttered.
 */

/** Intrinsic aspect ratios of the exported assets, so nothing is ever squashed. */
const ASPECT = {
  mark: 512 / 433,
  lockup: 720 / 541,
  wordmark: 720 / 97,
};

export function Logo({
  variant = "mark", size = 32, style,
}: {
  variant?: "mark" | "lockup" | "wordmark";
  /** Height in points. Width follows the asset's own aspect ratio. */
  size?: number;
  style?: ImageStyle;
}) {
  const source =
    variant === "lockup"
      ? require("../../assets/logo-lockup.png")
      : variant === "wordmark"
        ? require("../../assets/logo-wordmark.png")
        : require("../../assets/logo-mark.png");

  return (
    <Image
      source={source}
      style={[{ height: size, width: size * ASPECT[variant] }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Close Knit"
    />
  );
}

/**
 * The mark inside a soft container -- the app-chrome treatment used in the header
 * and on list rows that represent the app itself. A squircle rather than a circle,
 * matching how a modern OS frames an app identity.
 */
export function LogoBadge({
  size = 38, tone = "paper", style,
}: {
  size?: number;
  tone?: "paper" | "mint" | "plain";
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor:
            tone === "mint" ? colors.primaryFixed
            : tone === "plain" ? "transparent"
            : colors.surfaceLowest,
        },
        tone !== "plain" && shadow.card,
        style,
      ]}
    >
      <Logo variant="mark" size={size * 0.62} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center", justifyContent: "center",
    borderRadius: radii.sm,
  },
});
