import React from "react";
import {
  FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { AppHeader } from "../components/AppHeader";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/Card";
import { AppText } from "../components/Text";
import { Chip } from "../components/Chip";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { VoiceNote } from "../components/VoiceNote";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { SaveError } from "../components/SaveError";
import { VoiceRecorder, type RecordedVoice } from "../components/VoiceRecorder";
import { colors, fonts, INPUT_MIN, radii, shadow, spacing, TOUCH_MIN, type } from "../theme";
import { shortName } from "../names";
import { newId, useStore } from "../store";
import type { Message, Thread } from "../types";

/**
 * Family Chat -- the feature without which this app is a museum.
 *
 * ideas.md is unambiguous: the competitor is not Ancestry, it is the family
 * WhatsApp group, and it wins on daily habit while losing badly on permanence.
 * The strategy is to match it on talking and beat it on keeping. So this screen
 * is an ordinary, comfortable chat with two things WhatsApp cannot do:
 *
 *   1. Voice notes are transcribed, so an elder's speech becomes searchable text
 *      instead of an audio file nobody will ever scrub through again.
 *   2. Any message can be PROMOTED into a permanent heirloom Deed, which is how
 *      the archive gets fed by ordinary conversation rather than by a wizard.
 *
 * Threads are scoped: "Nana's Care" is a real sub-circle, not a label, because a
 * relative's blood pressure does not belong in the group everyone reads.
 */
export function ChatScreen({
  onOpenProfile, initialThreadId, composeRequestId,
}: {
  onOpenProfile: () => void;
  initialThreadId?: string;
  /** Changes for every explicit Quick Share tap, even when Chat is already mounted. */
  composeRequestId?: number;
}) {
  const store = useStore();
  const { visibleThreads, messagesForThread, actions, currentUser } = store;
  const insets = useSafeAreaInsets();

  const threads = visibleThreads();
  /**
   * No hardcoded default id.
   *
   * This used to fall back to the literal "t_all", which only exists in the seeded
   * Miller family -- so a new circle selected a thread that was not there. `null` is
   * the honest value, and the empty state below handles it.
   */
  const [threadId, setThreadId] = React.useState<string | null>(initialThreadId ?? threads[0]?.id ?? null);
  const composerRef = React.useRef<TextInput>(null);
  const [draft, setDraft] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [pendingPhoto, setPendingPhoto] = React.useState<{ uri: string; mimeType: string } | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<unknown>(null);

  const thread = threads.find((t) => t.id === threadId) ?? threads[0];
  // Keep the same array while the composer draft changes, so typing cannot invalidate
  // every visible message cell.
  const messages = React.useMemo(
    () => messagesForThread(thread?.id ?? ""),
    [messagesForThread, thread?.id],
  );
  const messageListRef = React.useRef<FlatList<Message>>(null);

  React.useEffect(() => {
    if (initialThreadId && threads.some((t) => t.id === initialThreadId)) setThreadId(initialThreadId);
  }, [initialThreadId, threads]);

  // Run after the tab has actually taken focus. A plain mount effect fires during the
  // navigation transition and iOS/web can return focus to the screen container afterward.
  useFocusEffect(React.useCallback(() => {
    if (!composeRequestId) return undefined;
    const timer = setTimeout(() => composerRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, [composeRequestId, thread?.id]));

  const pickPhoto = async () => {
    setSendError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSendError(new Error("Photo access is off. Allow photo access in your phone settings, then try again."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) {
      setPendingPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" });
    }
  };

  const sendVoice = async (voice: RecordedVoice) => {
    if (!thread || sending) return;
    setSending(true); setSendError(null);
    try {
      const uploaded = await actions.uploadMedia(voice.uri, voice.mimeType, voice.durationSec);
      await actions.sendMessage(thread.id, { audioMediaId: uploaded.id });
    } catch (err) {
      setSendError(err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !pendingPhoto) || !thread || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSending(true);
    setSendError(null);
    try {
      const uploaded = pendingPhoto
        ? await actions.uploadMedia(pendingPhoto.uri, pendingPhoto.mimeType)
        : undefined;
      await actions.sendMessage(thread.id, {
        body: body || undefined,
        mediaIds: uploaded ? [uploaded.id] : undefined,
      });
      // Clear only after the server accepts it. A failed Quick Share must leave both the
      // words and photograph exactly where the person put them.
      setDraft("");
      setPendingPhoto(null);
      Keyboard.dismiss();
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  };

  /**
   * No thread at all: a brand-new circle.
   *
   * A Chat tab with no room to talk in reads as broken rather than as new, so this
   * offers to make the one room every family needs. It is a single tap, not a form --
   * naming a thread is not a decision anybody wants on their first visit.
   */
  if (!thread) {
    return (
      <View style={styles.root}>
        <AppHeader section="Family Chat" onPressProfile={onOpenProfile} />
        <Screen insetTop={false}>
          <EmptyState
            icon="chat"
            title="No conversations yet"
            body={
              "Chat is where the ordinary days go -- a photo of the dog, a question about " +
              "Sunday. It is the part of the app the family will open most, and anything " +
              "said here can be kept forever later."
            }
            actionLabel={creating ? "Creating..." : "Start the family conversation"}
            onAction={async () => {
              if (creating) return;
              setCreating(true);
              const id = await actions.createThread({ title: "All Family", kind: "general" });
              if (id) setThreadId(id);
              setCreating(false);
            }}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader section="Family Chat" onPressProfile={onOpenProfile} />

      {/* Thread switcher. Each pill names its audience, so you always know who
          you are about to speak to before you say anything. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.threadBar}
        style={styles.threadScroller}
      >
        {threads.map((t) => (
          <ThreadPill
            key={t.id}
            thread={t}
            count={messagesForThread(t.id).length}
            selected={t.id === thread?.id}
            onPress={() => setThreadId(t.id)}
          />
        ))}
      </ScrollView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={messageListRef}
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} mine={item.authorId === currentUser.personId} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={(
            <View style={styles.messageHeader}>
              <View style={styles.dayDivider}>
                <Chip
                  label={"Today · " + new Date().toLocaleDateString(undefined, {
                    weekday: "long", month: "short", day: "numeric",
                  })}
                />
              </View>
              {thread.audience !== "everyone" ? (
                <PrivacyBadge audience={thread.audience} tone="strong" />
              ) : null}
            </View>
          )}
          ListEmptyComponent={<EmptyThread />}
          ListFooterComponent={messages.some((m) => m.audio && !m.promotedToDeedId)
            ? <View style={styles.messageFooter}><PromotePrompt messages={messages} /></View>
            : null}
        />

        <Composer
          key={composeRequestId ?? "standard-composer"}
          autoFocus={!!composeRequestId}
          draft={draft}
          onChange={setDraft}
          onSend={send}
          onPickPhoto={() => void pickPhoto()}
          pendingPhoto={pendingPhoto}
          onRemovePhoto={() => setPendingPhoto(null)}
          sending={sending}
          error={sendError}
          inputRef={composerRef}
          onSendVoice={sendVoice}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Each thread kind gets a glyph, so the audience is recognisable pre-reading. */
const THREAD_ICON: Record<Thread["kind"], IconName> = {
  care: "care",
  planning: "sparkle",
  general: "people",
};

function ThreadPill({
  thread, count, selected, onPress,
}: { thread: Thread; count: number; selected: boolean; onPress: () => void }) {
  const fg = selected ? colors.onPrimary : colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={thread.title + ", " + count + " messages"}
      hitSlop={8}
      style={({ pressed }) => [
        styles.threadPill,
        selected ? styles.threadPillOn : styles.threadPillOff,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Icon name={THREAD_ICON[thread.kind] ?? "people"} size={15} color={fg} />
      <AppText variant="labelSm" color={fg}>{thread.title}</AppText>
      {/* The count sits in its own subtle counter rather than in parentheses --
          "(14)" reads as part of the thread's name, a badge reads as a quantity. */}
      <View style={[styles.threadCount, selected && styles.threadCountOn]}>
        <AppText variant="micro" color={fg}>{count}</AppText>
      </View>
    </Pressable>
  );
}

function EmptyThread() {
  return (
    <Card tone="low" style={styles.empty}>
      <AppText variant="subtitle">Nothing here yet</AppText>
      <AppText variant="body">
        Say hello, or hold the microphone and just talk. A voice note is the easiest
        way in for anyone who would rather not type.
      </AppText>
    </Card>
  );
}

/**
 * One message.
 *
 * A voice note is given far more room than a text bubble on purpose: it is a
 * primary source. The transcript sits under it as a quotation, and the reaction
 * row and read receipts stay small and warm underneath.
 */
const MessageBubble = React.memo(function MessageBubble({
  message, mine,
}: { message: Message; mine: boolean }) {
  const { personById, dispatch, people } = useStore();
  const author = personById(message.authorId);
  const time = new Date(message.createdAt)
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });

  const seen = message.seenBy ?? [];
  const reactions = Object.entries(message.reactions ?? {}).filter(([, ids]) => ids.length);

  const isVoice = !!message.audio;
  // A photo message from someone else renders on the dark forest surface, which
  // is how the mockups let a photograph sit on the page without competing.
  const dark = !isVoice && !!message.photos?.length && !mine;

  return (
    <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
      <View style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
        {!mine ? <Avatar person={author} size={26} /> : null}
        <AppText variant="labelSm" bold>{mine ? "You" : message.authorName}</AppText>
        <AppText variant="micro">{time}</AppText>
        {message.contextLabel && isVoice ? (
          <Chip label={message.contextLabel} />
        ) : null}
      </View>

      <Card
        tone={isVoice ? "container" : dark ? "forest" : mine ? "low" : "paper"}
        padded={!isVoice}
        style={styles.bubble}
      >
        {isVoice && message.audio ? (
          <VoiceNote audio={message.audio} transcript={message.transcript} />
        ) : (
          <View style={styles.textBody}>
            {message.photos?.length ? (
              <View style={styles.msgPhotoWrap}>
                <Image
                  source={{ uri: message.photos[0].uri }}
                  style={styles.msgPhoto}
                  accessibilityLabel="Shared photo"
                />
                {message.contextLabel ? (
                  <View style={styles.msgPhotoTag}>
                    <AppText variant="micro" color={colors.inverseOnSurface}>
                      {message.contextLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : null}

            {message.body ? (
              <AppText
                variant="body"
                color={dark ? colors.inverseOnSurface : colors.onSurface}
              >
                {message.body}
              </AppText>
            ) : null}
          </View>
        )}
      </Card>

      <View style={[styles.bubbleFooter, mine && styles.bubbleMetaMine]}>
        {/*
          Message reactions are stored as a string key per reaction. Those keys are
          now WORDS ("love", "smile") rather than emoji characters, and each renders
          as a vector glyph -- so a reaction pill matches the rest of the app's
          iconography instead of importing the OS emoji font's house style.
        */}
        {reactions.map(([key, ids]) => (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              dispatch({ type: "reactToMessage", messageId: message.id, emoji: key });
            }}
            accessibilityRole="button"
            accessibilityLabel={ids.length + " reacted with " + key + ". Tap to add yours."}
            hitSlop={10}
            style={styles.reaction}
          >
            <Icon
              name={reactionIcon(key)}
              size={15}
              color={colors.secondary}
              filled
            />
            <AppText variant="mono" color={colors.onSurfaceVariant}>{ids.length}</AppText>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            dispatch({ type: "reactToMessage", messageId: message.id, emoji: "love" });
          }}
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
          hitSlop={10}
          style={styles.reaction}
        >
          <Icon name="reaction" size={16} color={colors.onSurfaceFaint} />
          <Icon name="add" size={11} color={colors.onSurfaceFaint} strokeWidth={2.6} />
        </Pressable>

        {message.promotedToDeedId ? (
          <Chip label="In the archive" tone="mint" icon="archive" />
        ) : null}
      </View>

      {/*
        Read receipts, softly. "Grandad saw this" is genuinely reassuring for a
        family spread across time zones -- but it is phrased as warmth, never as
        pressure, and never as a per-person surveillance grid.
      */}
      {seen.length > 1 ? (
        <View style={[styles.seenRow, mine && styles.bubbleMetaMine]}>
          {/* A real double-tick glyph rather than two tick characters, which set
              at a different weight and baseline on every platform. */}
          <Icon name="checkAll" size={14} color={colors.primary} strokeWidth={2.4} />
          <AppText variant="micro">
          {seen.length >= people.length - 1
            ? "Seen by everyone"
            : seen
                .slice(0, 2)
                .map((id) => {
                  const n = personById(id)?.name;
                  return n ? shortName(n) : undefined;
                })
                .filter(Boolean)
                .join(", ") +
              (seen.length > 2 ? ", & " + (seen.length - 2) + " others listened" : " listened")}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

/**
 * Reaction key -> glyph.
 *
 * Message reactions are free-form strings in the store, so this maps the ones the
 * app actually sends and falls back to a neutral face for anything unrecognised --
 * a missing icon must never crash a message bubble.
 */
function reactionIcon(key: string): IconName {
  const map: Record<string, IconName> = {
    love: "love",
    heart: "heart",
    applaud: "applaud",
    inspire: "inspire",
    cherish: "cherish",
    smile: "reaction",
    celebrate: "celebrate",
  };
  return map[key] ?? "reaction";
}

/**
 * "Promote to Heirloom Deed?"
 *
 * The single most important interaction in the whole product: it is the moment a
 * throwaway Tuesday becomes part of the permanent archive. It appears in context,
 * suggests exactly what it noticed, and takes one tap.
 *
 * Note what it does NOT do: it never promotes anything automatically, and it
 * never writes the story for anyone. A human always approves what enters the
 * archive, because a fabricated family history is worse than none at all.
 */
function PromotePrompt({ messages }: { messages: Message[] }) {
  const { actions } = useStore();
  const candidate = messages.find((m) => m.audio && !m.promotedToDeedId);
  const [dismissed, setDismissed] = React.useState(false);

  if (!candidate || dismissed) return null;

  /**
   * Keep the recording itself, in the Voice Vault.
   *
   * Cheaper than promoting to a deed and usually the truer choice: nothing has to be framed
   * as a story, dated, or attributed to an event -- the recording is the artefact. Idempotent
   * server-side, so a double tap cannot shelve it twice.
   */
  const keepVoice = () => {
    if (!candidate.audio) return;
    void actions.keepVoice({
      mediaId: candidate.audio.id,
      // The speaker is resolved from the message author server-side; passing the name keeps
      // the vault entry correct even if the person row is later removed.
      speakerName: candidate.authorName,
      title: candidate.authorName + ", " +
        new Date(candidate.createdAt).toLocaleDateString("en-GB", {
          month: "long", year: "numeric",
        }),
      whenText: new Date(candidate.createdAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      }),
      fromMessageId: candidate.id,
    });
    setDismissed(true);
  };

  const promote = () => {
    /**
     * Promoted as a MEMORY, not a great deed.
     *
     * A voice note about Tuesday's scones is not an achievement, and filing it as one is
     * how the archive turned into a highlight reel. "memory" is the honest register and
     * gives it Cherish/Love/Laugh rather than inviting the family to applaud a chat
     * message. The author can change the kind afterwards if it really was a great deed.
     *
     * This now goes through the API, so the promotion actually persists -- it was a
     * local-only dispatch before, which meant the archive forgot it on reload.
     */
    void actions.addDeed({
      kind: "memory",
      title: candidate.authorName + "'s voice, " +
        new Date(candidate.createdAt).toLocaleDateString("en-GB", {
          month: "long", year: "numeric",
        }),
      whenText: new Date(candidate.createdAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      }),
      whenDate: candidate.createdAt.slice(0, 10),
      // The transcript is a starting point the family can edit -- never the finished
      // article, and never presented as their written words.
      story: candidate.transcript ?? candidate.body ?? "",
      personIds: [candidate.authorId],
      mediaIds: candidate.audio ? [candidate.audio.id] : [],
      audience: "everyone",
      fromMessageId: candidate.id,
    });
  };

  return (
    <Card tone="mint" style={styles.promote} feature>
      <View style={styles.promoteRow}>
        <IconBadge name="promote" size={44} tone="primary" />
        <View style={styles.promoteText}>
          <AppText variant="label">Keep this forever?</AppText>
          <AppText variant="small" color={colors.onPrimaryFixedVariant}>
            {candidate.authorName}'s voice will scroll away from here. The archive keeps it
            findable.
          </AppText>
        </View>
      </View>

      {/*
        The two choices are a real pair of buttons on one row, rather than a solid
        "Add" beside a 12px caps "NOT NOW" that read as a disabled label. Declining
        has to look like an available option -- otherwise the prompt is a nag.
      */}
      <View style={styles.promoteActions}>
        <Button
          title="Not now"
          kind="quiet"
          onPress={() => setDismissed(true)}
          accessibilityLabel="Not now. Hide this suggestion."
          fill
        />
        {/*
          TWO destinations, because they mean different things.

          "Keep the voice" puts the recording in the Voice Vault: the audio itself is the
          heirloom, and ideas.md is explicit that a voice note IS a primary source. "Add to
          journal" turns it into a dated memory in the archive timeline.

          Offering only the second is what let recordings keep scrolling away -- a family had
          to decide the note was a *story* before anything preserved it, when often the point
          is simply that this is how she sounded.
        */}
        <Button
          title="Keep the voice"
          kind="secondary"
          icon="voice"
          onPress={keepVoice}
          fill
        />
      </View>

      <Button
        title="Or add it to the journal as a memory"
        kind="quiet"
        icon="bookmark"
        small
        onPress={promote}
      />
    </Card>
  );
}

/**
 * The composer.
 *
 * The hold-to-talk bar is bigger than the text field and carries its own plain
 * instruction ("Grandparents: just hold down and talk naturally"). That is a
 * deliberate inversion of every other chat app: here, the least tech-confident
 * member's input method is the most prominent one on screen.
 */
function Composer({
  autoFocus, draft, onChange, onSend, onPickPhoto, pendingPhoto, onRemovePhoto, sending, error, inputRef,
  onSendVoice, bottomInset,
}: {
  autoFocus: boolean;
  draft: string;
  onChange: (s: string) => void;
  onSend: () => Promise<void>;
  onPickPhoto: () => void;
  pendingPhoto: { uri: string; mimeType: string } | null;
  onRemovePhoto: () => void;
  sending: boolean;
  error: unknown;
  inputRef: React.RefObject<TextInput | null>;
  onSendVoice: (voice: RecordedVoice) => Promise<void>;
  bottomInset: number;
}) {
  const [typing, setTyping] = React.useState(false);
  const textMode = typing || draft.trim().length > 0 || !!pendingPhoto;
  const canSend = !sending && (draft.trim().length > 0 || !!pendingPhoto);

  return (
    <View style={[styles.composer, { paddingBottom: Math.max(spacing.sm, bottomInset) }]}>
      <SaveError
        error={error}
        title="We could not send this. Your message and photo are still here."
      />
      {pendingPhoto ? (
        <View style={styles.pendingPhotoRow}>
          <Image source={{ uri: pendingPhoto.uri }} style={styles.pendingPhoto} accessibilityLabel="Photo ready to share" />
          <View style={styles.pendingPhotoCopy}>
            <AppText variant="labelSm">Photo ready to share</AppText>
            <AppText variant="small" color={colors.onSurfaceVariant}>Add a note, or send it as it is.</AppText>
          </View>
          <Pressable
            onPress={onRemovePhoto}
            accessibilityRole="button"
            accessibilityLabel="Remove selected photo"
            hitSlop={8}
            style={({ pressed }) => [styles.removePhoto, pressed && { opacity: 0.7 }]}
          >
            <Icon name="close" size={18} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          onPress={onPickPhoto}
          disabled={sending}
          hitSlop={6}
          style={({ pressed }) => [styles.composerIcon, pressed && { opacity: 0.7 }]}
        >
          <Icon name="camera" size={21} color={colors.primary} />
        </Pressable>

        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          value={draft}
          onChangeText={onChange}
          editable={!sending}
          placeholder={sending ? "Sending…" : "Write to the family…"}
          placeholderTextColor={colors.outline}
          style={styles.input}
          multiline
          accessibilityLabel="Message the family"
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          // The keyboard itself now has a labelled Send key. It sends and closes,
          // instead of inserting an unexplained newline while the large helper panel
          // continues to crowd the conversation.
          returnKeyType="send"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => { void onSend(); }}
        />

        <Pressable
          onPress={() => void onSend()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sending ? "Sending message" : "Send message"}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendDisabled,
            pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
          ]}
        >
          <Icon
            name="send"
            size={19}
            color={canSend ? colors.onPrimary : colors.onSurfaceFaint}
          />
        </Pressable>
      </View>

      {!textMode ? (
        <VoiceRecorder
          prompt="Record a voice note"
          disabled={sending}
          onUse={onSendVoice}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  /**
   * The horizontal thread ScrollView needs BOTH of these. Without `alignItems`
   * the pills stretch to the scroller's full height and render as giant
   * lozenges; without `flexGrow: 0` on the scroller itself (below) that height
   * is the entire remaining screen.
   */
  threadBar: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
    alignItems: "center",
  },
  threadScroller: { flexGrow: 0, flexShrink: 0 },
  threadPill: {
    height: 40, flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    paddingHorizontal: spacing.md - 2, borderRadius: radii.pill,
  },
  threadPillOn: { backgroundColor: colors.primary, ...shadow.primaryGlow },
  threadPillOff: { backgroundColor: colors.surfaceContainer },
  threadCount: {
    minWidth: 20, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceHighest,
  },
  threadCountOn: { backgroundColor: "rgba(255,255,255,0.2)" },

  messages: { padding: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  messageHeader: { gap: spacing.md, marginBottom: spacing.md },
  messageFooter: { marginTop: spacing.md },
  dayDivider: { alignItems: "center" },

  empty: { gap: spacing.sm },

  bubbleWrap: { gap: spacing.xs },
  bubbleWrapMine: { alignItems: "flex-end" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  bubbleMetaMine: { justifyContent: "flex-end" },
  bubble: { width: "100%" },
  textBody: { gap: spacing.sm },
  msgPhotoWrap: { position: "relative" },
  msgPhoto: {
    width: "100%", height: 200, borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
  },
  msgPhotoTag: {
    position: "absolute", left: spacing.sm + 2, bottom: spacing.sm + 2,
    backgroundColor: "rgba(28, 25, 23, 0.62)",
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  bubbleFooter: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm - 2, flexWrap: "wrap",
  },
  reaction: {
    minHeight: 32, flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: spacing.sm + 2, borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
  },
  seenRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },

  promote: { gap: spacing.md - 2 },
  promoteRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  promoteText: { flex: 1, gap: 2, minWidth: 0 },
  promoteActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  /**
   * The composer floats on an upward shadow rather than being fenced off by a top
   * border, matching the tab bar and every other edge in the refresh.
   */
  composer: {
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: spacing.sm + 4, paddingTop: spacing.sm + 2,
    gap: spacing.sm + 2,
    ...shadow.floating,
  },
  pendingPhotoRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.inner,
    padding: spacing.sm,
  },
  pendingPhoto: { width: 52, height: 52, borderRadius: radii.inner },
  pendingPhotoCopy: { flex: 1, minWidth: 0, gap: 1 },
  removePhoto: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2,
    alignItems: "center", justifyContent: "center",
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  composerIcon: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center", justifyContent: "center",
  },
  /**
   * The field is a filled capsule with no border. A 1.5px outline plus a fill is
   * belt-and-braces: the tonal difference from the composer's white already reads
   * as an input, and dropping the outline is what makes the row look current.
   */
  input: {
    flex: 1, minHeight: INPUT_MIN, maxHeight: 120,
    borderRadius: radii.sheet,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md - 3,
    fontSize: type.bodyMd.fontSize, lineHeight: 22,
    fontFamily: fonts.sans, color: colors.onSurface,
  },
  sendButton: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: TOUCH_MIN / 2,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadow.primaryGlow,
  },
  sendDisabled: { backgroundColor: colors.surfaceHighest, shadowOpacity: 0, elevation: 0 },

  holdBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.md - 2,
    minHeight: 64, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm,
    borderRadius: radii.pill, backgroundColor: colors.secondaryFixed,
  },
  holdBarActive: { backgroundColor: colors.secondaryFixedDim },
  holdIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceLowest,
    alignItems: "center", justifyContent: "center",
  },
  holdLabels: { flex: 1, gap: 1, minWidth: 0 },
});
