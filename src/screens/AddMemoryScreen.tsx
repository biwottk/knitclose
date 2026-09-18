import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { PrivacyBadge } from "../components/PrivacyBadge";
import {
  colors, fonts, INPUT_MIN, motion, radii, spacing, TOUCH_MIN, type,
} from "../theme";
import { AUDIENCE_LABEL, MEMORY_KINDS, memoryKind, type Audience, type MemoryKind } from "../types";
import { useStore } from "../store";

/**
 * "Add to the archive."
 *
 * WHAT THIS REPLACES: one button that always opened a 4-step Great Deed wizard. That
 * framing asked people to decide their story was *great* before they could write it, so a
 * cancer scare, a funeral and a nickname nobody can explain simply never got recorded --
 * and the archive quietly became a highlight reel.
 *
 * The flow is: PICK THE KIND, then get a form that fits it.
 *
 *   - A great deed keeps the full 4-step wizard. It is right for a curated, attributed,
 *     dated story and wrong for everything else.
 *   - Every other kind gets ONE short screen. "I remember the smell of her kitchen" should
 *     not cost four steps, and ideas.md is explicit that forcing everything through the
 *     wizard is what turns a family app into a museum.
 *
 * See docs/memory_kinds.md for why these six.
 */
export function AddMemoryScreen({
  onDone, onCancel, onOpenWizard, initialKind,
}: {
  onDone: (deedId: string) => void;
  onCancel: () => void;
  /** Great deeds hand off to the existing 4-step wizard. */
  onOpenWizard: () => void;
  /** Skip the picker when the caller already knows (e.g. "In memory" from a profile). */
  initialKind?: MemoryKind;
}) {
  const { people, actions, currentUser } = useStore();
  const [kind, setKind] = useState<MemoryKind | null>(initialKind ?? null);

  // Choose the register first. Nothing else is asked until this is answered, because the
  // answer changes what is worth asking.
  if (!kind) {
    return (
      <Screen>
        <View style={styles.head}>
          <AppText variant="title">What would you like to keep?</AppText>
          <AppText variant="body" color={colors.onSurfaceVariant}>
            Anything a family remembers belongs here -- not only the proud things.
          </AppText>
        </View>

        <View style={styles.kindList}>
          {MEMORY_KINDS.map((k) => (
            <Pressable
              key={k.kind}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                // The wizard is a different screen, so hand straight over.
                if (k.wizard) onOpenWizard();
                else setKind(k.kind);
              }}
              accessibilityRole="button"
              accessibilityLabel={k.label + ". " + k.prompt}
              style={({ pressed }) => [
                styles.kindRow,
                pressed && { transform: [{ scale: motion.pressScale }] },
              ]}
            >
              <IconBadge name={k.icon as IconName} size={44} tone="mint" />
              <View style={styles.kindText}>
                <AppText variant="label">{k.label}</AppText>
                <AppText variant="small" color={colors.onSurfaceVariant}>{k.prompt}</AppText>
                {/*
                  The example is the most useful thing on this screen. A label tells you
                  the category; an example tells you the REGISTER -- that "a hard time" is
                  for Dad's cancer scare and not for a bad day at work.
                */}
                <AppText variant="small" color={colors.onSurfaceFaint} style={styles.example}>
                  {k.example}
                </AppText>
              </View>
              <Icon name="chevronRight" size={16} color={colors.onSurfaceFaint} />
            </Pressable>
          ))}
        </View>

        <Button title="Never mind" kind="quiet" icon="close" onPress={onCancel} />
      </Screen>
    );
  }

  return (
    <ShortForm
      kind={kind}
      people={people}
      currentPersonId={currentUser.personId}
      onBack={() => (initialKind ? onCancel() : setKind(null))}
      onSave={async (input) => {
        const id = await actions.addDeed(input);
        if (id) onDone(id);
        return Boolean(id);
      }}
    />
  );
}

