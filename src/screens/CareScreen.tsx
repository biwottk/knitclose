import React from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";
import { Card } from "../components/Card";
import { AppText } from "../components/Text";
import { Chip } from "../components/Chip";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge } from "../components/Icon";
import { SectionHeader } from "../components/SectionHeader";
import { VoiceNote } from "../components/VoiceNote";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { colors, motion, radii, ROW_MIN, spacing, TOUCH_MIN } from "../theme";
import { givenName, shortName } from "../names";
import { useStore } from "../store";
import type {
  CareCircle, CareTask, DoctorNote, EmergencyCard, MealSlot, Medication,
} from "../types";

/**
 * The Care Hub.
 *
 * ideas.md calls this the most defensible, least-served, most-likely-to-be-paid-for
 * territory in the entire space, and it is the reason a family would never switch
 * away. Right now this work lives in frantic sibling texts and somebody always
 * drops the ball.
 *
 * The design principle throughout: make the GAP visible. Every card here is built
 * so an uncovered slot, a low prescription, or an empty rota day is the most
 * eye-catching thing on screen -- because the failure mode of family care is not
 * disagreement, it is diffusion of responsibility. A claimable button turns
 * "someone should" into "I will" in one tap.
 *
 * COLOUR DISCIPLINE ON THIS SCREEN, because a care page is the easiest place in
 * the app to accidentally build a hospital dashboard:
 *   terracotta -- a slot today has nobody's name on it
 *   mint       -- handled: covered, stocked, validated, done
 *   amber      -- a gentle nudge with time still on the clock (a repeat running
 *                 low, an open rota day next week)
 * Nothing here is red, nothing pulses in warning, and every progress indicator is
 * a thin quiet line rather than a gauge.
 *
 * The whole screen is care-circle audience: a relative's blood pressure is not
 * group-chat material, and children never see it.
 */
