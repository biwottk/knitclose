import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { colors, fonts } from "../theme";
import { initials as toInitials } from "../names";
import type { Person } from "../types";

/**
 * Photo if we have one, warm monogram if we don't. Never a grey silhouette --
 * this app is about people, and a default avatar that looks like a police
 * database undoes a lot of careful warmth elsewhere.
 *
 * WHAT CHANGED: the fallback monogram now picks its tint deterministically from
 * the person's name, so a family of eight reads as eight distinct faces instead of
 * eight identical mint circles. The border is also gone by default -- a hairline
 * around every avatar was part of the boxed-in look -- and returns only as a
 * deliberate emphasis `ring`.
 */

/**
 * Monogram tints, all drawn from the brand palette so no avatar can introduce a
 * colour the design system does not own.
 */
const TINTS: { bg: string; fg: string }[] = [
  { bg: "#D6EADD", fg: "#2A5C44" },
  { bg: "#FCE3D6", fg: "#8E3A18" },
  { bg: "#FDEBC8", fg: "#6B4506" },
  { bg: "#E3E8DE", fg: "#3F4A3C" },
  { bg: "#F3DDE4", fg: "#7A3F52" },
  { bg: "#DCE6EC", fg: "#3A5261" },
];

/** Stable hash so a person keeps the same colour across every screen. */
function tintFor(name?: string) {
  if (!name) return TINTS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return TINTS[h % TINTS.length];
}

export function Avatar({
  person, size = 48, ring, ringColor,
}: {
  person?: Person;
  size?: number;
  /** Draws an emphasis ring, e.g. around the person a care circle is about. */
  ring?: boolean;
  ringColor?: string;
}) {
  const initials = person?.name ? toInitials(person.name) : "?";
  const tint = tintFor(person?.name);

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(ring
      ? { borderWidth: Math.max(2, size * 0.055), borderColor: ringColor ?? colors.secondary }
      : null),
  };

  if (person?.photoUri) {
    return (
      <Image
        source={{ uri: person.photoUri }}
        style={[styles.base, frame]}
        accessibilityLabel={"Photo of " + person.name}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, frame, { backgroundColor: tint.bg }]}
      accessible
      accessibilityLabel={person?.name}
    >
      <AppText
        color={tint.fg}
        style={{
          fontSize: Math.max(11, size * 0.38),
          fontFamily: fonts.sansBold,
          letterSpacing: -0.3,
        }}
      >
        {initials}
      </AppText>
    </View>
  );
}

/**
 * An overlapping row of faces -- "who is in this", "who has not signed yet".
 *
 * Negative margins between avatars need each one to carry a canvas-coloured ring
 * so the stack reads as separate people rather than as a smear. Doing that by hand
 * at each call site is exactly how the old `gap: -8` rows ended up inconsistent.
 */
export function AvatarStack({
  people, size = 32, max = 4, surface = colors.surfaceLowest,
}: {
  people: (Person | undefined)[];
  size?: number;
  max?: number;
  /** The colour behind the stack, used for each avatar's separating ring. */
  surface?: string;
}) {
  const shown = people.filter(Boolean).slice(0, max) as Person[];
  const extra = people.filter(Boolean).length - shown.length;
  const ringWidth = Math.max(2, size * 0.07);

  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.stackItem,
            {
              marginLeft: i === 0 ? 0 : -size * 0.3,
              borderRadius: size / 2,
              borderWidth: ringWidth,
              borderColor: surface,
              zIndex: shown.length - i,
            },
          ]}
        >
          <Avatar person={p} size={size} />
        </View>
      ))}

      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size, height: size, borderRadius: size / 2,
              marginLeft: -size * 0.3,
              borderWidth: ringWidth, borderColor: surface,
            },
          ]}
        >
          <AppText
            color={colors.onSurfaceVariant}
            style={{ fontSize: Math.max(10, size * 0.32), fontFamily: fonts.sansBold }}
          >
            +{extra}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceContainer },
  fallback: { alignItems: "center", justifyContent: "center" },
  stack: { flexDirection: "row", alignItems: "center" },
  stackItem: { overflow: "hidden" },
  more: {
    backgroundColor: colors.surfaceHigh,
    alignItems: "center", justifyContent: "center",
  },
});