/**
 * One screen for the five lighter kinds.
 *
 * Everything optional is visibly optional. The only required field is the title, because
 * an entry with no title cannot be listed -- and even that is labelled in the kind's own
 * language ("What happened?" for a hard time, not "Title").
 */
function ShortForm({
  kind, people, currentPersonId, onBack, onSave,
}: {
  kind: MemoryKind;
  people: { id: string; name: string; isLiving: boolean; memorialised?: boolean }[];
  currentPersonId: string;
  onBack: () => void;
  onSave: (input: {
    kind: MemoryKind; title: string; whenText: string; story?: string;
    personIds?: string[]; mediaIds?: string[]; audience?: Audience; mayResurface?: boolean;
  }) => Promise<boolean>;
}) {
  const meta = memoryKind(kind);
  const { actions } = useStore();

  const [title, setTitle] = useState("");
  const [whenText, setWhenText] = useState("");
  const [story, setStory] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [audience, setAudience] = useState<Audience>(meta.adultsByDefault ? "adults" : "everyone");
  const [resurface, setResurface] = useState(meta.resurfaceByDefault);
  const [saving, setSaving] = useState(false);

  /**
   * "In memory" only makes sense about someone who has gone, so the list is filtered
   * rather than showing living relatives that would be wrong to choose.
   */
  const candidates = kind === "inMemory"
    ? people.filter((p) => !p.isLiving || p.memorialised)
    : people;

  const save = async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    try {
      const mediaIds: string[] = [];
      for (const p of photos) {
        const up = await actions.uploadMedia(p.uri, "image/jpeg");
        if (!up) throw new Error("upload failed");
        mediaIds.push(up.id);
      }
      const ok = await onSave({
        kind,
        title: title.trim(),
        // "Undated" is honest: lore and memories often have no date, and demanding one is
        // what stops them being written down at all.
        whenText: whenText.trim() || "Undated",
        story: story.trim() || undefined,
        personIds,
        mediaIds,
        audience,
        mayResurface: resurface,
      });
      if (!ok) setSaving(false);
    } catch {
      setSaving(false);
      Alert.alert(
        "We could not save this",
        "Your words are still here. Please check your connection and try again.",
      );
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button
            title={saving ? "Keeping it safe..." : "Add to the archive"}
            icon="check"
            disabled={saving || !title.trim()}
            onPress={save}
          />
          <Button title="Go back" kind="quiet" icon="chevronLeft" onPress={onBack} />
        </>
      }
    >
      <View style={styles.head}>
        <View style={styles.kindBadgeRow}>
          <IconBadge name={meta.icon as IconName} size={40} tone="mint" />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{meta.label}</AppText>
            <AppText variant="small" color={colors.onSurfaceVariant}>{meta.prompt}</AppText>
          </View>
        </View>

        {/*
          A hard time defaults to adults-only, and saying so up front is the difference
          between a thoughtful default and a surprise. Children's accounts never see it.
        */}
        {meta.adultsByDefault ? (
          <PrivacyBadge text="Adults only, unless you change it below" />
        ) : null}
      </View>

      <Field
        label={
          kind === "hardTime" ? "What happened?"
          : kind === "lore" ? "What is the story called?"
          : kind === "inMemory" ? "What are you remembering?"
          : "What would you call this?"
        }
        value={title}
        onChangeText={setTitle}
        placeholder={meta.example}
        editable={!saving}
        multiline
      />

      <Field
        label="When was it?"
        optional
        value={whenText}
        onChangeText={setWhenText}
        // Fuzzy on purpose: "the nineties, mostly" is a real answer and a date picker
        // cannot express it. types.ts keeps whenText precisely so this is never lost.
        placeholder={kind === "lore" ? "Nobody can agree" : "Summer of 1978, or last Tuesday"}
        editable={!saving}
      />

      <Field
        label={kind === "hardTime" ? "Anything you want to say about it" : "Tell it properly"}
        optional
        value={story}
        onChangeText={setStory}
        placeholder="As much or as little as you like."
        editable={!saving}
        multiline
        tall
      />

      {/* Lore is about "us", so a subject is genuinely optional and never nagged for. */}
      {candidates.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label">
            {kind === "inMemory" ? "Who are you remembering?" : "Who is it about?"}
            {meta.needsPerson ? "" : "  (optional)"}
          </AppText>
          <View style={styles.people}>
            {candidates.map((p) => {
              const selected = personIds.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPersonIds((ids) =>
                    selected ? ids.filter((x) => x !== p.id) : [...ids, p.id])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={p.name}
                  style={({ pressed }) => [
                    styles.personChip,
                    selected && styles.personChipOn,
                    pressed && { transform: [{ scale: motion.pressScale }] },
                  ]}
                >
                  <Avatar person={p as never} size={26} />
                  <AppText
                    variant="labelSm"
                    color={selected ? colors.onPrimary : colors.onSurface}
                  >
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="label">Add a photograph  (optional)</AppText>
        <View style={styles.photos}>
          {photos.map((p, i) => (
            <Image key={p.uri + i} source={{ uri: p.uri }} style={styles.photo} />
          ))}
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add a photograph"
            style={styles.photoAdd}
          >
            <Icon name="camera" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/*
        Who can see it. Shown for every kind rather than hidden in an advanced section:
        the audience is the privacy promise made concrete, and burying it is how somebody
        ends up sharing a hard time with a nine-year-old.
      */}
      <View style={styles.section}>
        <AppText variant="label">Who can see this?</AppText>
        <View style={styles.people}>
          {(["everyone", "adults"] as Audience[]).map((a) => (
            <Pressable
              key={a}
              onPress={() => setAudience(a)}
              accessibilityRole="radio"
              accessibilityState={{ selected: audience === a }}
              style={[styles.personChip, audience === a && styles.personChipOn]}
            >
              <Icon
                name={a === "adults" ? "lock" : "people"}
                size={14}
                color={audience === a ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <AppText
                variant="labelSm"
                color={audience === a ? colors.onPrimary : colors.onSurface}
              >
                {AUDIENCE_LABEL[a]}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/*
        Resurfacing consent, offered ONLY for the kinds where it is a real question.
        Asking "shall we remind you of this every year?" about a driving test is noise;
        asking it about a bereavement is the difference between care and cruelty.
      */}
      {!meta.resurfaceByDefault ? (
        <Card tone="low" style={styles.section}>
          <Pressable
            onPress={() => setResurface((r) => !r)}
            accessibilityRole="switch"
            accessibilityState={{ checked: resurface }}
            accessibilityLabel="Let this come round again on its anniversary"
            style={styles.consentRow}
          >
            <Icon
              name={resurface ? "checkAll" : "close"}
              size={18}
              color={resurface ? colors.primary : colors.onSurfaceFaint}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="label">Let this come round again</AppText>
              <AppText variant="small" color={colors.onSurfaceVariant}>
                {resurface
                  ? "We may show this on its anniversary."
                  : "We will never bring this up on its own. You can always come and find it."}
              </AppText>
            </View>
          </Pressable>
        </Card>
      ) : null}
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
  kindBadgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  kindList: { gap: spacing.sm + 2 },
  kindRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.card,
    padding: spacing.md,
    minHeight: TOUCH_MIN + 16,
  },
  kindText: { flex: 1, gap: 2 },
  /** The example is set in the serif italic used for the family's own words. */
  example: { fontFamily: fonts.serifItalic, marginTop: 2 },

  section: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: INPUT_MIN,
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    fontSize: type.bodyMd.fontSize,
    fontFamily: fonts.sans,
    color: colors.onSurface,
  },
  inputTall: { minHeight: 128, textAlignVertical: "top" },

  people: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  personChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    minHeight: 40,
  },
  personChipOn: { backgroundColor: colors.primary },

  photos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 76, height: 76, borderRadius: radii.inner },
  photoAdd: {
    width: 76, height: 76, borderRadius: radii.inner,
    borderWidth: 1.5, borderColor: colors.primaryFixed,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },

  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
});
