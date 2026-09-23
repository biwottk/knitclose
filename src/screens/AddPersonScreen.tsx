import React, { useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { FormActions } from "../components/FormActions";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge } from "../components/Icon";
import {
  colors, fonts, INPUT_MIN, motion, radii, spacing, type,
} from "../theme";
import { useStore } from "../store";

/**
 * Add someone to the family.
 *
 * WHY THIS SCREEN EXISTS: every "add" button in the app pointed at the Great Deed wizard.
 * For "add a family member" that was not merely the wrong screen -- the wizard's first
 * step asks *which family member* the deed is about, and refuses to advance until one is
 * chosen. So a new user with an empty tree tapped "Add a family member" and hit a hard
 * dead end on their first day. `POST /people` already existed; nothing was wired to it.
 *
 * DESIGN NOTES that matter for this audience:
 *
 *  - Dates are FREE TEXT, not a picker. "circa 1890" and "sometime in the war" are real
 *    answers about a great-grandparent, and a date picker cannot express either. The
 *    schema stores these as text precisely so the family's own phrasing survives.
 *  - "Is this person still with us?" is asked plainly and early, because it changes the
 *    tone of everything else on the screen and because getting it wrong is painful.
 *  - Relationships are optional. Somebody adding a name from a shoebox photo may not know
 *    how they connect yet, and refusing the entry until they do loses the name.
 */
export function AddPersonScreen({
  onDone, onCancel,
}: { onDone: (personId: string) => void; onCancel: () => void }) {
  const { people, actions } = useStore();

  const [name, setName] = useState("");
  const [isLiving, setIsLiving] = useState(true);
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [spouseIds, setSpouseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** The last failure, shown inline above the save button until the next attempt. */
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    if (saving || !name.trim()) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const id = await actions.addPerson({
        name: name.trim(),
        isLiving,
        birthDate: birthDate.trim() || undefined,
        // Only sent when they have gone: an empty string would read as "died: unknown".
        deathDate: !isLiving && deathDate.trim() ? deathDate.trim() : undefined,
        location: location.trim() || undefined,
        bio: bio.trim() || undefined,
        parentIds,
        spouseIds,
      });
      onDone(id);
    } catch (err) {
      // Inline, not an alert: an alert is a no-op on web and gone on a phone; this stays
      // beside the button until the next try, and the form keeps every word.
      setSaving(false);
      setError(err);
    }
  };

  const toggle = (
    list: string[], setList: (v: string[]) => void, id: string,
  ) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Screen
      footer={(keyboardVisible) => (
        <FormActions
          keyboardVisible={keyboardVisible}
          error={error}
          title={saving ? "Adding them..." : "Add to the family"}
          compactTitle={saving ? "Saving..." : "Save person"}
          disabled={saving || !name.trim()}
          onPress={save}
          secondaryTitle="Never mind"
          secondaryIcon="close"
          onSecondary={onCancel}
        />
      )}
    >
      <View style={styles.head}>
        <IconBadge name="kinship" size={48} tone="mint" />
        <AppText variant="title">Add a family member</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant}>
          Living or gone. Everything else in the app hangs off the family -- a story is
          about someone, and a care circle looks after someone.
        </AppText>
      </View>

      <Field
        label="What does the family call them?"
        value={name}
        onChangeText={setName}
        // The honorific IS part of the name here, and src/names.ts is built to keep it.
        placeholder="Nana Ruth, Uncle Dave, Grandpa Arthur"
        editable={!saving}
        autoCapitalize="words"
      />

      {/*
        Asked as two explicit choices rather than a switch labelled "living". A switch
        makes somebody parse which way is which about a person they have lost.
      */}
      <View style={styles.section}>
        <AppText variant="label">Is this person still with us?</AppText>
        <View style={styles.choices}>
          {[
            { on: true, label: "Yes", icon: "heart" as const },
            { on: false, label: "They have passed away", icon: "leaf" as const },
          ].map((c) => (
            <Pressable
              key={c.label}
              onPress={() => setIsLiving(c.on)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isLiving === c.on }}
              style={({ pressed }) => [
                styles.choice,
                isLiving === c.on && styles.choiceOn,
                pressed && { transform: [{ scale: motion.pressScale }] },
              ]}
            >
              <Icon
                name={c.icon}
                size={16}
                color={isLiving === c.on ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <AppText
                variant="labelSm"
                color={isLiving === c.on ? colors.onPrimary : colors.onSurface}
              >
                {c.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <Field
        label="Born"
        optional
        value={birthDate}
        onChangeText={setBirthDate}
        // Free text on purpose: a great-grandparent's birth year is often a guess.
        placeholder="1945-11-12, or circa 1890"
        editable={!saving}
      />

      {!isLiving ? (
        <Field
          label="Died"
          optional
          value={deathDate}
          onChangeText={setDeathDate}
          placeholder="2018-11-22, or during the war"
          editable={!saving}
        />
      ) : null}

      <Field
        label="Where are they?"
        optional
        value={location}
        onChangeText={setLocation}
        placeholder="Leeds, UK"
        editable={!saving}
      />

      <Field
        label="A line about them"
        optional
        value={bio}
        onChangeText={setBio}
        placeholder="Baked cardamom bread every Easter since 1968."
        editable={!saving}
        multiline
        tall
      />

      {/*
        Relationships are optional and last. Somebody typing a name off the back of a
        shoebox photograph may have no idea how they connect, and refusing the entry until
        they do is how the name gets lost instead.
      */}
      {people.length > 0 ? (
        <>
          <PersonPicker
            label="Their parents"
            people={people}
            selected={parentIds}
            onToggle={(id) => toggle(parentIds, setParentIds, id)}
          />
          <PersonPicker
            label="Their partner"
            people={people}
            selected={spouseIds}
            onToggle={(id) => toggle(spouseIds, setSpouseIds, id)}
          />
        </>
      ) : null}
    </Screen>
  );
}

function PersonPicker({
  label, people, selected, onToggle,
}: {
  label: string;
  people: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}  (optional)</AppText>
      <View style={styles.choices}>
        {people.map((p) => {
          const on = selected.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => onToggle(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
              style={[styles.choice, on && styles.choiceOn]}
            >
              <Avatar person={p as never} size={24} />
              <AppText variant="labelSm" color={on ? colors.onPrimary : colors.onSurface}>
                {p.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({
  label, optional, tall, ...rest
}: {
  label: string; optional?: boolean; tall?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}{optional ? "  (optional)" : ""}</AppText>
      <TextInput
        style={[styles.input, tall && styles.inputTall]}
        placeholderTextColor={colors.outline}
        accessibilityLabel={label}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, marginBottom: spacing.md },
  section: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: INPUT_MIN,
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: type.bodyMd.fontSize,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  inputTall: { minHeight: 104, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    minHeight: 40,
  },
  choiceOn: { backgroundColor: colors.primary },
});
