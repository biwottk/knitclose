import React, { useState } from "react";
import { Image, Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { FormActions } from "../components/FormActions";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge } from "../components/Icon";
import {
  colors, fonts, INPUT_MIN, radii, spacing, type,
} from "../theme";
import { useStore } from "../store";

/**
 * Add a recipe to the box.
 *
 * WHY THIS SCREEN EXISTS: the Archive tab's add button opened the Great Deed wizard, and
 * there was no POST /recipes route at all -- so the most-requested heirloom in the product
 * was literally impossible to create.
 *
 * THE HANDWRITTEN CARD IS THE POINT. It gets its own prominent slot, above the typed
 * ingredients, because it is the primary source: it is in her handwriting, and that is
 * the thing families actually grieve losing. The typed version is for searching and
 * cooking; the photograph is the heirloom.
 *
 * Ingredients and steps are one textarea each, split on newlines. A repeating "add
 * ingredient" row is more app-like and much worse for a grandparent, who will happily
 * type a list the way they would write it on paper.
 */
export function AddRecipeScreen({
  onDone, onCancel,
}: { onDone: () => void; onCancel: () => void }) {
  const { people, actions, currentUser } = useStore();

  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState<string | undefined>();
  const [attribution, setAttribution] = useState("");
  const [provenance, setProvenance] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [prepText, setPrepText] = useState("");
  const [yieldText, setYieldText] = useState("");
  const [dish, setDish] = useState<{ uri: string; mimeType: string } | null>(null);
  const [card, setCard] = useState<{ uri: string; mimeType: string } | null>(null);
  const [saving, setSaving] = useState(false);
  /** The last failure, shown inline above the save button until the next attempt. */
  const [error, setError] = useState<unknown>(null);

  const chosen = people.find((p) => p.id === personId);
  // Whose recipe it is: the chosen person's name, or whatever was typed.
  const effectiveAttribution = attribution.trim() || chosen?.name || "";

  const pick = async (set: (asset: { uri: string; mimeType: string }) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) set({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
  };

  const save = async () => {
    if (saving || !title.trim() || !effectiveAttribution) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      // Uploads first: a recipe row pointing at bytes that never arrived is a permanently
      // broken image in an archive whose whole promise is permanence. Both reject on
      // failure, so a photo can never silently go missing.
      const dishUp = dish ? await actions.uploadMedia(dish.uri, dish.mimeType) : null;
      const cardUp = card ? await actions.uploadMedia(card.uri, card.mimeType) : null;

      await actions.addRecipe({
        title: title.trim(),
        attribution: effectiveAttribution,
        personId,
        provenance: provenance.trim() || undefined,
        prepText: prepText.trim() || undefined,
        yieldText: yieldText.trim() || undefined,
        // Split on newlines: people type lists the way they write them.
        ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
        steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        photoMediaId: dishUp?.id,
        cardMediaId: cardUp?.id,
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
          title={saving ? "Adding it to the box..." : "Add to the recipe box"}
          compactTitle={saving ? "Saving..." : "Save recipe"}
          disabled={saving || !title.trim() || !effectiveAttribution}
          onPress={save}
          secondaryTitle="Never mind"
          secondaryIcon="close"
          onSecondary={onCancel}
        />
      )}
    >
      <View style={styles.head}>
        <IconBadge name="recipe" size={48} tone="mint" />
        <AppText variant="title">Add a recipe</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant}>
          The card in her handwriting matters as much as the typed version. Photograph it
          before it fades.
        </AppText>
      </View>

      {/*
        The handwritten card comes FIRST, above the typed detail, because it is the primary
        source and the thing most likely to be lost. Putting it after the ingredients would
        make it feel like an optional extra.
      */}
      <Card tone="low" style={styles.cardSlot}>
        <View style={styles.cardHead}>
          <Icon name="camera" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="label">The handwritten card</AppText>
            <AppText variant="small" color={colors.onSurfaceVariant}>
              The original, in their own hand. This is the heirloom.
            </AppText>
          </View>
        </View>

        {card ? (
          <View style={styles.previewRow}>
            <Image source={{ uri: card.uri }} style={styles.cardPreview} />
            <Button title="Replace" kind="outline" small onPress={() => pick(setCard)} />
          </View>
        ) : (
          <Button
            title="Photograph the card"
            kind="tonal"
            icon="camera"
            onPress={() => pick(setCard)}
          />
        )}
      </Card>

      <Field
        label="What is it called?"
        value={title}
        onChangeText={setTitle}
        placeholder="Nana Ruth's Cardamom & Apple Braided Bread"
        editable={!saving}
        multiline
      />

      {/* Attribution is required: an unattributed recipe is a cooking instruction. */}
      {people.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label">Whose recipe is it?</AppText>
          <View style={styles.choices}>
            {people.map((p) => {
              const on = personId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPersonId(on ? undefined : p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.name}
                  style={[styles.choice, on && styles.choiceOn]}
                >
                  <Avatar person={p} size={24} />
                  <AppText variant="labelSm" color={on ? colors.onPrimary : colors.onSurface}>
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {!personId ? (
        <Field
          label="Or type whose it is"
          value={attribution}
          onChangeText={setAttribution}
          placeholder="Great Grandma Ida"
          editable={!saving}
          autoCapitalize="words"
        />
      ) : null}

      <Field
        label="The tradition line"
        optional
        value={provenance}
        onChangeText={setProvenance}
        // This line is what makes it an heirloom rather than a recipe.
        placeholder="Baked every Easter morning since 1968 in Leeds."
        editable={!saving}
        multiline
      />

      <Field
        label="Ingredients"
        optional
        value={ingredients}
        onChangeText={setIngredients}
        placeholder={"One per line:\n500g strong white flour\n7g dried yeast"}
        editable={!saving}
        multiline
        tall
      />

      <Field
        label="How it is made"
        optional
        value={steps}
        onChangeText={setSteps}
        placeholder={"One step per line. Include the bit that always goes wrong."}
        editable={!saving}
        multiline
        tall
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="Prep time"
            optional
            value={prepText}
            onChangeText={setPrepText}
            placeholder="45m"
            editable={!saving}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Makes"
            optional
            value={yieldText}
            onChangeText={setYieldText}
            placeholder="2 loaves"
            editable={!saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label">A photograph of the dish  (optional)</AppText>
        <View style={styles.previewRow}>
          {dish ? <Image source={{ uri: dish.uri }} style={styles.dishPreview} /> : null}
          <Button
            title={dish ? "Replace" : "Add a photograph"}
            kind="outline"
            small
            icon="camera"
            onPress={() => pick(setDish)}
          />
        </View>
      </View>
    </Screen>
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
  cardSlot: { gap: spacing.md, marginTop: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
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
  inputTall: { minHeight: 120, textAlignVertical: "top" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    minHeight: 40,
  },
  choiceOn: { backgroundColor: colors.primary },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardPreview: { width: 96, height: 72, borderRadius: radii.inner },
  dishPreview: { width: 72, height: 72, borderRadius: radii.inner },
});
