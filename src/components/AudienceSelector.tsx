import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { colors, radii, spacing, TOUCH_MIN } from "../theme";
import { AUDIENCE_LABEL, type Audience } from "../types";
import { useStore } from "../store";

/** One privacy control shared by every Journal contribution flow. */
export function AudienceSelector({
  value, recipientIds, onChange,
}: {
  value: Audience;
  recipientIds: string[];
  onChange: (audience: Audience, recipientIds: string[]) => void;
}) {
  const { currentUser, members, people, careCircles } = useStore();
  const memberPeople = members.map((m) => m.personId).filter((id): id is string => !!id);
  const selectable = people.filter((p) => memberPeople.includes(p.id) && p.id !== currentUser.personId);
  const activeCare = careCircles.find((c) => c.memberIds.includes(currentUser.personId)) ?? careCircles[0];
  const options: Audience[] = currentUser.role === "child"
    ? ["everyone", "branch"]
    : ["everyone", "adults", ...(activeCare ? ["care" as const] : []), "branch"];

  const select = (audience: Audience) => {
    if (audience === "care") onChange(audience, [...new Set([...(activeCare?.memberIds ?? []), currentUser.personId])]);
    else if (audience === "branch") onChange(audience, recipientIds.length ? recipientIds : [currentUser.personId]);
    else onChange(audience, []);
  };

  const scopedNames = recipientIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter((name): name is string => !!name);
  const preview = value === "everyone"
    ? `All ${members.length} family ${members.length === 1 ? "member" : "members"}`
    : value === "adults"
      ? "Adult accounts in this family circle"
      : scopedNames.length
        ? scopedNames.join(", ")
        : "Choose at least one relative";

  return (
    <View style={styles.wrap}>
      <AppText variant="label">Who can see this?</AppText>
      <View style={styles.options}>
        {options.map((audience) => {
          const selected = value === audience;
          return (
            <Pressable
              key={audience}
              onPress={() => select(audience)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={AUDIENCE_LABEL[audience]}
              style={[styles.option, selected && styles.optionOn]}
            >
              <Icon
                name={audience === "adults" ? "lock" : audience === "care" ? "care" : audience === "branch" ? "person" : "people"}
                size={15}
                color={selected ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <AppText variant="labelSm" color={selected ? colors.onPrimary : colors.onSurface}>
                {AUDIENCE_LABEL[audience]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {value === "branch" ? (
        <View style={styles.people}>
          {selectable.map((person) => {
            const selected = recipientIds.includes(person.id);
            return (
              <Pressable
                key={person.id}
                onPress={() => onChange("branch", selected
                  ? recipientIds.filter((id) => id !== person.id)
                  : [...recipientIds, person.id])}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[styles.person, selected && styles.personOn]}
              >
                <Icon name={selected ? "check" : "add"} size={14} color={selected ? colors.onPrimary : colors.primary} />
                <AppText variant="labelSm" color={selected ? colors.onPrimary : colors.onSurface}>{person.name}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.preview} accessibilityLiveRegion="polite">
        <Icon name="privacy" size={15} color={colors.primary} />
        <AppText variant="small" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
          Visible to: {preview}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.md },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { minHeight: TOUCH_MIN, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceContainer },
  optionOn: { backgroundColor: colors.primary },
  people: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  person: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm + 2, borderRadius: radii.pill, backgroundColor: colors.primaryFixed },
  personOn: { backgroundColor: colors.primary },
  preview: { minHeight: TOUCH_MIN, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.inner, backgroundColor: colors.surfaceLow },
});
