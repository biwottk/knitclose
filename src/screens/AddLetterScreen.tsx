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
import { LETTER_KIND_LABEL, type LetterKind } from "../types";
import { useStore } from "../store";

/**
 * Add a letter, card or diary page to the Letter Box.
 *
 * THE PHOTOGRAPH IS THE HEIRLOOM, so it leads -- above the title, above everything. The
 * typed transcription is a convenience for reading and searching; the handwriting is the
 * part that is irreplaceable, and it is the part that is physically decaying in a drawer.
 *
 * Transcription is offered but never demanded. A family that photographs fifty letters and
 * types none has still saved them, and blocking the save on a wall of typing would mean the
 * photographs never happen either.
 */
export function AddLetterScreen({
  onDone, onCancel,
}: { onDone: () => void; onCancel: () => void }) {
  const { people, actions } = useStore();

  const [kind, setKind] = useState<LetterKind>("letter");
  const [pages, setPages] = useState<{ uri: string; mimeType: string }[]>([]);
  const [title, setTitle] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromPersonId, setFromPersonId] = useState<string | undefined>();
  const [toName, setToName] = useState("");
  const [whenText, setWhenText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [provenance, setProvenance] = useState("");
  const [heldByName, setHeldByName] = useState("");
  const [saving, setSaving] = useState(false);
  /** The last failure, shown inline above the save button until the next attempt. */
  const [error, setError] = useState<unknown>(null);

  const writer = people.find((p) => p.id === fromPersonId);
  const effectiveFrom = fromName.trim() || writer?.name || "";

  const addPage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPages((prev) => [...prev, { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }]);
    }
  };

  const save = async () => {
    if (saving || !title.trim()) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      // Uploads first: a letter row pointing at bytes that never arrived is a permanently
      // broken image in an archive whose whole promise is permanence. Rejects on failure,
      // so a page can never silently go missing.
      const ids: string[] = [];
      for (const page of pages) {
        const up = await actions.uploadMedia(page.uri, page.mimeType);
        ids.push(up.id);
      }

      await actions.addLetter({
        kind,
        title: title.trim(),
        fromName: effectiveFrom || undefined,
        fromPersonId,
        toName: toName.trim() || undefined,
        whenText: whenText.trim() || undefined,
        transcript: transcript.trim() || undefined,
        // Typing it out yourself IS the confirmation -- a person read the handwriting and
        // decided what it says. Only machine OCR starts unconfirmed.
        transcriptConfirmed: transcript.trim().length > 0,
        provenance: provenance.trim() || undefined,
        heldByName: heldByName.trim() || undefined,
        imageMediaId: ids[0],
        pageMediaIds: ids,
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
          title={saving ? "Keeping it safe..." : "Add to the letter box"}
          compactTitle={saving ? "Saving..." : "Save letter"}
          disabled={saving || !title.trim()}
          onPress={save}
          secondaryTitle="Never mind"
          secondaryIcon="close"
          onSecondary={onCancel}
        />
      )}
    >
      <View style={styles.head}>
        <IconBadge name="note" size={48} tone="mint" />
        <AppText variant="title">Add a letter</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant}>
          Photograph it before the ink goes. Type it out and it becomes searchable forever --
          but the handwriting is kept either way.
        </AppText>
      </View>

      {/* The photographs lead, because the original is the heirloom. */}
      <Card tone="low" style={styles.pagesCard}>
        <View style={styles.cardHead}>
          <Icon name="camera" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="label">The original</AppText>
            <AppText variant="small" color={colors.onSurfaceVariant}>
              One photograph per page, in order.
            </AppText>
          </View>
        </View>

        <View style={styles.pageStrip}>
          {pages.map((page, i) => (
            <View key={page.uri + i} style={styles.pageWrap}>
              <Image source={{ uri: page.uri }} style={styles.page} />
              {/* Page number, because a three-page letter out of order is a puzzle. */}
              <View style={styles.pageNum}>
                <AppText variant="micro" color={colors.onPrimary}>{i + 1}</AppText>
              </View>
              <Pressable
                onPress={() => setPages((p) => p.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={"Remove page " + (i + 1)}
                hitSlop={8}
                style={styles.pageRemove}
              >
                <Icon name="close" size={12} color={colors.onErrorContainer} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={addPage}
            accessibilityRole="button"
            accessibilityLabel="Add a photograph of a page"
            style={styles.pageAdd}
          >
            <Icon name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <View style={styles.section}>
        <AppText variant="label">What is it?</AppText>
        <View style={styles.choices}>
          {(Object.keys(LETTER_KIND_LABEL) as LetterKind[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k }}
              style={[styles.choice, kind === k && styles.choiceOn]}
            >
              <AppText variant="labelSm" color={kind === k ? colors.onPrimary : colors.onSurface}>
                {LETTER_KIND_LABEL[k]}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <Field
        label="What would you call it?"
        value={title}
        onChangeText={setTitle}
        placeholder="Arthur to Ruth, the week before the wedding"
        editable={!saving}
        multiline
      />

      {people.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label">Who wrote it?  (optional)</AppText>
          <View style={styles.choices}>
            {people.map((p) => {
              const on = fromPersonId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setFromPersonId(on ? undefined : p.id)}
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

      {/* Most letters in a shoebox are from people who will never be in the tree. */}
      {!fromPersonId ? (
        <Field
          label="Or type who wrote it"
          optional
          value={fromName}
          onChangeText={setFromName}
          placeholder="Great Aunt Eleanor"
          editable={!saving}
          autoCapitalize="words"
        />
      ) : null}

      <Field
        label="Who was it for?"
        optional
        value={toName}
        onChangeText={setToName}
        placeholder="Nana Ruth"
        editable={!saving}
        autoCapitalize="words"
      />

      <Field
        label="When was it written?"
        optional
        value={whenText}
        onChangeText={setWhenText}
        // Fuzzy on purpose: a postmark is often all there is.
        placeholder="Spring 1944, or postmarked but undated"
        editable={!saving}
      />

      {/*
        The transcription. Offered as a serif field, because what gets typed here are her
        words and the input should look like it knows that.
      */}
      <View style={styles.section}>
        <AppText variant="label">Type out what it says  (optional)</AppText>
        <AppText variant="small" color={colors.onSurfaceVariant}>
          This is what makes it searchable. You can do it later, or a bit at a time.
        </AppText>
        <TextInput
          value={transcript}
          onChangeText={setTranscript}
          multiline
          placeholder="My dearest Ruth,"
          placeholderTextColor={colors.outline}
          accessibilityLabel="Transcription"
          editable={!saving}
          style={styles.transcript}
        />
      </View>

      <Field
        label="Where did it come from?"
        optional
        value={provenance}
        onChangeText={setProvenance}
        placeholder="Great Aunt Eleanor attic box, c. 1954"
        editable={!saving}
      />

      {/* Who holds the original: stops a family losing track of the physical object. */}
      <Field
        label="Who has the original now?"
        optional
        value={heldByName}
        onChangeText={setHeldByName}
        placeholder="Uncle Dave"
        editable={!saving}
        autoCapitalize="words"
      />
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
  pagesCard: { gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pageStrip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pageWrap: { position: "relative" },
  page: { width: 84, height: 108, borderRadius: radii.inner },
  pageNum: {
    position: "absolute", bottom: 4, left: 4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  pageRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.errorContainer,
    alignItems: "center", justifyContent: "center",
  },
  pageAdd: {
    width: 84, height: 108, borderRadius: radii.inner,
    borderWidth: 1.5, borderColor: colors.primaryFixed,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
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
  /** Serif, because what gets typed here are the writer own words. */
  transcript: {
    minHeight: 160,
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
