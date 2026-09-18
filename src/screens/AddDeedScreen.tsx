import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/Screen";
import { AppText } from "../components/Text";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import {
  colors, fonts, INPUT_MIN, motion, radii, spacing, TOUCH_MIN, type,
}  from "../theme";
import { ALL_TAGS, tagLabel, type DeedTag, type Media } from "../types";
import { newId, useStore } from "../store";

/**
 * Screen 5 -- "Add Deed" story wizard.
 *
 * Deliberately a four-step wizard, NOT one long form. Breaking a complex task into
 * small chunks is what makes this usable across generations
 * (docs/great_deeds_ui_ux.md screen 5).
 */
const STEPS = 4;

export function AddDeedScreen({
  onDone, onCancel,
}: { onDone: (deedId: string) => void; onCancel: () => void }) {
  const { people, actions } = useStore();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [personIds, setPersonIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [whenText, setWhenText] = useState("");
  const [tags, setTags] = useState<DeedTag[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [story, setStory] = useState("");

  const canAdvance =
    step === 1 ? personIds.length > 0
    : step === 2 ? title.trim().length > 0 && whenText.trim().length > 0
    : true;

  /**
   * Persist the story.
   *
   * Media is uploaded FIRST and the deed references the returned ids. That order
   * matters: a deed row pointing at bytes that never arrived is a permanent broken
   * image in an archive whose whole promise is permanence, whereas an orphaned object
   * is invisible and cheap to clean up.
   *
   * The picker gives local file:// uris, which mean nothing to another family member's
   * phone -- so uploading is what actually makes a photo shared rather than personal.
   */
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const mediaIds: string[] = [];
      for (const m of media) {
        const uploaded = await actions.uploadMedia(
          m.uri,
          m.kind === "video" ? "video/mp4" : "image/jpeg",
          m.durationSec,
        );
        // A failed upload must not silently drop a photo from the story.
        if (!uploaded) throw new Error("upload failed");
        mediaIds.push(uploaded.id);
      }

      const id = await actions.addDeed({
        title: title.trim(),
        whenText: whenText.trim(),
        story: story.trim(),
        personIds,
        tags,
        mediaIds,
        // A new deed goes to the whole circle by default; it can be narrowed later.
        audience: "everyone",
      });

      if (id) onDone(id);          // Hand off to the peak moment.
      else setSaving(false);       // The store already surfaced the failure.
    } catch {
      setSaving(false);
      Alert.alert(
        "We could not save this story",
        "Your words are still here. Please check your connection and try again.",
      );
    }
  };

  const pickMedia = async (kind: "photo" | "video") => {
    // Just-in-time permission, asked in our own warm voice via app.json copy.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "photo" ? ["images"] : ["videos"],
      quality: 0.85,
      // Video clips are capped at 60 seconds by design.
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setMedia((m) => [...m, {
      id: newId("m"),
      kind,
      uri: asset.uri,
      durationSec: asset.duration ? Math.round(asset.duration / 1000) : undefined,
    }]);
  };

  return (
    <Screen
      scroll={false}
      // A navigation header already covers the status bar on this screen.
      insetTop={false}
      footer={
        <>
          {step < STEPS ? (
            <Button
              title={step === 1 ? "Next" : step === 2 ? "Next" : "Almost there — Next"}
              disabled={!canAdvance}
              onPress={() => setStep(step + 1)}
              icon="chevronRight"
              iconTrailing
            />
          ) : (
            // Uploading photos over a phone connection is not instant, so the label
            // reports what is happening. Disabling as well prevents a double tap from
            // creating the same story twice -- which in a permanent archive means a
            // duplicate somebody has to clean up by hand.
            <Button
              title={saving ? "Saving your story..." : "Share with my family"}
              onPress={save}
              icon="send"
              disabled={saving}
            />
          )}
          <Button
            title={step === 1 ? "Cancel" : "Go back"}
            kind="quiet"
            icon={step === 1 ? "close" : "chevronLeft"}
            onPress={() => (step === 1 ? onCancel() : setStep(step - 1))}
          />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/*
          The step indicator is a segmented progress bar rather than four static
          dots: each segment fills on the way in, so advancing a step is something
          you see happen instead of a colour that has silently already changed.
        */}
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={"Step " + step + " of " + STEPS}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <ProgressSegment key={i} filled={i < step} />
          ))}
        </View>
        {/* Tabular figures: the counter changes on every step and must not jitter. */}
        <AppText variant="mono">Step {step} of {STEPS}</AppText>

        {step === 1 ? (
          <>
            <AppText variant="title">Who is this great deed about?</AppText>
            <View style={{ gap: spacing.sm + 2 }}>
              {people.map((p) => {
                const selected = personIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      setPersonIds((ids) =>
                        selected ? ids.filter((x) => x !== p.id) : [...ids, p.id])
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={p.name}
                    style={({ pressed }) => [
                      styles.personRow,
                      selected && styles.personRowSelected,
                      // A whole-row press scales; dimming a large surface reads as a fault.
                      pressed && { transform: [{ scale: motion.pressScale }] },
                    ]}
                  >
                    <Avatar person={p} size={44} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" bold>{p.name}</AppText>
                      {!p.isLiving ? (
                        <AppText variant="small">In loving memory</AppText>
                      ) : null}
                    </View>
                    {/*
                      A filled forest tick when chosen, a quiet plus when not. These
                      were bare tick and plus text characters before, which sat on
                      different baselines per platform and could not be tinted.
                    */}
                    <View style={[styles.pick, selected && styles.pickOn]}>
                      <Icon
                        name={selected ? "check" : "add"}
                        size={18}
                        color={selected ? colors.onPrimary : colors.onSurfaceFaint}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AppText variant="title">What's a title for this story?</AppText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Built a cabin by hand for the family"
              placeholderTextColor={colors.outline}
              accessibilityLabel="Story title"
            />

            <AppText variant="title" style={{ marginTop: spacing.lg }}>
              When did this happen?
            </AppText>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              A year or a season is perfectly fine.
            </AppText>
            <TextInput
              style={styles.input}
              value={whenText}
              onChangeText={setWhenText}
              placeholder="Summer of 1978"
              placeholderTextColor={colors.outline}
              accessibilityLabel="When this happened"
            />

            <AppText variant="title" style={{ marginTop: spacing.lg }}>
              What kind of deed was it?
            </AppText>
            <View style={styles.tagWrap}>
              {ALL_TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTags((ts) => on ? ts.filter((x) => x !== t) : [...ts, t])}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={tagLabel(t)}
                    // Visible height is 44; hitSlop carries it to the mandated 48.
                    hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
                    style={({ pressed }) => [
                      styles.tagChip, on && styles.tagChipOn, pressed && { opacity: 0.75 },
                    ]}
                  >
                    {on ? <Icon name="check" size={15} color={colors.onPrimary} /> : null}
                    <AppText variant="label" color={on ? colors.onPrimary : colors.onPrimaryFixedVariant}>
                      {tagLabel(t)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <AppText variant="title">Add your memories.</AppText>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              You can skip this and add photos later.
            </AppText>

            {/* Semantic glyphs inherit the button's own label colour, which the
                camera/clapperboard/microphone emoji never could. */}
            <Button title="Add a Photo" icon="camera" kind="outline"
              onPress={() => pickMedia("photo")} />
            <Button title="Add a Video" icon="video" kind="outline"
              onPress={() => pickMedia("video")} />
            <Button title="Record their Voice" icon="voice" kind="outline"
              onPress={() => {}} />
            <AppText variant="small">
              Voice recording arrives in the next update. Photos and videos work now.
            </AppText>

            {media.length > 0 ? (
              <View style={styles.mediaWrap}>
                {media.map((m) => (
                  <View key={m.id} style={styles.thumbWrap}>
                    {m.kind === "photo" ? (
                      <Image source={{ uri: m.uri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbVideo]}>
                        <Icon name="video" size={28} color={colors.onSurfaceVariant} />
                      </View>
                    )}
                    <Pressable
                      onPress={() => setMedia((all) => all.filter((x) => x.id !== m.id))}
                      accessibilityRole="button"
                      accessibilityLabel="Remove this item"
                      // The badge is 28px on purpose -- it must not cover the
                      // thumbnail -- so hitSlop supplies the rest of the 48px zone.
                      hitSlop={10}
                      style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Icon name="close" size={16} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <AppText variant="title">Tell the story.</AppText>
            <AppText variant="body" color={colors.onSurfaceVariant}>
              What do you remember about this?
            </AppText>
            <TextInput
              style={[styles.input, styles.storyInput]}
              value={story}
              onChangeText={setStory}
              multiline
              textAlignVertical="top"
              placeholder="He borrowed a truck, felled the pines himself, and worked from a drawing he kept folded in his shirt pocket…"
              placeholderTextColor={colors.outline}
              accessibilityLabel="The story"
            />
            <Card tone="container" elevation="flat" style={styles.futureCard}>
              <View style={styles.futureHead}>
                <Icon name="sparkle" size={15} color={colors.onPrimaryFixedVariant} />
                <AppText variant="micro">COMING LATER</AppText>
              </View>
              <AppText variant="body" style={{ marginTop: spacing.xs }}>
                Stuck for words? A future update can turn a few notes into a first draft
                for you to edit.
              </AppText>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * One segment of the step indicator. The fill animates its width, so the bar
 * reports progress as movement -- a static two-tone bar is the thing that made
 * the old four-pip row look like a decoration rather than a state.
 */
function ProgressSegment({ filled }: { filled: boolean }) {
  const grow = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: filled ? 1 : 0,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      // Width is not a native-driver property; the bar is 6px, so it is cheap.
      useNativeDriver: false,
    }).start();
  }, [filled, grow]);

  return (
    <View style={styles.segment}>
      <Animated.View
        style={[
          styles.segmentFill,
          { width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  progress: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  /** Pill-ended segments on a warm track: rounder and quieter than the old 3px pips. */
  segment: {
    flex: 1, height: spacing.xs + 2, borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh, overflow: "hidden",
  },
  segmentFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.primary },
  input: {
    minHeight: INPUT_MIN, marginTop: spacing.sm,
    // Filled rather than outlined: a field reads as a place to type because it is
    // recessed into the page, not because it is fenced with a 1.5px rule.
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: type.bodyMd.fontSize, fontFamily: fonts.sans, color: colors.onSurface,
  },
  storyInput: { minHeight: 200, lineHeight: type.bodyLg.lineHeight },
  personRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    minHeight: TOUCH_MIN + 16, padding: spacing.sm + 4,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceLowest,
  },
  /** Chosen: an amber wash, which needs its own faint edge to separate from the canvas. */
  personRowSelected: {
    backgroundColor: colors.tertiaryFixed,
    borderWidth: 1, borderColor: colors.tertiaryFixedDim,
  },
  pick: {
    width: 30, height: 30, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  pickOn: { backgroundColor: colors.primary },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  tagChip: {
    minHeight: TOUCH_MIN - 4, flexDirection: "row", alignItems: "center",
    gap: spacing.xs + 2, justifyContent: "center",
    paddingHorizontal: spacing.md, borderRadius: radii.pill,
    backgroundColor: colors.primaryFixed,
  },
  tagChipOn: { backgroundColor: colors.primary },
  mediaWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  thumbWrap: { position: "relative" },
  thumb: { width: 96, height: 96, borderRadius: radii.inner, backgroundColor: colors.surfaceContainer },
  thumbVideo: { alignItems: "center", justifyContent: "center" },
  removeBtn: {
    position: "absolute", top: -6, right: -6,
    width: 28, height: 28, borderRadius: radii.pill,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  futureCard: { marginTop: spacing.md },
  futureHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
});
