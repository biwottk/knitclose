import React from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { AppText } from "./Text";
import { Icon } from "./Icon";
import { colors, motion, radii, spacing, TOUCH_MIN } from "../theme";
import type { Media } from "../types";

/**
 * The audio bar, and arguably the most important component in the app.
 *
 * Voice is how the least tech-confident members will actually contribute:
 * grandparents who will never type will happily talk. So this gets a large,
 * high-contrast play control, a tactile waveform, and -- crucially -- the
 * transcript rendered as a quotation right underneath.
 *
 * WHAT CHANGED IN THE REFRESH:
 *   - The waveform ANIMATES while playing. It was previously a static bar chart
 *     with a hardcoded "played" third, which is the clearest possible tell that a
 *     control is fake. Bars now breathe on a staggered loop, and a real progress
 *     value drives the played/unplayed split.
 *   - Play/pause are vector glyphs (filled triangle, filled bars) rather than the
 *     "▶"/"⏸" text characters, which rendered at different sizes and baselines on
 *     every platform.
 *   - The transcript disclosure animates its chevron and is collapsed by default
 *     on compact surfaces, so a chat thread of voice notes is scannable.
 *   - Playback speed is a real cycling control (1x → 1.5x → 2x → 0.75x). Elders
 *     slow recordings down; teenagers speed them up. It was previously a dead label.
 *
 * Playback is backed by Expo Audio: progress, pause, completion and playback speed all
 * follow the actual recording rather than a simulated timer.
 */

const SPEEDS = [1, 1.5, 2, 0.75] as const;

