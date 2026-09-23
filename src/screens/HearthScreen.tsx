import React from "react";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";
import { Card } from "../components/Card";
import { AppText } from "../components/Text";
import { Chip } from "../components/Chip";
import { Button } from "../components/Button";
import { Avatar, AvatarStack } from "../components/Avatar";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { SectionHeader } from "../components/SectionHeader";
import { DeedCard } from "../components/DeedCard";
import { colors, radii, shadow, spacing } from "../theme";
import { givenName, shortName } from "../names";
import { useStore } from "../store";
import { useReducedMotion } from "../useReducedMotion";
import type { Deed, FamilyEvent, Message, Person } from "../types";

/**
 * Warm verbs for a one-tap ping.
 *
 * These used to come from a fixed list in mockData that named specific Millers, which
 * meant a brand-new family saw strangers on their own Hearth. The verbs are UI copy, so
 * they live here; WHO is offered is derived from the real family below.
 */
const NUDGE_ACTIONS = ["Send Tea", "Cheer", "Sunshine", "High-Five", "Thinking of You"];

/**
 * The Hearth -- the screen that has to earn the daily open.
 *
 * The product's central risk (ideas.md) is that a family archive gets visited on
 * holidays and forgotten in between. So this screen is deliberately NOT a
 * chronological archive feed. Top to bottom it answers, in order:
 *
 *   1. "What is today?"          -- greeting + who is about
 *   2. "How do I add something?" -- the two speeds, side by side
 *   3. "Who needs a thought?"    -- one-tap pings, zero composition cost
 *   4. "What must I not miss?"   -- heirloom radar and care state
 *   5. "What did I miss?"        -- today's quick shares
 *   6. "What is worth keeping?"  -- On This Day, resurfaced honestly
 *
 * Utility sits ABOVE memory on this screen. That ordering is the whole strategy:
 * the app people actually open is the app they will trust with their history.
 */
