import React, { useState } from "react";
import { Image, Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { FormActions } from "../components/FormActions";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge } from "../components/Icon";
import { colors, fonts, INPUT_MIN, radii, spacing, type } from "../theme";
import { OBJECT_KIND_LABEL, type ObjectKind } from "../types";
import { useStore } from "../store";

/**
 * Add an object to the archive.
 *
 * THE TWO QUESTIONS THAT MATTER are "whose was it?" and "who has it now?", and they are asked
 * before the story. A photograph of a ring with no custody is a nice picture; the same
 * photograph with "Grandma's, Sarah has it, in the blue box on the wardrobe" is the thing
 * that stops a family arguing after a funeral.
 *
 * Everything else -- the story, the year, the extra photographs -- is optional, because an
 * object recorded thinly today is infinitely better than one recorded perfectly never.
 */
export function AddObjectScreen({
  onDone, onCancel,
}: { onDone: () => void; onCancel: () => void }) {
  const { people, actions, currentUser } = useStore();

  const [photos, setPhotos] = useState<{ uri: string; mimeType: string }[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ObjectKind>("keepsake");
  const [originPersonId, setOriginPersonId] = useState<string | undefined>();
  // Defaults to whoever is adding it: the overwhelmingly common case is that you are
  // photographing a thing you are holding.
  const [heldByPersonId, setHeldByPersonId] = useState<string | undefined>(currentUser.personId);
  const [whereKept, setWhereKept] = useState("");
  const [originText, setOriginText] = useState("");
  const [originYear, setOriginYear] = useState("");
  const [story, setStory] = useState("");
  const [saving, setSaving] = useState(false);
  /** The last failure, shown inline above the save button until the next attempt. */
  const [error, setError] = useState<unknown>(null);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotos((prev) => [...prev, { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }]);
    }
  };

  const save = async () => {
    if (saving || !name.trim()) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      // Uploads first: a row pointing at bytes that never arrived is a permanently broken
      // image in an archive whose whole promise is permanence. Rejects on failure, so a
      // photo can never silently go missing.
      const ids: string[] = [];
      for (const photo of photos) {
        const up = await actions.uploadMedia(photo.uri, photo.mimeType);
        ids.push(up.id);
      }

      await actions.addObject({
        name: name.trim(),
        kind,
        story: story.trim() || undefined,
        originText: originText.trim() || undefined,
        originYear: originYear.trim() || undefined,
        originPersonId,
        heldByPersonId,
        whereKept: whereKept.trim() || undefined,
        imageMediaId: ids[0],
        photoMediaIds: ids,
      });
      onDone();
    } catch (err) {
      // Inline, not an alert: an alert is a no-op on web and gone on a phone; this stays
      // beside the button until the next try, and the form keeps every word.
      setSaving(false);
      setError(err);
    }
  };

  return (
    <Screen
      footer={(keyboardVisible) => (
        <FormActions
          keyboardVisible={keyboardVisible}
          error={error}
          title={saving ? "Keeping it safe..." : "Add object to the archive"}
          compactTitle={saving ? "Saving..." : "Save object"}
          disabled={saving || !name.trim()}
          onPress={save}
          secondaryTitle="Never mind"
          secondaryIcon="close"
          onSecondary={onCancel}
        />
      )}
    >
      <View style={styles.head}>
        <IconBadge name="box" size={48} tone="mint" />
        <AppText variant="title">Add an object</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant}>
          The ring, the clock, the toolbox. Record who has it and nobody has to ask again.
        </AppText>
      </View>

      <Card tone="low" style={styles.photosCard}>
        <View style={styles.cardHead}>
          <Icon name="camera" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="label">Photographs</AppText>
            <AppText variant="small" color={colors.onSurfaceVariant}>
              The whole thing, and any inscription or maker's mark.
            </AppText>
          </View>
        </View>

        <View style={styles.photoStrip}>
          {photos.map((photo, i) => (
            <View key={photo.uri + i} style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable
                onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={"Remove photograph " + (i + 1)}
                hitSlop={8}
                style={styles.photoRemove}
              >
                <Icon name="close" size={12} color={colors.onErrorContainer} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={addPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add a photograph"
            style={styles.photoAdd}
          >
            <Icon name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <Field
        label="What is it?"
        value={name}
        onChangeText={setName}
        placeholder="Nana Ruth's engagement ring"
        editable={!saving}
        multiline
      />

      <View style={styles.section}>
        <AppText variant="label">What kind of thing?</AppText>
        <View style={styles.choices}>
          {(Object.keys(OBJECT_KIND_LABEL) as ObjectKind[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k }}
              style={[styles.choice, kind === k && styles.choiceOn]}
            >
              <AppText variant="labelSm" color={kind === k ? colors.onPrimary : colors.onSurface}>
                {OBJECT_KIND_LABEL[k]}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/*
        WHO HAS IT NOW -- asked in a tinted card, because it is the reason this screen exists
        and it should not read as one field among nine.
      */}
      {people.length > 0 ? (
        <Card tone="mint" style={styles.custodyCard}>
          <AppText variant="label">Who has it now?</AppText>
          <AppText variant="small" color={colors.onPrimaryFixedVariant}>
            This starts the record of who has carried it.
          </AppText>
          <View style={styles.choices}>
            {people.map((p) => {
              const on = heldByPersonId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setHeldByPersonId(on ? undefined : p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.name}
                  style={[styles.choice, on && styles.choiceOn]}
                >
                  <Avatar person={p} size={22} />
                  <AppText variant="labelSm" color={on ? colors.onPrimary : colors.onSurface}>
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Field
        label="Where is it kept?"
        optional
        value={whereKept}
        onChangeText={setWhereKept}
        // The detail that actually finds a thing in a house.
        placeholder="The blue box on top of the wardrobe"
        editable={!saving}
      />

      {people.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label">Whose was it originally?  (optional)</AppText>
          <View style={styles.choices}>
            {people.map((p) => {
              const on = originPersonId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setOriginPersonId(on ? undefined : p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.name}
                  style={[styles.choice, on && styles.choiceOn]}
                >
                  <Avatar person={p} size={22} />
                  <AppText variant="labelSm" color={on ? colors.onPrimary : colors.onSurface}>
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Field
            label="Where did it come from?"
            optional
            value={originText}
            onChangeText={setOriginText}
            placeholder="Brought over from Cork"
            editable={!saving}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Year"
            optional
            value={originYear}
            onChangeText={setOriginYear}
            // Fuzzy on purpose, like every other date here.
            placeholder="c. 1911"
            editable={!saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label">Why does it matter?  (optional)</AppText>
        <TextInput
          value={story}
          onChangeText={setStory}
          multiline
          placeholder="She wore it every day for fifty-one years and took it off exactly twice."
          placeholderTextColor={colors.outline}
          accessibilityLabel="Why does it matter?"
          editable={!saving}
          style={styles.story}
        />
      </View>
    </Screen>
  );
}

function Field({
  label, optional, ...rest
}: { label: string; optional?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}{optional ? "  (optional)" : ""}</AppText>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.outline}
        accessibilityLabel={label}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, marginBottom: spacing.md },
  photosCard: { gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  photoStrip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoWrap: { position: "relative" },
  photo: { width: 84, height: 84, borderRadius: radii.inner },
  photoRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.errorContainer,
    alignItems: "center", justifyContent: "center",
  },
  photoAdd: {
    width: 84, height: 84, borderRadius: radii.inner,
    borderWidth: 1.5, borderColor: colors.primaryFixed,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  /** The custody question gets a tinted card: it is why the screen exists. */
  custodyCard: { gap: spacing.sm, marginTop: spacing.md },
  section: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
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
  /** Serif: the story is the family's words. */
  story: {
    minHeight: 130,
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    fontSize: type.bodyLg.fontSize,
    fontFamily: fonts.serif,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
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