export function VoiceNote({
  audio, label, transcript, tone = "light", speed = true, defaultExpanded = true,
}: {
  audio: Media;
  /** What this recording is, e.g. "Nana on proofing the dough". */
  label?: string;
  transcript?: string;
  /** `dark` sits on a forest/inverse surface. */
  tone?: "light" | "dark";
  /** Show the playback-speed control. Hidden in compact contexts. */
  speed?: boolean;
  /** Collapse the transcript initially -- for long threads. */
  defaultExpanded?: boolean;
}) {
  const player = useAudioPlayer(audio.uri, { updateInterval: 200 });
  const playback = useAudioPlayerStatus(player);
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [speedIdx, setSpeedIdx] = React.useState(0);

  const dark = tone === "dark";
  const fg = dark ? colors.inverseOnSurface : colors.onSurface;
  const meta = dark ? colors.primaryFixedDim : colors.onSurfaceFaint;

  const playing = playback.playing;
  const total = playback.duration || audio.durationSec || 0;
  const elapsed = Math.round(playback.currentTime || 0);
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (playing) player.pause();
    else {
      if (total > 0 && playback.currentTime >= total - 0.1) await player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.wrap, dark ? styles.wrapDark : styles.wrapLight]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => void toggle()}
          accessibilityRole="button"
          accessibilityLabel={
            (playing ? "Pause" : "Play") + " recording" + (label ? ": " + label : "")
          }
          hitSlop={8}
          style={({ pressed }) => [
            styles.play,
            dark && styles.playDark,
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          {/* Filled glyphs: an outlined play triangle reads as disabled. */}
          <Icon
            name={playing ? "pause" : "play"}
            size={20}
            color={dark ? colors.primary : colors.onPrimary}
            filled
          />
        </Pressable>

        <View style={styles.middle}>
          {label ? (
            <AppText variant="labelSm" color={fg} numberOfLines={1}>{label}</AppText>
          ) : null}
          <Waveform playing={playing} dark={dark} progress={progress} />
        </View>

        <View style={styles.right}>
          {/* Tabular figures so the timer does not jitter as digits change. */}
          <AppText variant="mono" color={meta}>
            {formatDuration(playing || progress > 0 ? elapsed : total)}
          </AppText>
          {speed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Playback speed " + SPEEDS[speedIdx] + "x. Tap to change."}
              hitSlop={10}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSpeedIdx((i) => {
                  const next = (i + 1) % SPEEDS.length;
                  player.setPlaybackRate(SPEEDS[next]);
                  return next;
                });
              }}
              style={({ pressed }) => [
                styles.speed, dark && styles.speedDark, pressed && { opacity: 0.6 },
              ]}
            >
              <AppText variant="micro" color={dark ? colors.inverseOnSurface : colors.primary}>
                {SPEEDS[speedIdx]}×
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {transcript ? (
        <View style={[styles.transcript, dark && styles.transcriptDark]}>
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? "Hide transcription" : "Show transcription"}
            hitSlop={8}
            style={styles.transcriptHeader}
          >
            {/* Labelled, always: this is the machine's reading, not her writing. */}
            <View style={styles.transcriptTag}>
              <Icon name="sparkle" size={13} color={colors.primary} />
              <AppText variant="micro" color={colors.primary}>
                Auto-transcribed · searchable
              </AppText>
            </View>
            <Chevron expanded={expanded} color={meta} />
          </Pressable>

          {expanded ? (
            <AppText variant="quote" color={fg} style={styles.quote}>
              {"\u201C" + transcript + "\u201D"}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A chevron that rotates rather than swapping between "⌃" and "⌄" characters. */
function Chevron({ expanded, color }: { expanded: boolean; color: string }) {
  const spin = React.useRef(new Animated.Value(expanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(spin, {
      toValue: expanded ? 1 : 0,
      duration: motion.fast,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="chevronDown" size={18} color={color} />
    </Animated.View>
  );
}

/**
 * The waveform.
 *
 * Heights come from a fixed pattern rather than Math.random(), so the shape does
 * not flicker on every re-render -- a jittering waveform reads as a bug, and this
 * component re-renders on every playback tick.
 *
 * While playing, each bar animates on a staggered loop so the whole form breathes.
 * The stagger is what stops it looking like a single pulsing block.
 */
const PATTERN = [
  0.3, 0.55, 0.42, 0.8, 0.5, 0.95, 0.38, 0.68, 0.46, 0.78,
  0.34, 0.62, 0.88, 0.4, 0.7, 0.48, 0.84, 0.36, 0.58, 0.72,
  0.44, 0.66, 0.52, 0.9, 0.4, 0.6, 0.32, 0.74,
];

function Waveform({
  playing, dark, progress,
}: { playing: boolean; dark: boolean; progress: number }) {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!playing) {
      Animated.timing(pulse, {
        toValue: 0, duration: motion.base, useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [playing, pulse]);

  const playedUpTo = progress * PATTERN.length;

  return (
    <View
      style={styles.wave}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATTERN.map((h, i) => {
        const played = i < playedUpTo;
        // Alternating phase gives the loop its stagger without one animation per bar.
        const phase = i % 3;
        const scaleY = playing
          ? pulse.interpolate({
              inputRange: [0, 1],
              outputRange: phase === 0 ? [1, 0.55] : phase === 1 ? [0.7, 1] : [0.9, 0.72],
            })
          : 1;

        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: 4 + h * 26,
                transform: [{ scaleY }],
                backgroundColor: played
                  ? (dark ? colors.tertiaryFixedDim : colors.secondary)
                  : (dark ? "rgba(255,255,255,0.28)" : colors.surfaceHighest),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.card, padding: spacing.md, gap: spacing.md - 2 },
  wrapLight: { backgroundColor: colors.surfaceContainer },
  wrapDark: { backgroundColor: "rgba(255,255,255,0.1)" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md - 2 },
  play: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    // A small forest glow makes the primary control feel like a real button.
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  playDark: { backgroundColor: colors.primaryFixed, shadowOpacity: 0 },
  middle: { flex: 1, gap: spacing.xs, minWidth: 0 },
  wave: { flexDirection: "row", alignItems: "center", gap: 2.5, height: 32 },
  bar: { width: 3, borderRadius: 2 },
  right: { alignItems: "flex-end", gap: spacing.xs + 2 },
  speed: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radii.pill, backgroundColor: colors.surfaceLowest,
  },
  speedDark: { backgroundColor: "rgba(255,255,255,0.16)" },
  transcript: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.inner,
    padding: spacing.md - 2,
    gap: spacing.sm,
  },
  transcriptDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  transcriptHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, minHeight: 30,
  },
  transcriptTag: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, flexShrink: 1 },
  quote: { marginTop: spacing.xxs },
});
