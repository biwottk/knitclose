import React from "react";
import { Text as RNText, type TextProps, StyleSheet } from "react-native";
import { colors, fonts, type as scale } from "../theme";

/**
 * Typography primitives, mapped one-to-one onto the type scale in theme.ts.
 *
 *   role        token          family    used for
 *   ---------------------------------------------------------------------------
 *   hero        display-lg     Fraunces  the one line you read first
 *   display     display-md     Fraunces  peak moments, celebration screens
 *   title       headline-lg    Fraunces  screen + major card titles
 *   subtitle    headline-md    Fraunces  section titles inside a card
 *   quote       story-callout  Fraunces  the family's own words, italic
 *   story       body-lg        Jakarta   narrative-first reading (18px)
 *   body        body-md        Jakarta   baseline UI copy (17px)
 *   small       body-sm        Jakarta   supporting detail
 *   label       label-lg       Jakarta   buttons, list rows
 *   labelSm     label-md       Jakarta   chips, compact metadata
 *   micro       label-sm       Jakarta   ALL-CAPS eyebrows (12px floor)
 *   mono        label-md       Jakarta   tabular figures: timers, durations
 *
 * Every role carries the letter-spacing from its scale token, so tracking is a
 * property of the ROLE and cannot drift when a style is reused. That consistency
 * is most of the difference between tuned and untuned typography.
 *
 * Accessibility: allowFontScaling stays ON everywhere so the OS font-size setting
 * is respected. The multiplier is only capped -- generously -- on the largest
 * roles, so a huge system setting cannot push content out of reach.
 */

type Role =
  | "hero" | "display" | "title" | "subtitle" | "quote" | "story"
  | "body" | "small" | "label" | "labelSm" | "micro" | "mono";

interface Props extends TextProps {
  variant?: Role;
  color?: string;
  center?: boolean;
  bold?: boolean;
}

/** Roles set in Fraunces, so `bold` picks the serif rather than the sans. */
const SERIF_ROLES = new Set<Role>(["hero", "display", "title", "subtitle", "quote"]);

/** The biggest roles get a tighter cap so headlines cannot dominate a screen. */
const BIG_ROLES = new Set<Role>(["hero", "display", "title"]);

export function AppText({
  variant = "body", color, center, bold, style, ...rest
}: Props) {
  return (
    <RNText
      maxFontSizeMultiplier={BIG_ROLES.has(variant) ? 1.7 : 2.2}
      style={[
        styles[variant],
        bold ? (SERIF_ROLES.has(variant) ? boldStyles.serif : boldStyles.sans) : null,
        color ? { color } : null,
        center ? { textAlign: "center" } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const boldStyles = StyleSheet.create({
  serif: { fontFamily: fonts.serifBold },
  sans: { fontFamily: fonts.sansBold },
});

const styles = StyleSheet.create({
  // --- Editorial (Fraunces) ------------------------------------------------
  hero: {
    ...scale.displayLg,
    fontFamily: fonts.serifBold,
    color: colors.primary,
  },
  display: {
    ...scale.displayMd,
    fontFamily: fonts.serifBold,
    color: colors.primary,
  },
  title: {
    ...scale.headlineLg,
    fontFamily: fonts.serifBold,
    color: colors.onSurface,
  },
  subtitle: {
    ...scale.headlineMd,
    fontFamily: fonts.serifMedium,
    color: colors.onSurface,
  },
  /**
   * A pull-quote. Italic serif with 30px leading is what makes an elder's
   * transcribed voice read as testimony rather than as app copy.
   */
  quote: {
    ...scale.storyCallout,
    fontFamily: fonts.serifItalic,
    color: colors.onSurface,
  },

  // --- Functional (Plus Jakarta Sans) --------------------------------------
  /** Long-form reading. 18px, because grandparents read this screen too. */
  story: {
    ...scale.bodyLg,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  body: {
    ...scale.bodyMd,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  small: {
    ...scale.bodySm,
    fontFamily: fonts.sans,
    color: colors.onSurfaceVariant,
  },
  label: {
    ...scale.labelLg,
    fontFamily: fonts.sansSemi,
    color: colors.onSurface,
  },
  labelSm: {
    ...scale.labelMd,
    fontFamily: fonts.sansMedium,
    color: colors.onSurface,
  },
  /**
   * ALL-CAPS eyebrow. Positive tracking is what makes it read as a label rather
   * than as shouted body copy.
   */
  micro: {
    ...scale.labelSm,
    fontFamily: fonts.sansSemi,
    color: colors.onSurfaceFaint,
    textTransform: "uppercase",
  },
  /**
   * Tabular figures for anything that counts up or down -- playback timers,
   * durations, "3 of 5". Proportional digits visibly jitter as they change.
   */
  mono: {
    ...scale.labelMd,
    fontFamily: fonts.sansMedium,
    color: colors.onSurfaceVariant,
    fontVariant: ["tabular-nums"],
  },
});
