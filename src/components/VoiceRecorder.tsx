import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState,
} from "expo-audio";
import { AppText } from "./Text";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { SaveError } from "./SaveError";
import { colors, radii, spacing, TOUCH_MIN } from "../theme";

export interface RecordedVoice {
  uri: string;
  mimeType: string;
  durationSec: number;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

/** Permission → record → review → re-record/use. No recording is sent without review. */
export function VoiceRecorder({
  onUse, prompt = "Record a voice note", disabled = false,
}: {
  onUse: (voice: RecordedVoice) => Promise<void> | void;
  prompt?: string;
  disabled?: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [clip, setClip] = React.useState<RecordedVoice | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const player = useAudioPlayer(clip?.uri ?? null);
  const playerState = useAudioPlayerStatus(player);

  const start = async () => {
    if (disabled || busy) return;
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone access is off. Allow it in your phone settings, then try again.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 10 * 60 });
    } catch (err) { setError(err); }
  };

  const stop = async () => {
    try {
      const durationSec = Math.max(1, Math.round(state.durationMillis / 1000));
      await recorder.stop();
      if (!recorder.uri) throw new Error("The recording could not be saved. Please record it again.");
      setClip({
        uri: recorder.uri,
        mimeType: Platform.OS === "web" ? "audio/webm" : "audio/m4a",
        durationSec,
      });
      await setAudioModeAsync({ allowsRecording: false });
    } catch (err) { setError(err); }
  };

  const use = async () => {
    if (!clip || busy) return;
    setBusy(true); setError(null);
    try { await onUse(clip); setClip(null); }
    catch (err) { setError(err); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.wrap}>
      <SaveError error={error} title="We could not finish this voice note. Nothing was sent." />
      {state.isRecording ? (
        <Pressable
          onPress={() => void stop()}
          accessibilityRole="button"
          accessibilityLabel={"Recording " + clock(state.durationMillis) + ". Tap to stop and review."}
          style={styles.recording}
        >
          <View style={styles.liveDot} />
          <View style={styles.copy}>
            <AppText variant="label" color={colors.onSecondaryFixed}>Recording… {clock(state.durationMillis)}</AppText>
            <AppText variant="small" color={colors.onSecondaryFixedVariant}>Tap to stop and review before sending</AppText>
          </View>
          <View style={styles.stop}><Icon name="stop" size={18} color={colors.onPrimary} /></View>
        </Pressable>
      ) : clip ? (
        <View style={styles.review}>
          <View style={styles.reviewHead}>
            <Pressable
              onPress={() => playerState.playing ? player.pause() : player.play()}
              accessibilityRole="button"
              accessibilityLabel={playerState.playing ? "Pause recording preview" : "Play recording preview"}
              style={styles.play}
            >
              <Icon name={playerState.playing ? "pause" : "play"} size={18} color={colors.onPrimary} />
            </Pressable>
            <View style={styles.copy}>
              <AppText variant="label">Listen before sending</AppText>
              <AppText variant="small" color={colors.onSurfaceVariant}>{clock(clip.durationSec * 1000)} recorded</AppText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button title="Record again" kind="quiet" small icon="voice" onPress={() => setClip(null)} />
            <Button title={busy ? "Sending…" : "Use voice note"} small icon="send" disabled={busy} onPress={() => void use()} fill />
          </View>
        </View>
      ) : (
        <Button title={prompt} icon="voice" kind="secondary" disabled={disabled} onPress={() => void start()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  recording: {
    minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, borderRadius: radii.card, backgroundColor: colors.secondaryFixed,
  },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.secondary },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  stop: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  review: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.card, backgroundColor: colors.surfaceContainer },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  play: { width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