export function CareScreen({
  onOpenProfile, onOpenKinship,
}: { onOpenProfile: () => void; onOpenKinship: () => void }) {
  const store = useStore();
  const { careCircles, personById } = store;
  const circle = careCircles[0];

  if (!circle) {
    /**
     * No care circle. Two different situations wear the same face here, and conflating
     * them would strand the user:
     *
     *   - There are relatives in the tree -> offer to start a circle for one of them.
     *   - The tree is empty -> starting a circle is IMPOSSIBLE, because a circle is
     *     "care for a specific person". Sending someone to a picker with nothing in it
     *     is how an app loses somebody on their first day, so it points at the tree.
     */
    const candidates = store.people.filter(
      (p) => p.isLiving && !p.memorialised && p.id !== store.currentUser.personId,
    );

    return (
      <View style={styles.root}>
        <AppHeader section="Care" onPressProfile={onOpenProfile} />
        <Screen insetTop={false}>
          <Card tone="low" style={styles.gap}>
            {/* The empty state opens with the care mark rather than a wall of
                text: this is the one screen a family lands on while worried. */}
            <IconBadge name="care" size={46} tone="mint" />
            <AppText variant="subtitle">No care circle yet</AppText>
            <AppText variant="body">
              When someone in the family needs looking after, a care circle keeps the
              visits, prescriptions and doctor's notes in one place instead of spread
              across a dozen text threads.
            </AppText>

            {candidates.length > 0 ? (
              <>
                <AppText variant="small" color={colors.onSurfaceVariant}>
                  Who is being cared for?
                </AppText>
                <View style={styles.circleChoices}>
                  {candidates.slice(0, 6).map((p) => (
                    <Button
                      key={p.id}
                      title={p.name}
                      kind="outline"
                      small
                      onPress={() => void store.actions.createCareCircle({ personId: p.id })}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <AppText variant="small" color={colors.onSurfaceVariant}>
                  A care circle looks after one particular person, so add them to your
                  family first.
                </AppText>
                <Button title="Go to the family tree" icon="kinship" onPress={onOpenKinship} />
              </>
            )}
          </Card>
        </Screen>
      </View>
    );
  }

  const person = personById(circle.personId);
  const card = store.emergencyCardFor(circle.personId);
  const tasks = store.tasksForToday(circle.id);
  const progress = store.careProgress(circle.id);
  const notes = store.doctorNotes.filter((n) => n.circleId === circle.id);
  const meds = store.medications.filter((m) => m.circleId === circle.id);
  const slots = store.mealSlots.filter((s) => s.circleId === circle.id);

  return (
    <View style={styles.root}>
      <AppHeader section="Care" onPressProfile={onOpenProfile} />

      {/*
        UpdateBar goes through Screen's `footer` slot rather than being absolutely
        positioned over the content. An overlay covered the last card no matter how
        much bottom padding was added, and "record a care update" must never be the
        thing hiding a care task.
      */}
      <Screen
        insetTop={false}
        footer={<UpdateBar personName={person ? givenName(person.name) : "them"} />}
      >
        {/* Named, not vague: you can see exactly who is in this sub-circle. */}
        <PrivacyBadge
          tone="strong"
          text={
            "Private care circle · " +
            circle.memberIds
              .map((id) => {
                const n = personById(id)?.name;
                return n ? shortName(n) : undefined;
              })
              .filter(Boolean)
              .join(", ")
          }
        />

        <CircleHeader circle={circle} personName={person?.name ?? "Your relative"} person={person} />

        {card ? <EmergencyRow card={card} /> : null}

        <TodaySchedule tasks={tasks} progress={progress} circleId={circle.id} />

        {notes.length > 0 ? <DoctorsNote note={notes[0]} pastCount={6} /> : null}

        <MedicationRadar meds={meds} />

        <MealTrain slots={slots} circle={circle} />
      </Screen>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Who this is about, and how they are doing today in the family's own words. */
function CircleHeader({
  circle, personName, person,
}: { circle: CareCircle; personName: string; person?: ReturnType<ReturnType<typeof useStore>["personById"]> }) {
  return (
    <Card feature style={styles.circleHeader}>
      <View style={styles.circleRow}>
        <View style={styles.circleText}>
          <View style={styles.circleTitle}>
            <AppText variant="title">{personName}'s Circle</AppText>
            <LivePip />
          </View>

          {/*
            The day's status is led by a real sun glyph. The sun EMOJI that used to
            sit here rendered as different artwork on every OS and could not be
            tinted, so it never matched the amber this screen uses for "gentle".
            Amber and not terracotta on purpose: "Gentle rest day" is information,
            not a task still waiting for somebody.
          */}
          <View style={styles.statusRow}>
            <Icon name="sun" size={16} color={colors.onTertiaryFixedVariant} />
            <AppText variant="body" style={styles.statusText}>
              Today: {circle.status}
            </AppText>
          </View>
        </View>
        <Avatar person={person ?? undefined} size={56} ring ringColor={colors.primaryContainer} />
      </View>
    </Card>
  );
}

/**
 * The "this circle is live today" pip.
 *
 * It breathes on a slow loop because it represents a live state, and a static dot
 * claiming liveness is the same lie as a waveform that never moves. Slow and
 * low-contrast on purpose: a care screen must not blink at you.
 */
function LivePip() {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.livePip,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          ],
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/**
 * The emergency card entry point.
 *
 * Marked "Offline Ready" because that is the actual requirement: this is the
 * screen you hand a paramedic, and it is worthless if it needs a signal. It sits
 * high on the page for the same reason -- when you need it, you are not browsing.
 *
 * The leading glyph is a shield, not the old 🛑 stop sign: this row is the thing
 * that PROTECTS her, and a red octagon on a care page reads as an alarm going off
 * even on the days when nothing is wrong.
 */
function EmergencyRow({ card }: { card: EmergencyCard }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card tone="alert" padded={false}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Emergency card and medications. Allergies, clinicians and next of kin."
        style={({ pressed }) => [styles.emergencyRow, pressed && { opacity: 0.9 }]}
      >
        <IconBadge name="shield" size={40} tone="secondary" />

        <View style={styles.emergencyText}>
          <AppText variant="labelSm" bold color={colors.secondary}>
            Emergency Card & Meds
          </AppText>
          <AppText variant="small" color={colors.onSecondaryFixedVariant} numberOfLines={2}>
            Allergies, Dr. Amara's line, power of attorney
          </AppText>
        </View>

        <View style={styles.emergencyRight}>
          {/* The download glyph is the promise: this is already on the phone. */}
          <Chip label="Offline Ready" tone="terracotta" icon="download" />
          <Chevron expanded={open} color={colors.onSecondaryFixedVariant} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.emergencyBody}>
          {/*
            The details sit on a paper panel inside the terracotta card instead of
            below a hairline rule. Two surfaces separated by tone is legible at a
            glance in a hurry; a 1px line dividing one flat block is not.
          */}
          <Card tone="paper" elevation="flat" style={styles.emergencyDetails}>
            <Detail label="Blood type" value={card.bloodType ?? "Unknown"} />
            <Detail label="Allergies" value={card.allergies.join(", ") || "None recorded"} />
            <Detail label="Conditions" value={card.conditions.join(" · ")} />
            <Detail label="Medications" value={card.medications.join(" · ")} />

            {card.clinicians.map((c) => (
              <Detail key={c.name} label={c.role} value={c.name + " · " + c.phone} />
            ))}
            {card.contacts.map((c) => (
              <Detail key={c.name} label={c.relation} value={c.name + " · " + c.phone} />
            ))}
            {card.powerOfAttorney ? (
              <Detail label="Power of attorney" value={card.powerOfAttorney} />
            ) : null}
          </Card>
        </View>
      ) : null}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="micro" color={colors.onSecondaryFixedVariant}>{label}</AppText>
      <AppText variant="body" color={colors.onSurface}>{value}</AppText>
    </View>
  );
}

/**
 * A disclosure chevron that ROTATES between its two states.
 *
 * It replaces the "⌃"/"⌄" text characters, which sat on different baselines and at
 * different weights on every platform, and which snapped between states with no
 * indication that the row itself had opened.
 */
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
 * Today's schedule.
 *
 * Three states, each visually distinct so the page can be read in one glance:
 * done (struck through, quiet), covered (someone's name attached), and
 * UNCLAIMED -- which gets the terracotta panel and the only filled button on the
 * row. An unclaimed slot should feel like an open door, not a line item.
 */
function TodaySchedule({
  tasks, progress, circleId,
}: { tasks: CareTask[]; progress: { done: number; total: number }; circleId: string }) {
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <Card style={styles.section}>
      {/* The "3 of 5 Done" count moved out of the header's action slot and onto
          the progress line below, where the number and the bar it describes read as
          one thing instead of two. */}
      <SectionHeader title="Today's Care Schedule" icon="clock" />

      {/*
        Progress is one thin mint thread plus a tabular count, not a ring or a
        percentage. Mint because a finished visit is "handled"; `mono` because
        proportional digits visibly jitter as the count climbs through the day. The
        bar is hidden from the screen reader -- the count beside it says the same
        thing in words.
      */}
      <View style={styles.progressRow}>
        <View
          style={styles.progressTrack}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.progressFill, { width: (pct + "%") as `${number}%` }]} />
        </View>
        <AppText variant="mono" color={colors.onPrimaryFixedVariant}>
          {progress.done + " of " + progress.total + " done"}
        </AppText>
      </View>

      <View style={styles.taskList}>
        {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        {tasks.length === 0 ? (
          <AppText variant="body">Nothing scheduled today.</AppText>
        ) : null}
      </View>
    </Card>
  );
}

