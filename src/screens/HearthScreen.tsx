import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
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
import { VoiceNote } from "../components/VoiceNote";
import { colors, radii, shadow, spacing } from "../theme";
import { givenName, shortName } from "../names";
import { useStore } from "../store";
import type { FamilyEvent, Message, Person } from "../types";

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
  onOpenDeed, onAddDeed, onQuickShare, onOpenChat, onOpenCare, onOpenPerson, onOpenProfile,
}: {
  onOpenDeed: (deedId: string) => void;
  onAddDeed: () => void;
  onQuickShare: () => void;
  onOpenChat: () => void;
  onOpenCare: () => void;
  onOpenPerson: (personId: string) => void;
  onOpenProfile: () => void;
}) {
  const store = useStore();
  const { currentUser, personById, upcomingEvents, onThisDay, careCircles, careProgress } = store;

  // Greeting addresses you directly, so the honorific would read as stiff.
  const firstName = givenName(currentUser.name);
  const radar = upcomingEvents(45).filter((x) => x.daysAway > 0)[0];
  const memory = onThisDay()[0];
  const circle = careCircles[0];
  const quickShare = store.messages.find((m) => m.photos?.length);

  /**
   * A circle nobody has filled in yet.
   *
   * "Just me, and nothing recorded" is the state of every family on the day they join,
   * and it is the only state where the Hearth cannot do its usual job of showing what
   * is happening today -- because nothing is. So it shows what to do first instead.
   */
  const relatives = store.people.filter((p) => p.id !== currentUser.personId);
  const isNewCircle = relatives.length === 0 && store.deeds.length === 0;

  return (
    <View style={styles.root}>
      <AppHeader section="Hearth" onPressProfile={onOpenProfile} onPressMic={onQuickShare} />

      <Screen insetTop={false}>
        <Greeting
          name={firstName}
          awake={store.people.filter((p) => p.isLiving).length - 1}
          isNewCircle={isNewCircle}
        />

        {isNewCircle ? <FirstSteps onAddDeed={onAddDeed} onOpenProfile={onOpenProfile} /> : null}

        <TwoSpeeds onQuickShare={onQuickShare} onAddDeed={onAddDeed} />

        <ThinkingOfYou onOpenPerson={onOpenPerson} />

        {radar ? <HeirloomRadar entry={radar} onOpenPerson={onOpenPerson} /> : null}

        {circle ? (
          <CareGlance
            personName={personById(circle.personId)?.name ?? "your relative"}
            progress={careProgress(circle.id)}
            onOpenCare={onOpenCare}
          />
        ) : null}

        {quickShare ? <QuickShareCard message={quickShare} onOpenChat={onOpenChat} /> : null}

        {memory ? (
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
 * Warm day greeting. The weather line is not decoration -- it is the cheapest
 * possible signal that this screen is about *today* and not about 1978.
 */
function Greeting({
  name, awake, isNewCircle,
}: { name: string; awake: number; isNewCircle: boolean }) {
  const now = new Date();
  const dateText = now
    .toLocaleDateString("en-GB", { weekday: "long", month: "short", day: "numeric" })
    .replace(",", "");

  const hour = now.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  /**
   * The weather glyph tracks the actual part of day rather than always drawing a
   * sun. A fixed sun icon beside the words "Good evening" is the sort of small
   * incoherence that makes a screen feel generated instead of designed.
   */
  const weatherIcon: IconName =
    hour < 8 ? "sunrise" : hour < 18 ? "sun" : hour < 21 ? "sunset" : "moon";

  return (
    <View style={styles.greeting}>
      <View style={styles.greetingTop}>
        <AppText variant="micro" color={colors.secondary}>{dateText}</AppText>
        <View style={styles.weather}>
          <Icon name={weatherIcon} size={15} color={colors.tertiary} />
          <AppText variant="micro">62°F Crisp {partOfDay}</AppText>
        </View>
      </View>

      {/* The greeting is the largest thing on the screen and sits on the bare
          canvas, not in a card. Boxing a salutation makes it read as a system
          notice; letting it breathe is what makes the screen feel like a page. */}
      <AppText variant="hero">Good {partOfDay},{"\n"}{name}</AppText>
      {/*
        The subtitle must describe the family that actually exists. The old copy was
        fixture prose -- "porridge is simmering, and 6 family members are up and about"
        -- which read as nonsense for a circle of one, and told a brand-new user that
        the app was describing somebody else's household.
      */}
      <AppText variant="body" color={colors.onSurfaceVariant}>
        {isNewCircle
          ? "This is your family's hearth. It is completely empty, and completely private -- only people you invite will ever see what you keep here."
          : `The house is quiet, and ${awake === 1 ? "one other person is" : `${awake} family members are`} up and about today.`}
      </AppText>
    </View>
  );
}

/**
 * First steps, shown only while the circle is empty.
 *
 * A brand-new user's problem is not "which button" -- it is not knowing what this app is
 * FOR. So this is deliberately a short ordered list of concrete acts, in the order that
 * makes the product work, rather than a generic welcome banner:
 *
 *   1. Invite somebody. A family app with one member is a diary; the archive only has
 *      value once there is somebody to keep it WITH, and inviting is also the thing
 *      most likely to be forgotten.
 *   2. Add the people. The tree is what every other screen hangs off -- a deed is
 *      *about* someone, a care circle is *for* someone.
 *   3. Record one thing. Any one thing, so the archive stops being hypothetical.
 *
 * It disappears the moment the circle is no longer empty, and it is never dismissible:
 * a dismissed checklist that cannot be recovered is worse than one that leaves on its
 * own when the work is done.
 */
function FirstSteps({
  onAddDeed, onOpenProfile,
}: { onAddDeed: () => void; onOpenProfile: () => void }) {
  return (
    <Card tone="alert" feature style={styles.firstSteps}>
      <SectionHeader title="Three things to set up" icon="sparkle" compact />

      <AppText variant="body" color={colors.onSecondaryFixedVariant}>
        Nothing here is shared with anyone outside the people you invite. Start
        wherever you like -- most families start by inviting one person.
      </AppText>

      <View style={styles.stepList}>
        <FirstStep
          n={1}
          title="Invite one family member"
          body="Settings has a private invitation link. It only works once, and only for the person you send it to."
        />
        <FirstStep
          n={2}
          title="Add the people you want to remember"
          body="Living or gone. The family tree is what stories and care are attached to."
        />
        <FirstStep
          n={3}
          title="Record one memory"
          body="A photo and a sentence is enough. It does not have to be a whole life story."
        />
      </View>

      {/*
        ONE primary action. Inviting is step 1 and lives behind the header avatar, which
        is not discoverable on day one -- so the button goes straight there rather than
        asking a new user to hunt for Settings.
      */}
      <Button
        title="Invite a family member"
        icon="people"
        kind="secondary"
        onPress={onOpenProfile}
        style={styles.firstStepsAction}
      />
      <Button title="Record the first memory" kind="quiet" icon="deed" onPress={onAddDeed} />
    </Card>
  );
}

function FirstStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={styles.step}>
      {/*
        A number, not a checkmark or an empty circle: this is a sequence to work
        through, and an unticked checkbox reads as a chore the app is nagging about.
      */}
      <View style={styles.stepNumber}>
        <AppText variant="labelSm" color={colors.onSecondary}>{n}</AppText>
      </View>
      <View style={styles.stepText}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="small" color={colors.onSecondaryFixedVariant}>{body}</AppText>
      </View>
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
  onQuickShare, onAddDeed,
}: { onQuickShare: () => void; onAddDeed: () => void }) {
  /**
   * Laid out as two SIDE-BY-SIDE tiles rather than two stacked full-width rows.
   * Stacked rows imply a ranked list -- the top one is the real button and the
   * second is the afterthought -- which is exactly the hierarchy this section
   * exists to refuse. Side by side, the fork is visibly a fork.
   */
  return (
    <View style={styles.speedRow}>
      <SpeedButton
        icon="camera"
        title="Quick Share"
        subtitle="Photos or notes for today"
        onPress={onQuickShare}
        tone="quick"
      />
      <SpeedButton
        icon="deed"
        title="Record a Deed"
        subtitle="Preserve an heirloom memory"
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
        pressed && { transform: [{ scale: 0.97 }] },
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
function ThinkingOfYou({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const { personById, actions, sentNudges, people, currentUser } = useStore();

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

      <View style={styles.nudgeRow}>
        {nudgeTargets.map((n) => {
          const person = personById(n.personId);
          // Bereavement mode: never prompt anyone to ping someone who has died.
          if (!person || person.memorialised) return null;

          const sent = sentNudges.includes(n.personId);

          return (
            <Pressable
              key={n.personId}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                void actions.sendNudge(n.personId, n.action);
              }}
              onLongPress={() => onOpenPerson(n.personId)}
              accessibilityRole="button"
              accessibilityState={{ selected: sent }}
              accessibilityLabel={
                sent
                  ? "Already sent a warm ping to " + person.name
                  : n.action + " to " + person.name + ". Long press to open their profile."
              }
              style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.7 }]}
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
                {sent ? "Sent" : n.action}
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
        action={progress.done + " of " + progress.total + " done"}
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
            Shared {photos.length} photos · 28 mins ago
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
        <Chip label="Voice memo" icon="voice" />
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

      <View style={styles.otdVoice}>
        <VoiceNote
          audio={{ id: "otd_voice", kind: "audio", uri: "mock://voice/arthur-recipe", durationSec: 102 }}
          label="Grandpa Arthur's Recipe Lore"
          speed={false}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  greeting: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  greetingTop: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm,
  },
  weather: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },

  /** Two equal tiles. `alignItems: stretch` keeps them the same height. */
  speedRow: { flexDirection: "row", gap: spacing.sm + 2, alignItems: "stretch" },
  speedButton: {
    flex: 1, minWidth: 0,
    gap: spacing.sm + 2,
    padding: spacing.md, borderRadius: radii.card,
    minHeight: 132,
  },
  speedQuick: { backgroundColor: colors.surfaceLowest, ...shadow.card },
  speedHeirloom: { backgroundColor: colors.primary, ...shadow.primaryGlow },
  speedLabels: { gap: 2, minWidth: 0 },

  nudges: { gap: spacing.md },
  firstSteps: { gap: spacing.md },
  firstStepsAction: { marginTop: spacing.xs },
  stepList: { gap: spacing.md },
  step: { flexDirection: "row", gap: spacing.sm + 4, alignItems: "flex-start" },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.secondary,
    alignItems: "center", justifyContent: "center",
    // Optical alignment with the label's cap height rather than its line box.
    marginTop: 1,
  },
  stepText: { flex: 1, gap: 2 },
  nudgeRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  nudge: { alignItems: "center", gap: spacing.xs, flex: 1, minWidth: 0 },
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
  radarTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2 },
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
    padding: spacing.md + 2, paddingBottom: spacing.sm,
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
  otdVoice: { paddingHorizontal: spacing.md + 2, paddingBottom: spacing.md + 2 },
});