export function HearthScreen({
  onOpenDeed, onAddDeed, onOpenJournal, onQuickShare, onOpenChat, onOpenCare, onOpenPerson, onOpenProfile,
}: {
  onOpenDeed: (deedId: string) => void;
  onAddDeed: () => void;
  /** The permanent chronological home of every memory and great deed. */
  onOpenJournal: () => void;
  onQuickShare: () => void;
  onOpenChat: (threadId?: string) => void;
  onOpenCare: () => void;
  onOpenPerson: (personId: string) => void;
  onOpenProfile: () => void;
}) {
  const store = useStore();
  const { width, fontScale } = useWindowDimensions();
  const compactLayout = width < 360 || fontScale >= 1.3;
  const expandedLayout = width >= 700;
  const { currentUser, personById, upcomingEvents, onThisDay, careCircles, careProgress } = store;

  // Greeting addresses you directly, so the honorific would read as stiff.
  const firstName = givenName(currentUser.name);
  const radar = upcomingEvents(45).filter((x) => x.daysAway > 0)[0];
  const memory = onThisDay()[0];
  const circle = careCircles[0];
  const quickShare = [...store.messages]
    .filter((m) => m.photos?.length)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const sortedStories = [...store.deeds]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const leadStory = sortedStories[0];
  const moreStories = sortedStories.slice(1, 3);
  const careState = circle ? careProgress(circle.id) : undefined;
  const careOutstanding = careState ? careState.total - careState.done : 0;
  const quickShareIsRecent = quickShare
    ? Date.now() - new Date(quickShare.createdAt).getTime() < 7 * 86400000
    : false;

  /**
   * A circle nobody has filled in yet.
   *
   * "Just me, and nothing recorded" is the state of every family on the day they join,
   * and it is the only state where the Hearth cannot do its usual job of showing what
   * is happening today -- because nothing is. So it shows what to do first instead.
   */
  const relatives = store.people.filter((p) => p.id !== currentUser.personId);
  // A family graph can contain ancestors who never had accounts. Activation means another
  // real person joined the app, not merely that a profile or story exists.
  const needsCircleActivation = store.members.length <= 1;

  return (
    <View style={styles.root}>
      <AppHeader section="Hearth" onPressProfile={onOpenProfile} onPressMic={onQuickShare} />

      <Screen insetTop={false} contentStyle={expandedLayout && styles.expandedContent}>
        <Greeting
          name={firstName}
          relativeCount={relatives.length}
          storyCount={store.deeds.length}
        />

        {needsCircleActivation ? (
          <CircleActivation
            hasStory={store.deeds.length > 0}
            onAddStory={onAddDeed}
            onInvite={onOpenProfile}
          />
        ) : null}

        {/* "What needs me today?" outranks archival recency. Open care and an approaching
            family date are the only modules allowed above contribution. */}
        {circle && careState && careOutstanding > 0 ? (
          <CareGlance
            personName={personById(circle.personId)?.name ?? "your relative"}
            progress={careState}
            onOpenCare={onOpenCare}
          />
        ) : null}

        {radar ? <HeirloomRadar entry={radar} onOpenPerson={onOpenPerson} /> : null}

        <TwoSpeeds onQuickShare={onQuickShare} onAddDeed={onAddDeed} stacked={compactLayout} />

        <FamilyJournalFeed
          count={store.deeds.length}
          entries={leadStory ? [leadStory] : []}
          onOpenJournal={onOpenJournal}
          onOpenDeed={onOpenDeed}
        />

        <ThinkingOfYou compact={compactLayout} />

        {quickShare && quickShareIsRecent ? (
          <QuickShareCard message={quickShare} onOpenChat={() => onOpenChat(quickShare.threadId)} />
        ) : null}

        {/* Covered care is reassurance, not urgency; it belongs after connection. */}
        {circle && careState && careOutstanding === 0 ? (
          <CareGlance
            personName={personById(circle.personId)?.name ?? "your relative"}
            progress={careState}
            onOpenCare={onOpenCare}
          />
        ) : null}

        <MoreStories
          entries={moreStories}
          onOpenJournal={onOpenJournal}
          onOpenDeed={onOpenDeed}
        />

        {memory && memory.id !== leadStory?.id && !moreStories.some((d) => d.id === memory.id) ? (
          <OnThisDay
            deedId={memory.id}
            title={memory.title}
            whenText={memory.whenText}
            story={memory.story}
            photoUri={memory.media.find((m) => m.kind === "photo")?.uri}
            onOpenDeed={onOpenDeed}
          />
        ) : null}
      </Screen>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * A truthful welcome. Date and time-of-day come from the device; every other sentence is
 * derived from family data we actually hold. Hearth never pretends to know weather,
 * presence, mood, or activity.
 */
function Greeting({
  name, relativeCount, storyCount,
}: { name: string; relativeCount: number; storyCount: number }) {
  const now = new Date();
  const dateText = now
    .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    .replace(",", "");
  const hour = now.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  const status = relativeCount === 0
    ? "Your family space is ready. Invite someone to share it with."
    : storyCount === 0
      ? `${relativeCount === 1 ? "One relative is" : `${relativeCount} relatives are`} here. Preserve the first family story together.`
      : `${storyCount === 1 ? "One story is" : `${storyCount} stories are`} safe in your Family Journal.`;

  return (
    <View style={styles.greeting}>
      <AppText variant="micro" color={colors.secondary}>{dateText}</AppText>
      <AppText variant="hero">Good {partOfDay}, {name}</AppText>
      <AppText variant="body" color={colors.onSurfaceVariant}>{status}</AppText>
    </View>
  );
}

/**
 * Circle activation is not content activation.
 *
 * This remains until a second ACCOUNT joins. Adding an ancestor to the tree or preserving
 * one story must not dismiss it: a family app with one account is still a private diary.
 * The next meaningful action is always the invitation, with one low-pressure alternative
 * only while the journal is empty.
 */
function CircleActivation({
  hasStory, onAddStory, onInvite,
}: {
  hasStory: boolean;
  onAddStory: () => void;
  onInvite: () => void;
}) {
  return (
    <Card tone="alert" feature style={styles.firstSteps}>
      <View style={styles.activationHead}>
        <IconBadge name="people" size={40} tone="secondary" />
        <View style={styles.activationCopy}>
          <AppText variant="subtitle">
            {hasStory ? "Your first story needs a reader" : "Make this a family space"}
          </AppText>
          <AppText variant="body" color={colors.onSecondaryFixedVariant}>
            {hasStory
              ? "It is safe in your Journal. Invite one person so you can remember it together."
              : "Invite one person you trust. A family circle becomes useful the moment it is shared."}
          </AppText>
        </View>
      </View>
      <Button
        title="Invite a family member"
        icon="people"
        kind="secondary"
        onPress={onInvite}
        style={styles.firstStepsAction}
      />
      {!hasStory ? (
        <Button title="Or preserve the first story" kind="quiet" icon="journal" onPress={onAddStory} />
      ) : null}
    </Card>
  );
}

/**
 * The visible, useful address of saved memories.
 *
 * A title-only preview still made the Hearth an index: the person had to open the row
 * before receiving any of the story. The home treatment now takes the useful cue from a
 * social feed -- photo, excerpt, reactions and comment affordance are present here --
 * while "View all" keeps the complete, chronological Family Journal one tap away.
 */
function FamilyJournalFeed({
  count, entries, onOpenJournal, onOpenDeed,
}: {
  count: number;
  entries: Deed[];
  onOpenJournal: () => void;
  onOpenDeed: (id: string) => void;
}) {
  return (
    <View style={styles.journalFeed}>
      <SectionHeader
        title="Family Journal"
        icon="journal"
        actionLabel="View Journal"
        onAction={onOpenJournal}
      />
      {entries.length > 0 ? (
        entries.map((entry) => (
          <DeedCard
            key={entry.id}
            deed={entry}
            variant="hearth"
            onPress={() => onOpenDeed(entry.id)}
          />
        ))
      ) : (
        <Card tone="paper">
          <AppText variant="small" color={colors.onSurfaceVariant}>
            Memories and great deeds you preserve will appear here, newest first.
          </AppText>
        </Card>
      )}
    </View>
  );
}

/** Additional recent stories are compact continuation rows, not more detail screens. */
function MoreStories({
  entries, onOpenJournal, onOpenDeed,
}: {
  entries: Deed[];
  onOpenJournal: () => void;
  onOpenDeed: (id: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.moreStories}>
      <SectionHeader title="More from the Journal" actionLabel="View Family Journal" onAction={onOpenJournal} />
      <Card padded={false}>
        {entries.map((entry, index) => (
          <Pressable
            key={entry.id}
            onPress={() => onOpenDeed(entry.id)}
            accessibilityRole="button"
            accessibilityLabel={"Open story: " + entry.title}
            style={({ pressed }) => [
              styles.moreStoryRow,
              index > 0 && styles.moreStoryDivider,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.moreStoryCopy}>
              <AppText variant="label" numberOfLines={2}>{entry.title}</AppText>
              <AppText variant="small" color={colors.onSurfaceVariant} numberOfLines={1}>
                {entry.authorName} · {entry.whenText}
              </AppText>
            </View>
            <Icon name="chevronRight" size={17} color={colors.onSurfaceFaint} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

/**
 * The two speeds of family memory, presented as a genuine fork rather than a
 * primary button with a hidden alternative.
 *
 * This is the core insight of the product made literal: the 4-step Deed wizard is
 * right for "Grandpa built a cabin in 1978" and completely wrong for "the dog did
 * something stupid". Forcing everything through the wizard is what turns a family
 * app into a museum, so Quick Share is given equal billing and put on the LEFT,
 * where the thumb lands first.
 */
function TwoSpeeds({
  onQuickShare, onAddDeed, stacked,
}: { onQuickShare: () => void; onAddDeed: () => void; stacked: boolean }) {
  /**
   * Laid out as two SIDE-BY-SIDE tiles rather than two stacked full-width rows.
   * Stacked rows imply a ranked list -- the top one is the real button and the
   * second is the afterthought -- which is exactly the hierarchy this section
   * exists to refuse. Side by side, the fork is visibly a fork.
   */
  return (
    <View style={[styles.speedRow, stacked && styles.speedStack]}>
      <SpeedButton
        icon="camera"
        title="Quick Share"
        subtitle="Photos or notes for today"
        onPress={onQuickShare}
        tone="quick"
      />
      <SpeedButton
        icon="deed"
        title="Add to Journal"
        subtitle="Memories, lore & great deeds"
        onPress={onAddDeed}
        tone="heirloom"
      />
    </View>
  );
}

function SpeedButton({
  icon, title, subtitle, onPress, tone,
}: {
  icon: IconName; title: string; subtitle: string; onPress: () => void;
  tone: "quick" | "heirloom";
}) {
  const heirloom = tone === "heirloom";
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title + ". " + subtitle}
      style={({ pressed }) => [
        styles.speedButton,
        heirloom ? styles.speedHeirloom : styles.speedQuick,
        pressed && (reduceMotion ? { opacity: 0.88 } : { transform: [{ scale: 0.97 }] }),
      ]}
    >
      <IconBadge
        name={icon}
        size={44}
        tone={heirloom ? "mint" : "secondarySoft"}
      />
      <View style={styles.speedLabels}>
        <AppText
          variant="label"
          color={heirloom ? colors.primaryFixed : colors.onSurface}
          numberOfLines={2}
        >
          {title}
        </AppText>
        <AppText
          variant="small"
          color={heirloom ? colors.primaryFixedDim : colors.onSurfaceVariant}
          numberOfLines={2}
        >
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * "Thinking of you." One tap sends a warm ping and nothing else.
 *
 * The zero-composition cost is the entire feature: a grandparent who would never
 * draft a message will happily tap a face. Once tapped the row confirms in place
 * and does not offer to send again, so it cannot become a nagging mechanic.
 */
function ThinkingOfYou({ compact }: { compact: boolean }) {
  const { personById, actions, sentNudges, people, currentUser } = useStore();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Who to offer, derived from the real family.
   *
   * Living people other than yourself, oldest first -- the elders are who this feature
   * exists for, and they are also who the family most often means to check on. Capped
   * at four so the row never wraps.
   */
  const nudgeTargets = React.useMemo(
    () =>
      people
        .filter((p) => p.isLiving && !p.memorialised && p.id !== currentUser.personId)
        .sort((a, b) => (a.birthDate ?? "9999").localeCompare(b.birthDate ?? "9999"))
        .slice(0, 4)
        .map((p, i) => ({ personId: p.id, action: NUDGE_ACTIONS[i % NUDGE_ACTIONS.length] })),
    [people, currentUser.personId],
  );

  /**
   * Nobody to ping yet. This is a family of one -- so instead of an empty row, point at
   * the thing that fixes it. An invitation is the only useful action here.
   */
  if (nudgeTargets.length === 0) return null;

  return (
    <Card style={styles.nudges}>
      <SectionHeader
        title="Thinking of You"
        compact
        icon="heart"
        action="One tap, nothing to write"
      />

      {error ? (
        <AppText variant="small" color={colors.error} accessibilityLiveRegion="assertive">
          {error}
        </AppText>
      ) : null}
      <View style={[styles.nudgeRow, compact && styles.nudgeGrid]}>
        {nudgeTargets.map((n) => {
          const person = personById(n.personId);
          // Bereavement mode: never prompt anyone to ping someone who has died.
          if (!person || person.memorialised) return null;

          const sent = sentNudges.includes(n.personId);

          return (
            <Pressable
              key={n.personId}
              onPress={async () => {
                if (sent || pendingId) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setError(null);
                setPendingId(n.personId);
                try {
                  await actions.sendNudge(n.personId, n.action);
                } catch {
                  setError("That warm ping did not send. Check your connection and try again.");
                } finally {
                  setPendingId(null);
                }
              }}
              disabled={sent || !!pendingId}
              accessibilityRole="button"
              accessibilityState={{ selected: sent }}
              accessibilityLabel={
                sent
                  ? "Already sent a warm ping to " + person.name
                  : n.action + " to " + person.name
              }
              style={({ pressed }) => [
                styles.nudge, compact && styles.nudgeWide, pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.nudgeFace}>
                <Avatar person={person} size={56} ring={sent} ringColor={colors.primary} />
                {/* A sent ping is confirmed by a tick badge ON the avatar rather
                    than by appending a tick character to the caption. The state
                    then reads at a glance across the whole row, and the caption
                    stays put instead of reflowing under the finger. */}
                {sent ? (
                  <View style={styles.nudgeSent}>
                    <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} />
                  </View>
                ) : null}
              </View>

              <AppText variant="labelSm" color={colors.onSurface} numberOfLines={1}>
                {shortName(person.name)}
              </AppText>
              {/* Sentence case, matching the name above it. A caps action label
                  under a sentence-case name made every tile read as two competing
                  labels rather than as one person. */}
              <AppText
                variant="labelSm"
                color={sent ? colors.primary : colors.secondary}
                numberOfLines={1}
                style={styles.nudgeAction}
              >
                {pendingId === n.personId ? "Sending…" : sent ? "Sent" : n.action}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/**
 * Heirloom radar. Awareness is not the point -- action is.
 *
 * "Nana turns 80 in 18 days" is only useful attached to the thing you should do
 * about it, and to the honest fact that four cousins have not done it yet. The
 * count is what converts a passive notification into a nudge.
 */
function HeirloomRadar({
  entry, onOpenPerson,
}: {
  entry: { event: FamilyEvent; daysAway: number };
  onOpenPerson: (id: string) => void;
}) {
  const { personById, people: familyMembers } = useStore();
  const { event, daysAway } = entry;
  // The people this milestone is ABOUT (distinct from the family as a whole below).
  const subjects = event.personIds.map(personById).filter(Boolean) as Person[];
  const subject = subjects[0];

  const dateLabel = new Date(event.date)
    .toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  return (
    <Card tone="alert" style={styles.radar} feature>
      <View style={styles.radarTop}>
        <IconBadge name="cake" size={44} tone="secondary" />
        <View style={styles.radarHead}>
          <AppText variant="micro" color={colors.onSecondaryFixedVariant}>
            Heirloom Radar
          </AppText>
          <AppText variant="subtitle" color={colors.onSecondaryFixed}>
            {event.title} in {daysAway} days
          </AppText>
        </View>
        <Chip label={dateLabel} tone="terracotta" icon="calendar" />
      </View>

      {event.note ? (
        <AppText variant="body" color={colors.onSecondaryFixedVariant}>
          {event.note}
        </AppText>
      ) : null}

      <View style={styles.radarFooter}>
        {/* Who has not contributed yet. Named softly, never shamed.
            AvatarStack draws the overlap with a ring in the card's own tone, so
            the faces read as separate people instead of smearing together. */}
        <AvatarStack
          // The people this milestone is about, then the rest of the family. Derived
          // from the tree rather than a fixed list, so it is never other people's faces.
          people={[
            ...subjects,
            ...familyMembers.filter((p) => p.isLiving && !event.personIds.includes(p.id)),
          ].slice(0, 4)}
          size={32}
          max={3}
          surface={colors.secondaryFixed}
        />

        <Button
          title="Sign Memory Card"
          icon="edit"
          kind="secondary"
          onPress={() => subject && onOpenPerson(subject.id)}
          style={styles.radarButton}
        />
      </View>
    </Card>
  );
}

/**
 * Care at a glance. Deliberately a summary and a door, not the whole hub:
 * a relative's medical detail does not belong on the family home screen, and the
 * care circle is a narrower audience than everyone reading this.
 */
function CareGlance({
  personName, progress, onOpenCare,
}: {
  personName: string;
  progress: { done: number; total: number };
  onOpenCare: () => void;
}) {
  const outstanding = progress.total - progress.done;

  const settled = outstanding === 0;
  const pct = progress.total ? progress.done / progress.total : 0;

  return (
    <Card
      onPress={onOpenCare}
      accessibilityLabel={
        "Care circle for " + personName + ". " + progress.done + " of " +
        progress.total + " done today. Open the care hub."
      }
      style={styles.careGlance}
    >
      <SectionHeader
        title={"Care Circle Routine"}
        compact
        icon="care"
        action={progress.done + "/" + progress.total + " done"}
      />
      <AppText variant="body" color={colors.onSurfaceVariant}>
        {settled
          ? "Everything for " + personName + " is covered today. Nothing is waiting on anyone."
          : outstanding + (outstanding === 1 ? " slot" : " slots") +
            " still need a person for " + personName + " today."}
      </AppText>

      {/* The bar turns forest once everything is covered and stays terracotta
          while a slot is open, so "is anyone waiting on me?" is answerable from
          the colour alone -- without reading the count. */}
      <View style={styles.careBar}>
        <View
          style={[
            styles.careBarFill,
            {
              width: (pct * 100 + "%") as `${number}%`,
              backgroundColor: settled ? colors.primary : colors.secondary,
            },
          ]}
        />
      </View>
    </Card>
  );
}

/**
 * Today's quick share, shown inline so the fast lane is visibly first-class.
 * If quick shares were only reachable through the Chat tab, the archive would
 * dominate the app's surface area and the "two speeds" idea would be a lie.
 */
function relativeTime(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] = abs < 60
    ? [seconds, "second"]
    : abs < 3600
      ? [Math.round(seconds / 60), "minute"]
      : abs < 86400
        ? [Math.round(seconds / 3600), "hour"]
        : [Math.round(seconds / 86400), "day"];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(value, unit);
}

function QuickShareCard({
  message, onOpenChat,
}: { message: Message; onOpenChat: () => void }) {
  const { personById } = useStore();
  const author = personById(message.authorId);
  const photos = message.photos ?? [];
  const reactionTotal = Object.values(message.reactions ?? {})
    .reduce((n, ids) => n + ids.length, 0);

  return (
    <Card
      padded={false}
      onPress={onOpenChat}
      accessibilityLabel={"Quick share from " + message.authorName + ". Open the family chat."}
    >
      <View style={styles.quickHead}>
        <Avatar person={author} size={40} />
        <View style={styles.quickWho}>
          <AppText variant="label">{message.authorName}</AppText>
          <AppText variant="small" color={colors.onSurfaceFaint}>
            {photos.length === 1 ? "Shared a photo" : `Shared ${photos.length} photos`} · {relativeTime(message.createdAt)}
          </AppText>
        </View>
        {message.contextLabel ? (
          // The message's OWN label. This used to render a single hardcoded fixture
          // string ("Today's Chuckle") on every quick share regardless of content.
          <Chip label={message.contextLabel} tone="amber" icon="sparkle" />
        ) : null}
      </View>

      {message.body ? (
        <AppText variant="body" style={styles.quickBody}>{message.body}</AppText>
      ) : null}

      {photos.length > 0 ? (
        <View style={styles.photoGrid}>
          <Image
            source={{ uri: photos[0].uri }}
            style={styles.photoMain}
            accessibilityLabel="Shared photo"
          />
        </View>
      ) : null}

      <View style={styles.quickFooter}>
        <Chip
          label={String(reactionTotal || 0) + " reactions"}
          tone="terracotta"
          icon="heart"
          iconFilled
        />
        {message.audio ? <Chip label="Voice memo" icon="voice" /> : null}
      </View>
    </Card>
  );
}

/**
 * On This Day. The cheapest engagement engine that exists, and one of the few
 * that fits this product honestly: the content is genuinely the family's own,
 * so resurfacing it is a gift rather than a manufactured hook.
 *
 * The photo leads and the chrome stays quiet -- the family's photographs are the
 * design here, and our job is to be a good frame.
 */
function OnThisDay({
  deedId, title, whenText, story, photoUri, onOpenDeed,
}: {
  deedId: string; title: string; whenText: string; story: string;
  photoUri?: string; onOpenDeed: (id: string) => void;
}) {
  const yearsAgo = (() => {
    const m = whenText.match(/(\d{4})/);
    if (!m) return null;
    const n = new Date().getFullYear() - Number(m[1]);
    return n > 0 ? n + (n === 1 ? " year ago" : " years ago") : null;
  })();

  return (
    <Card padded={false} feature>
      <View style={styles.otdHead}>
        <View style={styles.otdEyebrow}>
          <Icon name="clock" size={15} color={colors.secondary} />
          <AppText variant="micro" color={colors.secondary} numberOfLines={2}>
            On this day · {whenText}{yearsAgo ? " · " + yearsAgo : ""}
          </AppText>
        </View>
        <Chip label="Archive" tone="mint" icon="archive" />
      </View>

      <Pressable
        onPress={() => onOpenDeed(deedId)}
        accessibilityRole="button"
        accessibilityLabel={"Open the story: " + title}
        style={({ pressed }) => pressed && { opacity: 0.94 }}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.otdPhoto} accessibilityLabel={title} />
        ) : null}

        <View style={styles.otdBody}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="quote" numberOfLines={3} style={styles.otdStory}>
            {story}
          </AppText>
        </View>
      </Pressable>

    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  expandedContent: { width: "100%", maxWidth: 720, alignSelf: "center" },

  greeting: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  /** Two equal tiles. `alignItems: stretch` keeps them the same height. */
  speedRow: { flexDirection: "row", gap: spacing.sm + 2, alignItems: "stretch" },
  speedStack: { flexDirection: "column" },
  speedButton: {
    flex: 1, minWidth: 0,
    gap: spacing.sm + 2,
    padding: spacing.md, borderRadius: radii.card,
    minHeight: 132,
  },
  speedQuick: { backgroundColor: colors.surfaceLowest, ...shadow.card },
  speedHeirloom: { backgroundColor: colors.primary, ...shadow.primaryGlow },
  speedLabels: { gap: 2, minWidth: 0 },

  journalFeed: { gap: spacing.md },
  moreStories: { gap: spacing.sm },
  moreStoryRow: {
    minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  moreStoryDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  moreStoryCopy: { flex: 1, minWidth: 0, gap: 2 },

  nudges: { gap: spacing.md },
  firstSteps: { gap: spacing.md },
  firstStepsAction: { marginTop: spacing.xs },
  activationHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  activationCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  nudgeRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  nudgeGrid: { flexWrap: "wrap", justifyContent: "flex-start" },
  nudge:  { alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 },
  nudgeWide: { flexBasis: "47%", flexGrow: 1 },
  nudgeFace: { position: "relative" },
  nudgeAction: { fontSize: 13 },
  nudgeSent: {
    position: "absolute", right: -2, bottom: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surfaceLowest,
  },

  radar: { gap: spacing.md },
  radarTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2, flexWrap: "wrap" },
  radarHead: { flex: 1, gap: 2, minWidth: 0 },
  radarFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, flexWrap: "wrap",
  },
  radarButton: { flexShrink: 1 },

  careGlance: { gap: spacing.sm + 2 },
  careBar: {
    height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceHigh,
    overflow: "hidden", marginTop: spacing.xs,
  },
  careBarFill: { height: "100%", borderRadius: radii.pill },

  quickHead: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm + 2,
    padding: spacing.md + 2, paddingBottom: spacing.sm, flexWrap: "wrap",
  },
  quickWho: { flex: 1, gap: 1, minWidth: 0 },
  quickBody: { paddingHorizontal: spacing.md + 2, paddingBottom: spacing.sm + 2 },
  photoGrid: { paddingHorizontal: spacing.md + 2 },
  photoMain: {
    width: "100%", height: 210, borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
  },
  quickFooter: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md + 2, flexWrap: "wrap",
  },

  otdHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, padding: spacing.md + 2, paddingBottom: spacing.sm + 2,
  },
  otdEyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, flex: 1 },
  otdPhoto: { width: "100%", height: 220, backgroundColor: colors.surfaceContainer },
  otdBody: { padding: spacing.md + 2, gap: spacing.sm },
  otdStory: { color: colors.onSurfaceVariant },
});