function TaskRow({ task }: { task: CareTask }) {
  const { dispatch, currentUser } = useStore();
  const unclaimed = !task.done && !task.claimedByName;

  return (
    <View
      style={[
        styles.task,
        task.done && styles.taskDone,
        unclaimed && styles.taskOpen,
      ]}
    >
      <View style={styles.taskTop}>
        <Pressable
          onPress={() => {
            if (task.done) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            dispatch({ type: "completeCareTask", taskId: task.id });
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={task.title + (task.done ? ", done" : ", mark as done")}
          // Visible circle is 28pt; hitSlop 10 on each side takes the real target
          // to the mandated 48. The tick is a stroked glyph rather than a "✓"
          // character, so it inherits the button's own foreground colour.
          hitSlop={10}
          style={[styles.check, task.done && styles.checkOn]}
        >
          {task.done ? (
            <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={2.6} />
          ) : null}
        </Pressable>

        <View style={styles.taskText}>
          <AppText
            variant="labelSm"
            bold
            style={task.done ? styles.strike : undefined}
            color={task.done ? colors.onSurfaceVariant : colors.onSurface}
          >
            {task.title}
          </AppText>
          {task.detail ? (
            <AppText variant="small" numberOfLines={2}>{task.detail}</AppText>
          ) : null}
        </View>

        {/* Tabular figures keep a column of times optically aligned. */}
        <AppText
          variant="mono"
          color={unclaimed ? colors.secondary : colors.onSurfaceVariant}
          style={styles.taskTime}
        >
          {task.timeText}
        </AppText>
      </View>

      <View style={styles.taskFooter}>
        {task.result ? (
          <Chip
            label={task.result}
            tone={task.done ? "mint" : "neutral"}
            icon={task.done ? "check" : undefined}
          />
        ) : null}
        {task.claimedByName && !task.done ? (
          <Chip label={"Covered by " + task.claimedByName} tone="mint" icon="check" />
        ) : null}

        {/* The whole point of the feature: one tap makes it somebody's job.
            A handshake glyph replaces the raised-hand EMOJI, which arrived with a
            skin tone, a gender and a gloss level the design system could not set. */}
        {unclaimed ? (
          <Button
            title="I'll Take This (Claim Slot)"
            icon="handshake"
            kind="secondary"
            fill
            onPress={() => dispatch({ type: "claimCareTask", taskId: task.id })}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The doctor's note, captured live in clinic.
 *
 * Both the summary AND the raw audio are kept: the transcript is searchable, and
 * the recording is the primary source when siblings inevitably remember the
 * appointment differently. "Validated" means a human confirmed this is what was
 * actually said -- a machine transcript alone must never be the record of a
 * medical instruction.
 */
function DoctorsNote({ note, pastCount }: { note: DoctorNote; pastCount: number }) {
  return (
    <Card style={styles.section}>
      <SectionHeader
        title="Latest Doctor's Note"
        icon="medical"
        actionLabel={"Preview · Past Visits (" + pastCount + ")"}
        onAction={() => previewCare("Past visit history")}
      />

      {/* Nested inside another card, so it is flat: two stacked shadows read as a
          rendering artefact rather than as two layers. */}
      <Card tone="low" elevation="flat" style={styles.noteInner}>
        <View style={styles.noteHead}>
          <AppText variant="labelSm" bold style={styles.noteClinician}>
            {note.clinician}
          </AppText>
          {/* Mint, not amber: a validated note is settled. Amber on this screen is
              reserved for things still waiting on somebody. */}
          {note.validated ? <Chip label="Validated" tone="mint" icon="check" /> : null}
        </View>

        <AppText variant="quote">{"“" + note.summary + "”"}</AppText>

        {note.audio ? (
          <VoiceNote
            audio={note.audio}
            label="Doctor's Voice Memo (Full)"
            speed={false}
          />
        ) : null}

        <View style={styles.noteFooter}>
          <AppText variant="micro">Recorded live in clinic by {note.recordedByName}</AppText>
          <Chip label="Preview · Discuss in Chat" icon="chat" onPress={() => previewCare("Doctor-note discussion")}/>
        </View>
      </Card>
    </Card>
  );
}

/**
 * Medication radar.
 *
 * Days-of-supply is the number that actually matters, so it leads. Amber warns
 * at a week out; that is enough time to act without the alarmism that makes
 * people stop reading warnings. Naming who volunteered to fetch a repeat is what
 * stops two people collecting the same prescription.
 *
 * Each medicine is its own tinted panel now instead of a row under a hairline
 * rule: a stack of ruled rows is a spreadsheet, and this is the part of the
 * screen most likely to be read while tired.
 */
function MedicationRadar({ meds }: { meds: Medication[] }) {
  return (
    <Card style={styles.section}>
      {/* "+ Add" lost its typed plus sign: SectionHeader already draws a chevron
          on a tappable action, and a "+" glyph typed into a label cannot be tinted
          or sized with the text it sits beside. */}
      <SectionHeader
        title="Medication Radar"
        icon="pill"
        actionLabel="Preview · Add"
        onAction={() => previewCare("Adding medication")}
      />

      {meds.map((m) => {
        const low = m.daysLeft <= 7;
        return (
          <View key={m.id} style={styles.med}>
            <View style={styles.medTop}>
              <IconBadge name="pill" size={38} tone={low ? "amber" : "mint"} />

              <View style={styles.medText}>
                <AppText variant="labelSm" bold>{m.name}</AppText>
                <AppText variant="small">
                  {m.dose}{m.schedule ? " · " + m.schedule : ""}
                </AppText>
                {m.pharmacy ? <AppText variant="small">{m.pharmacy}</AppText> : null}
              </View>

              <View style={styles.medRight}>
                {/* No warning glyph on "Low Supply": amber plus the number is the
                    nudge. "Stocked" gets the tick because mint means handled. */}
                {low ? (
                  <Chip label="Low Supply" tone="amber" />
                ) : (
                  <Chip label="Stocked" tone="mint" icon="check" />
                )}
                <AppText
                  variant="mono"
                  color={low ? colors.onTertiaryFixedVariant : colors.onSurfaceVariant}
                >
                  {m.daysLeft} days left
                </AppText>
              </View>
            </View>

            {/* Supply bar. 30 days is the reference window for a normal repeat.
                Both fills are "dim" tokens so the bar reads as a quiet gauge of
                time rather than as a red-line warning: amber running low, mint
                while there is plenty. */}
            <View style={styles.medBar}>
              <View
                style={[
                  styles.medBarFill,
                  {
                    width: (Math.min(100, (m.daysLeft / 30) * 100) + "%") as `${number}%`,
                    backgroundColor: low ? colors.tertiaryFixedDim : colors.primaryFixedDim,
                  },
                ]}
              />
            </View>

            {m.pickupByName ? (
              <View style={styles.medPickup}>
                {/* This line used to open with a tick character typed into the
                    string itself. It is a glyph plus a sentence now, so it takes the
                    same mint that means "handled" everywhere else on this screen. */}
                <View style={styles.medPickupText}>
                  <Icon name="check" size={14} color={colors.onPrimaryFixedVariant} strokeWidth={2.4} />
                  <AppText variant="labelSm" color={colors.onPrimaryFixedVariant} numberOfLines={2}>
                    {m.pickupByName} volunteered for pickup
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Change who collects " + m.name}
                  // 24pt of visible text plus 12pt of slop each side clears 48.
                  hitSlop={12}
                  onPress={() => previewCare("Changing the medication collector")}
                  style={({ pressed }) => [styles.medChange, pressed && { opacity: 0.6 }]}
                >
                  <AppText variant="labelSm" color={colors.secondary}>Preview · Change</AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

/**
 * Meal train and visiting rota.
 *
 * The classic signup sheet for new baby, surgery or bereavement. An open day is
 * rendered as an invitation with a Claim button rather than as blank space,
 * because blank space is how a rota quietly fails.
 *
 * An open day is AMBER, not terracotta: terracotta on this screen means "today,
 * and nobody has it". A free Thursday next week still has time on the clock, and
 * a rota of five terracotta panels would drown out the one thing that is actually
 * urgent today.
 */
function MealTrain({ slots, circle }: { slots: MealSlot[]; circle: CareCircle }) {
  const { dispatch } = useStore();

  return (
    <Card style={styles.section}>
      <SectionHeader
        title="Meal Train & Visiting Rota"
        icon="meal"
        action={circle.recoveryWeek ? "Week " + circle.recoveryWeek + " of Recovery" : undefined}
      />

      {slots.map((s) => {
        const open = !s.claimedByName;
        return (
          <View key={s.id} style={[styles.slot, open && styles.slotOpen]}>
            <View style={styles.slotDate}>
              <AppText
                variant="micro"
                color={open ? colors.onTertiaryFixedVariant : colors.onSurfaceVariant}
              >
                {s.dayLabel}
              </AppText>
              {/* The date is the tabular figure: a column of dates that shifts by
                  a pixel per row looks like a broken table. */}
              <AppText
                variant="mono"
                bold
                color={open ? colors.onTertiaryFixed : colors.onSurface}
              >
                {s.dateLabel}
              </AppText>
            </View>

            <View style={styles.slotText}>
              <AppText
                variant="labelSm"
                bold
                color={open ? colors.onTertiaryFixed : colors.onSurface}
              >
                {s.title ?? "Open Evening Meal"}
              </AppText>
              {s.detail ? (
                <AppText variant="small" numberOfLines={2}>{s.detail}</AppText>
              ) : null}
            </View>

            {open ? (
              // Outline, deliberately: claiming a day next week is a low-pressure
              // offer, so it does not compete with today's solid terracotta claim.
              // Full height, not `small`: the visible control stays at the 48pt
              // touch floor rather than relying on hitSlop to get there.
              <Button
                title="Claim Day"
                kind="outline"
                onPress={() => dispatch({ type: "claimMealSlot", slotId: s.id })}
                style={styles.slotButton}
              />
            ) : (
              <Chip label={s.claimedByName ?? ""} tone="mint" icon="check" />
            )}
          </View>
        );
      })}

      <View style={styles.rotaFooter}>
        {circle.dietaryNote ? (
          <View style={styles.dietary}>
            {/* Sentence case, not caps: a dietary note shouted in 12px caps reads
                as a warning label when it is simply something to know. */}
            <Icon name="info" size={14} color={colors.onSurfaceFaint} />
            <AppText variant="small" color={colors.onSurfaceVariant} style={styles.dietaryText}>
              Dietary note: {circle.dietaryNote}
            </AppText>
          </View>
        ) : null}
        <Chip label="Preview · Propose Next Week" tone="terracotta" icon="calendar" onPress={() => previewCare("Proposing next week's rota")}/>
      </View>
    </Card>
  );
}

/**
 * The persistent update bar.
 *
 * Speaking a 30-second memo is the lowest-friction way to file a care update, and
 * the person doing the visit usually has one hand free at best. Transcription
 * then makes it searchable for whoever picks up the next shift.
 */
function UpdateBar({ personName }: { personName: string }) {
  return (
    <View style={styles.updateBar}>
      <View style={styles.updateText}>
        <AppText variant="micro" color={colors.primaryFixedDim}>Preview</AppText>
        <AppText variant="labelSm" bold color={colors.inverseOnSurface}>
          Have an update for {personName}'s Circle?
        </AppText>
        {/* Sentence case: a warm offer, not an instruction shouted at a carer. */}
        <AppText variant="small" color={colors.primaryFixedDim}>
          Speak a 30-second memo. We transcribe it for the others.
        </AppText>
      </View>
      <Pressable
        onPress={() => previewCare("Recording a care update")}
        accessibilityRole="button"
        accessibilityLabel={"Record a care update for " + personName + "'s circle"}
        hitSlop={8}
        // Scales rather than dims: the mic is the one control on a dark bar, and
        // dimming it reads as "unavailable" instead of "pressed".
        style={({ pressed }) => [
          styles.updateMic,
          pressed && { transform: [{ scale: motion.pressScale }] },
        ]}
      >
        {/* A stroked microphone, tinted to the button's own foreground. The
            microphone EMOJI could not take a colour and shipped a different shape
            on every platform. */}
        <Icon name="voice" size={22} color={colors.onSecondary} />
      </Pressable>
    </View>
  );
}

function previewCare(feature: string) {
  Alert.alert("Preview", feature + " is planned but is not available yet. Nothing will be changed.");
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  gap: { gap: spacing.md },
  /** Wraps, because a family can have more relatives than fit on one line. */
  circleChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.md },

  /** Feature radius: this is the hero of the screen, the person it is all about. */
  circleHeader: {},
  circleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  circleText: { flex: 1, gap: spacing.sm, minWidth: 0 },
  circleTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  livePip: {
    width: 9, height: 9, borderRadius: radii.pill,
    backgroundColor: colors.secondaryContainer,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm - 2 },
  statusText: { flexShrink: 1 },

  emergencyRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm + 2,
    padding: spacing.md, minHeight: ROW_MIN,
  },
  emergencyText: { flex: 1, gap: 1, minWidth: 0 },
  emergencyRight: { alignItems: "flex-end", gap: spacing.xs, flexShrink: 0 },
  emergencyBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  /** Inset panel radius, because it sits inside the terracotta card. */
  emergencyDetails: { gap: spacing.md, borderRadius: radii.inner },
  detail: { gap: 2 },

  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  progressTrack: {
    flex: 1, height: 6, borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainer, overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: radii.pill, backgroundColor: colors.primaryFixedDim,
  },

  taskList: { gap: spacing.sm },
  /**
   * Task panels are separated by tone and 16pt corners, never by a hairline: a
   * boxed row inside a boxed card inside a boxed screen is the look the refresh
   * exists to remove.
   */
  task: {
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceLow,
    padding: spacing.md, gap: spacing.sm,
  },
  /** Finished tasks stay a quiet neutral so the uncovered slot keeps the eye. */
  taskDone: { backgroundColor: colors.surfaceContainer },
  taskOpen: { backgroundColor: colors.secondaryFixed },
  taskTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2 },
  check: {
    width: 28, height: 28, borderRadius: radii.pill, borderWidth: 2,
    borderColor: colors.outline, alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  taskText: { flex: 1, gap: 2, minWidth: 0 },
  strike: { textDecorationLine: "line-through" },
  taskTime: { flexShrink: 0 },
  taskFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },

  noteInner: { gap: spacing.md },
  noteHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm,
  },
  noteClinician: { flexShrink: 1 },
  noteFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, flexWrap: "wrap",
  },

  med: {
    gap: spacing.sm + 2, padding: spacing.md,
    borderRadius: radii.inner, backgroundColor: colors.surfaceLow,
  },
  medTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm + 2 },
  medText: { flex: 1, gap: 2, minWidth: 0 },
  medRight: { alignItems: "flex-end", gap: spacing.xs, flexShrink: 0 },
  medBar: {
    height: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceHighest,
    overflow: "hidden",
  },
  medBarFill: { height: "100%", borderRadius: radii.pill },
  medPickup: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm,
  },
  medPickupText: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    flexShrink: 1, minWidth: 0,
  },
  medChange: { minHeight: 24, justifyContent: "center", flexShrink: 0 },

  slot: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    minHeight: ROW_MIN, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 4,
    borderRadius: radii.inner, backgroundColor: colors.surfaceLow,
  },
  slotOpen: { backgroundColor: colors.tertiaryFixed },
  slotDate: { alignItems: "center", width: 40, flexShrink: 0 },
  slotText: { flex: 1, gap: 2, minWidth: 0 },
  slotButton: { flexShrink: 0, paddingHorizontal: spacing.md },
  /** Separated by space, not by a rule. */
  rotaFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, flexWrap: "wrap", paddingTop: spacing.xs,
  },
  dietary: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    flexShrink: 1, maxWidth: "60%",
  },
  dietaryText: { flexShrink: 1 },

  updateBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.cardLg, padding: spacing.md,
  },
  updateText: { flex: 1, gap: 1, minWidth: 0 },
  updateMic: {
    width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: radii.pill,
    backgroundColor: colors.secondaryContainer,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
});
