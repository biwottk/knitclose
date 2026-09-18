import React from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";
import { Card } from "../components/Card";
import { AppText } from "../components/Text";
import { Chip } from "../components/Chip";
import { Button } from "../components/Button";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { VoiceNote } from "../components/VoiceNote";
import {
  colors, fonts, INPUT_MIN, motion, PRESSED_OPACITY, radii, ROW_MIN, shadow,
  spacing, TOUCH_MIN, type,
} from "../theme";
import { useStore } from "../store";
import type { ArchivePhoto, FaceTag, Recipe } from "../types";

type Tab = "recipes" | "faces";

/**
 * The Archive: the recipe box, and "Who is this?".
 *
 * These two live together because they are the same job seen from two ends.
 * Both are about extracting knowledge that currently exists only inside an
 * elder's head, and both have a deadline nobody likes to name.
 *
 * The recipe box is the cheapest emotional win in the product -- family recipes
 * are the most-requested heirloom there is, and it is trivial to build. "Who is
 * this?" is the most urgent thing in the entire app: unlabelled photographs are
 * a race against time, and the people who can answer are exactly the people we
 * are racing.
 *
 * WHAT CHANGED IN THE REFRESH: this screen holds the permanent half of the
 * product, so it is typeset like a book now rather than drawn like a file
 * browser. Fraunces carries the headings, the recipe provenance and the question
 * being asked of an elder. The whole emoji vocabulary that used to stand in for
 * icons here (notebook, magnifier, hourglass, clock, bread, frying pan, bookmark,
 * mailbox, phone, tick, chevrons, arrow) is now stroked vector glyphs from the
 * one icon map. And the hairlines that fenced off every row are gone: separation
 * comes from tone, inset panels and space, which is what makes a page read as
 * printed rather than tabulated.
 */
export function ArchiveScreen({
  onOpenProfile, onAddRecipe,
}: { onOpenProfile: () => void; onAddRecipe: () => void }) {
  const store = useStore();
  const [tab, setTab] = React.useState<Tab>("recipes");

  const unnamed = store.unnamedFaceCount();
  const featured = store.recipes[0];
  const others = store.recipes.slice(1);
  const photo = store.archivePhotos[0];

  return (
    <View style={styles.root}>
      <AppHeader section="Archive" onPressProfile={onOpenProfile} />

      <Screen insetTop={false}>
        <View style={styles.tabs}>
          <ArchiveTab
            label="Recipe Box"
            icon="journal"
            count={store.recipes.length}
            selected={tab === "recipes"}
            onPress={() => setTab("recipes")}
          />
          <ArchiveTab
            label="Who Is This?"
            icon="search"
            count={unnamed}
            selected={tab === "faces"}
            onPress={() => setTab("faces")}
            urgent
          />
        </View>

        {tab === "recipes" ? (
          featured ? (
            <>
              <SectionHeader
                title="Generations in the oven"
                compact
                icon="flame"
                action={featured.origin ? featured.origin + " · " + featured.originYear : undefined}
              />
              <FeaturedRecipe recipe={featured} />
              {others.length > 0 ? <OtherHeirlooms recipes={others} total={store.recipes.length} /> : null}
            </>
          ) : (
            /*
             * The recipe box is the most-requested heirloom there is, and the easiest
             * first contribution -- so the empty state names the specific, concrete act
             * ("photograph the handwritten card") rather than saying "add a recipe".
             * The reason is the motivation: the card in her handwriting is the primary
             * source, and it is the thing that gets thrown away.
             */
            <EmptyState
              icon="recipe"
              title="The recipe box is empty"
              body={
                "Photograph a handwritten card before it fades, and record whoever cooks " +
                "it talking through the part the recipe never explains. That voice is the " +
                "half nobody writes down."
              }
              actionLabel="Add the first recipe"
              onAction={onAddRecipe}
            />
          )
        ) : (
          <>
            {photo ? (
              <>
                <RaceAgainstTime unnamed={unnamed} />
                <WhoIsThis photo={photo} />
              </>
            ) : (
              /*
               * "Who is this?" needs an old photo with unidentified faces in it. Until
               * one exists the feature has nothing to work on, so this explains the
               * urgency instead -- it is the one part of the product that is genuinely
               * a race, and saying so is what makes somebody go and find the shoebox.
               */
              <EmptyState
                icon="search"
                title="No photographs to identify yet"
                body={
                  "Upload an old family photograph and the family can tag the faces " +
                  "together. Do the oldest ones first: the people who can still name " +
                  "them are exactly the people we are racing."
                }
                actionLabel="Add an old photograph"
                onAction={onAddRecipe}
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * The two halves of the archive.
 *
 * WHAT CHANGED: the tab took an emoji string for its icon and drew itself as a
 * 14px-cornered box with a hairline on all four sides, so both tabs read as two
 * equally weighted grey boxes and only the tint said which was live. It is a pill
 * now, following the filter pattern in Chip: the unselected tab is OUTLINED
 * rather than filled grey, which leaves the selected one as the only solid shape
 * in the row. Selected is forest, because forest is the archive colour everywhere
 * else in the app.
 *
 * `icon` is an IconName rather than a string, so a tab cannot be handed a glyph
 * the design system does not own.
 */
function ArchiveTab({
  label, icon, count, selected, onPress, urgent,
}: {
  label: string; icon: IconName; count: number; selected: boolean;
  onPress: () => void; urgent?: boolean;
}) {
  const fg = selected ? colors.primaryFixed : colors.onSurfaceVariant;
  const flagged = !!urgent && count > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label + ", " + count + " items"}
      style={({ pressed }) => [
        styles.tab,
        selected ? styles.tabOn : styles.tabOff,
        // Scale rather than dim: a tab that fades under the thumb reads as
        // disabled at the exact moment it is being chosen.
        pressed && { transform: [{ scale: motion.pressScale }] },
      ]}
    >
      <Icon name={icon} size={17} color={fg} />
      <AppText
        variant="labelSm"
        bold={selected}
        color={fg}
        numberOfLines={1}
        // Must shrink: "Who Is This?" plus its count does not fit two-up at
        // 393pt otherwise, and a truncated tab label is a broken tab.
        style={styles.tabLabel}
      >
        {label}
      </AppText>
      <View
        style={[
          styles.tabCount,
          selected && styles.tabCountOn,
          flagged && styles.tabCountUrgent,
        ]}
      >
        {/* Tabular figures: the unnamed count drops as faces are named, and
            proportional digits make the pill twitch when it does. */}
        <AppText
          variant="mono"
          color={flagged ? colors.onSecondary : fg}
          style={styles.tabCountText}
        >
          {count}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * The featured recipe.
 *
 * Three sources of truth, all kept: the finished dish, a photo of the original
 * handwritten card, and her voice explaining the part writing cannot capture.
 * The provenance line ("Baked every Easter morning since 1968") is not a
 * decorative subtitle -- it is the reason this is an heirloom and not a webpage.
 *
 * It is a `feature` card (26px corners) because it is the hero of the tab, and
 * the photograph bleeds to those corners instead of sitting inside a boxed frame.
 */
function FeaturedRecipe({ recipe }: { recipe: Recipe }) {
  const { dispatch } = useStore();
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card padded={false} feature>
      <View style={styles.recipeHero}>
        {recipe.photoUri ? (
          <Image
            source={{ uri: recipe.photoUri }}
            style={styles.recipePhoto}
            accessibilityLabel={recipe.title}
          />
        ) : null}

        {/* The tradition pill rides on the photograph. Its heart is a filled
            vector glyph rather than the heart text character it used to hold, so
            it keeps its weight at 13px and takes the terracotta that "someone
            does this every single year" wants. */}
        {recipe.tradition ? (
          <View style={styles.traditionTag}>
            <Icon name="heart" size={13} color={colors.secondary} filled />
            <AppText variant="micro" color={colors.onSurface}>
              {recipe.tradition}
            </AppText>
          </View>
        ) : null}

        {/* The handwritten card, inset like a photograph tucked into a frame.
            It is the primary source: it is in her handwriting. 16px corners and a
            lifted shadow now -- 8px on inset media was half of what dated this. */}
        {recipe.cardPhotoUri ? (
          <View style={styles.cardInset}>
            <Image
              source={{ uri: recipe.cardPhotoUri }}
              style={styles.cardInsetPhoto}
              accessibilityLabel="The original handwritten recipe card"
            />
            <View style={styles.cardInsetLabel}>
              <AppText variant="micro" color={colors.inverseOnSurface} numberOfLines={1}>
                Aunt Clara's 1968 card
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.recipeBody}>
        <AppText variant="title">{recipe.title}</AppText>

        <AppText variant="quote">{"\u201C" + recipe.provenance + "\u201D"}</AppText>

        <View style={styles.recipeMeta}>
          {recipe.prepText ? <Chip label={recipe.prepText} icon="clock" /> : null}
          {recipe.yieldText ? <Chip label={recipe.yieldText} icon="meal" /> : null}
          {recipe.voiceNote ? (
            <Chip label="Voice Preserved" tone="terracotta" icon="voice" />
          ) : null}
        </View>

        {recipe.voiceNote ? (
          <VoiceNote
            audio={recipe.voiceNote}
            label={recipe.voiceNoteLabel}
            speed={false}
          />
        ) : null}

        {/* Ingredients and method are collapsed by default: the emotional
            content is what makes someone open this, and the instructions are
            what they need once they have decided to cook.

            The disclosure is a filled tonal row now instead of a label sitting
            above a hairline. A recessed surface says "press me" without ruling a
            line across the card, and it gives the control a full 48pt height. */}
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "Hide the recipe method" : "Show ingredients and method"}
          hitSlop={8}
          style={({ pressed }) => [
            styles.expandRow,
            pressed && { opacity: PRESSED_OPACITY },
          ]}
        >
          <View style={styles.expandLeft}>
            <Icon name="recipe" size={16} color={colors.primary} />
            <AppText variant="labelSm" bold color={colors.primary}>
              {expanded ? "Hide the method" : "Ingredients & method"}
            </AppText>
          </View>
          <DisclosureChevron expanded={expanded} color={colors.primary} />
        </Pressable>

        {/* A flat nested card: the method is a sub-panel inside this card, and a
            second shadow at this depth would read as a loose sheet of paper. */}
        {expanded ? (
          <Card tone="low" elevation="flat" style={styles.method}>
            <AppText variant="micro">Ingredients</AppText>
            {recipe.ingredients.map((i) => (
              <View key={i} style={styles.methodItem}>
                {/* A drawn dot, not a bullet character: it takes a theme colour
                    and stays one size in every font the OS might fall back to. */}
                <View style={styles.bullet} />
                <AppText variant="body" color={colors.onSurfaceVariant} style={styles.methodLine}>
                  {i}
                </AppText>
              </View>
            ))}

            <AppText variant="micro" style={styles.methodHead}>Method</AppText>
            {recipe.steps.map((s, n) => (
              <View key={s} style={styles.methodItem}>
                {/* Tabular figures keep the step numbers in one column once the
                    count crosses from one digit to two. */}
                <AppText variant="mono" color={colors.primary} style={styles.stepNumber}>
                  {n + 1}
                </AppText>
                <AppText variant="body" color={colors.onSurfaceVariant} style={styles.methodLine}>
                  {s}
                </AppText>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.recipeActions}>
          <Button title="Cook This Sunday" icon="meal" fill onPress={() => {}} />
          <Button
            title={recipe.savedByCurrentUser ? "Saved" : "Save to Kitchen"}
            icon={recipe.savedByCurrentUser ? "check" : "bookmark"}
            kind="outline"
            fill
            onPress={() => dispatch({ type: "toggleSaveRecipe", recipeId: recipe.id })}
          />
        </View>
      </View>

      {/*
        Print-on-demand. The heirloom book export is the revenue line
        (docs/great_deeds_strategy.md), and a recipe card is the smallest, most
        giftable version of it -- so the offer belongs here, priced and quiet,
        not behind a paywall interstitial.

        It is a tonal band running to the card's bottom edge rather than a row
        under a hairline, the mailbox emoji is a parcel glyph in the standard
        IconBadge, and the trailing chevron is what now says "this goes
        somewhere".
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Order a keepsake embossed print card, four pounds fifty"
        onPress={() => {}}
        style={({ pressed }) => [styles.printRow, pressed && { opacity: PRESSED_OPACITY }]}
      >
        <IconBadge name="box" size={32} tone="paper" />
        <AppText variant="small" color={colors.onSurfaceVariant} style={styles.printLabel}>
          Order Keepsake Embossed Print Card (£4.50)
        </AppText>
        <Icon name="chevronRight" size={16} color={colors.outline} />
      </Pressable>
    </Card>
  );
}

/**
 * A chevron that rotates through the disclosure instead of swapping between two
 * text characters, which arrived at a different baseline and weight per platform.
 * Same treatment as the transcript disclosure in VoiceNote, deliberately.
 */
function DisclosureChevron({ expanded, color }: { expanded: boolean; color: string }) {
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
 * The rest of the recipe box.
 *
 * Each row is a soft tonal tile with 16px corners now instead of a line item
 * under a hairline: a stack of hairline rows is a table, and this is meant to
 * read as a shelf of things worth keeping.
 */
function OtherHeirlooms({ recipes, total }: { recipes: Recipe[]; total: number }) {
  return (
    <Card style={styles.section}>
      <SectionHeader
        title="Other Cherished Heirlooms"
        actionLabel={"View All " + total}
        onAction={() => {}}
      />

      {recipes.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={r.title + ". " + r.provenance}
          onPress={() => {}}
          style={({ pressed }) => [styles.heirloomRow, pressed && { opacity: PRESSED_OPACITY }]}
        >
          {r.photoUri ? (
            <Image
              source={{ uri: r.photoUri }}
              style={styles.heirloomThumb}
              accessibilityLabel={r.title}
            />
          ) : null}
          <View style={styles.heirloomText}>
            <AppText variant="labelSm" bold numberOfLines={1}>{r.title}</AppText>
            <AppText variant="small" numberOfLines={1}>{r.provenance}</AppText>
          </View>
          {/* Was a single-character text chevron, which arrives at a different
              width and weight in every fallback font the OS might reach for. */}
          <Icon name="chevronRight" size={17} color={colors.outline} />
        </Pressable>
      ))}
    </Card>
  );
}

/**
 * The framing card for face tagging.
 *
 * Stated plainly and without melodrama: unlabelled photos fade from memory if we
 * do not ask our elders today. Naming the stake is what makes someone actually do
 * it, and this is the one place in the app where a little urgency is honest
 * rather than manufactured.
 *
 * The hourglass emoji is a clock glyph in a terracotta IconBadge now -- the same
 * leading affordance every other callout uses, so this card reads as part of the
 * app instead of as a one-off circle drawn by hand.
 */
function RaceAgainstTime({ unnamed }: { unnamed: number }) {
  return (
    <Card tone="alert" style={styles.race}>
      <View style={styles.raceTop}>
        <IconBadge name="clock" size={44} tone="secondary" />
        <AppText variant="title" color={colors.onSecondaryFixed} style={styles.raceTitle}>
          Race Against Time
        </AppText>
        <Chip label={unnamed + " Unnamed"} tone="terracotta" />
      </View>

      <AppText variant="body" color={colors.onSecondaryFixedVariant}>
        Unlabelled photos fade from memory if we don't ask our elders today. Help Nana
        and Dave name the missing faces.
      </AppText>
    </Card>
  );
}

/**
 * "Who is this?"
 *
 * Face markers sit on the photograph itself at fractional coordinates, so tapping
 * a face is how you name it -- the same gesture you would use pointing at a print
 * across a kitchen table.
 *
 * Voice is the primary answer path, not typing. An 80-year-old recognising her
 * sister will say "oh that's Clara, at the Whitsun parade" in one breath and would
 * abandon a text field halfway through. Typing is offered second, deliberately.
 *
 * The photograph is the hero here too, so this is a `feature` card and every
 * overlay on the image is a pill: a hard-cornered label floating on a photo is
 * one of the most dated things a gallery view can do.
 */
function WhoIsThis({ photo }: { photo: ArchivePhoto }) {
  const { dispatch } = useStore();
  const [active, setActive] = React.useState<FaceTag | null>(null);
  const [draft, setDraft] = React.useState("");

  const submit = () => {
    const name = draft.trim();
    if (!name || !active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    dispatch({ type: "nameFace", photoId: photo.id, faceId: active.id, name });
    setDraft("");
    setActive(null);
  };

  return (
    <Card padded={false} feature>
      {/* Where the print physically came from. The parcel glyph makes this read
          as an archival note rather than as a photo caption. */}
      <View style={styles.provenanceRow}>
        <Icon name="box" size={14} color={colors.primaryFixedDim} />
        <AppText
          variant="micro"
          color={colors.inverseOnSurface}
          numberOfLines={2}
          style={styles.provenanceText}
        >
          {photo.provenance}
        </AppText>
      </View>

      <View style={styles.facePhotoWrap}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.facePhoto}
          accessibilityLabel={"Old family photograph. " + photo.provenance}
        />

        {photo.faces.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => {
              setActive(f);
              setDraft(f.name ?? "");
            }}
            accessibilityRole="button"
            accessibilityLabel={
              f.name
                ? "Identified as " + f.name + ". Tap to correct."
                : "Unidentified face" + (f.guess ? ", guessed as " + f.guess : "") + ". Tap to name."
            }
            hitSlop={10}
            style={[
              styles.faceMarker,
              {
                left: ((f.x * 100) + "%") as `${number}%`,
                top: ((f.y * 100) + "%") as `${number}%`,
              },
              f.name ? styles.faceMarkerNamed : styles.faceMarkerUnknown,
              active?.id === f.id && styles.faceMarkerActive,
            ]}
          >
            {/* A named face gets a real tick glyph, stroked slightly heavier so it
                survives at 16px on a photograph; the tick text character it
                replaces rendered at a different weight and size per platform.
                The question mark stays as type -- it is punctuation, not an icon,
                and it reads correctly everywhere. */}
            {f.name ? (
              <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={2.6} />
            ) : (
              <AppText variant="labelSm" bold color={colors.onSecondary}>?</AppText>
            )}
          </Pressable>
        ))}

        {/* Labels for faces that already have a name or a guess. */}
        <View style={styles.faceLabels}>
          {photo.faces.filter((f) => f.name || f.guess).map((f) => (
            <View key={f.id} style={[styles.faceLabel, f.name && styles.faceLabelNamed]}>
              <AppText
                variant="micro"
                color={f.name ? colors.onPrimaryFixedVariant : colors.onSurface}
                numberOfLines={1}
              >
                {f.name ?? f.guess}
              </AppText>
            </View>
          ))}
        </View>

        <View style={styles.photoCount}>
          {/* This counts, so tabular figures: "Photo 1 of 5" must not change
              width as you move through the box. */}
          <AppText variant="mono" color={colors.inverseOnSurface}>
            Photo 1 of {Math.max(1, photo.faces.length + 2)}
          </AppText>
        </View>
      </View>

      <View style={styles.faceBody}>
        {/* Was a phone emoji glued to the front of the string. The glyph carries
            that meaning now and the words stay words. */}
        <View style={styles.callingRow}>
          <Icon name="phone" size={14} color={colors.secondary} />
          <AppText
            variant="micro"
            color={colors.secondary}
            numberOfLines={2}
            style={styles.callingText}
          >
            {"Calling " + photo.askingNames.join(" or ")}
          </AppText>
        </View>

        <AppText variant="subtitle">
          {active
            ? active.name
              ? "Correct the name for " + active.name + "?"
              : "Who is this" + (active.guess ? " (" + active.guess + ")" : "") + "?"
            : photo.question}
        </AppText>

        {!active && photo.detail ? (
          <AppText variant="body">{photo.detail}</AppText>
        ) : null}

        {/* Flat: a nested card that also cast a shadow would read as a loose
            panel resting on this one rather than as part of it. */}
        <Card tone="low" elevation="flat" style={styles.answerBox}>
          <AppText variant="micro">
            {active ? "Speak or type their name" : "Speak your memory aloud: no typing needed"}
          </AppText>

          <Button
            title="Record Voice Memory"
            icon="voice"
            kind="secondary"
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
          />

          {active ? (
            <View style={styles.nameRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type their name…"
                placeholderTextColor={colors.outline}
                style={styles.nameInput}
                autoFocus
                onSubmitEditing={submit}
                accessibilityLabel="Type the name of this person"
              />
              <Button title="Save" onPress={submit} disabled={!draft.trim()} />
            </View>
          ) : (
            <View style={styles.answerAlt}>
              {/* Outlined, not grey-filled. Typing is the deliberately quieter
                  path here, and an outline says "available" where a grey fill
                  says "disabled" to anyone who is not looking closely. */}
              <Chip
                label="Type Name Instead"
                icon="edit"
                tone="outline"
                onPress={() => setActive(photo.faces.find((f) => !f.name) ?? null)}
              />
              {/* Passing it on is a real answer: the point is to reach whoever
                  actually knows, not to force a guess out of whoever happens to
                  be holding the phone. The arrow that used to live inside this
                  label is a share glyph now, so the label is only words. */}
              <Chip
                label="Pass to Uncle Dave"
                tone="terracotta"
                icon="share"
                onPress={() => {}}
              />
            </View>
          )}

          {active ? (
            <Pressable
              onPress={() => { setActive(null); setDraft(""); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel naming this face"
              hitSlop={8}
              style={styles.cancel}
            >
              <AppText variant="micro">Cancel</AppText>
            </Pressable>
          ) : null}
        </Card>

        {/* The clues used to hang below a top hairline; they are a tinted flat
            panel now, which groups them as one thread of replies instead of
            fencing them off from the question they answer. */}
        {photo.clues.length > 0 ? (
          <Card tone="container" elevation="flat" style={styles.clues}>
            <AppText variant="micro">Family clues shared ({photo.clues.length})</AppText>
            {photo.clues.map((c, i) => (
              <View key={i} style={styles.clue}>
                <View style={styles.clueBadge}>
                  <AppText variant="micro" color={colors.onPrimary}>
                    {c.authorName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </AppText>
                </View>
                <View style={styles.clueText}>
                  <AppText variant="micro" color={colors.onSurface}>
                    {c.authorName} ({c.whenText})
                  </AppText>
                  <AppText variant="small" numberOfLines={2}>
                    {"\u201C" + c.body + "\u201D"}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Face marker diameter. Deliberately below the touch floor so a marker never
 * covers the face it points at -- the 10pt hitSlop above carries it past 48.
 */
const MARKER = 32;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  section: { gap: spacing.md },

  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    minHeight: TOUCH_MIN, paddingHorizontal: spacing.md - 2,
    // A pill, like every other control in the app.
    borderRadius: radii.pill, borderWidth: 1,
  },
  tabLabel: { flexShrink: 1 },
  /** Selected: forest fill with its own soft lift, so it sits above its sibling. */
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.card },
  /** Unselected: outlined, never a grey fill -- Chip's filter pattern. */
  tabOff: { backgroundColor: "transparent", borderColor: colors.borderStrong },
  tabCount: {
    minWidth: 26, paddingHorizontal: spacing.xs + 2, paddingVertical: 2,
    borderRadius: radii.pill, backgroundColor: colors.surfaceContainer,
    alignItems: "center", justifyContent: "center",
  },
  tabCountOn: { backgroundColor: colors.primaryContainer },
  tabCountUrgent: { backgroundColor: colors.secondary },
  tabCountText: { textAlign: "center" },

  recipeHero: { position: "relative" },
  recipePhoto: { width: "100%", height: 232, backgroundColor: colors.surfaceContainer },
  traditionTag: {
    position: "absolute", top: spacing.sm + 2, left: spacing.sm + 2,
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 1,
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    ...shadow.card,
  },
  cardInset: {
    position: "absolute", right: spacing.sm + 2, bottom: spacing.sm + 2,
    width: 108, borderRadius: radii.inner, overflow: "hidden",
    // This white edge is a photo-corner mount, not a card hairline.
    borderWidth: 2, borderColor: colors.surfaceLowest,
    ...shadow.raised,
  },
  cardInsetPhoto: { width: "100%", height: 62, backgroundColor: colors.surfaceHighest },
  cardInsetLabel: {
    backgroundColor: colors.inverseSurface,
    paddingHorizontal: spacing.xs + 2, paddingVertical: 3,
  },

  recipeBody: { padding: spacing.md + 2, gap: spacing.md },
  recipeMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  expandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: TOUCH_MIN, gap: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radii.inner, backgroundColor: colors.surfaceLow,
  },
  expandLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  method: { gap: spacing.xs },
  methodHead: { marginTop: spacing.sm },
  methodItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  methodLine: { flex: 1, minWidth: 0 },
  bullet: {
    width: spacing.xs + 1, height: spacing.xs + 1, borderRadius: radii.pill,
    backgroundColor: colors.primaryFixedDim,
    // Sits on the first line's optical centre rather than at its cap height.
    marginTop: spacing.sm + 2,
  },
  stepNumber: { minWidth: spacing.md, textAlign: "right" },
  recipeActions: { flexDirection: "row", gap: spacing.sm },

  printRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm,
    minHeight: ROW_MIN,
    // A tonal band separates the offer from the recipe. A top hairline was the
    // old way of doing that job, and it cut the card into strips.
    backgroundColor: colors.surfaceLow,
  },
  printLabel: { flex: 1, minWidth: 0 },

  heirloomRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md - 2,
    minHeight: ROW_MIN, padding: spacing.sm,
    borderRadius: radii.inner, backgroundColor: colors.surfaceLow,
  },
  heirloomThumb: {
    width: 52, height: 52, borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
  },
  heirloomText: { flex: 1, gap: 2, minWidth: 0 },

  race: { gap: spacing.sm },
  raceTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  raceTitle: { flex: 1 },

  provenanceRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm - 2,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2,
  },
  provenanceText: { flexShrink: 1 },
  facePhotoWrap: { position: "relative" },
  facePhoto: { width: "100%", height: 300, backgroundColor: colors.surfaceContainer },
  faceMarker: {
    position: "absolute",
    width: MARKER, height: MARKER, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    // The ring is a cut-out edge against the photograph, and the shadow is what
    // lifts the marker off it -- neither is card chrome.
    borderWidth: 2, borderColor: colors.surfaceLowest,
    ...shadow.card,
    // Centre the marker on its coordinate rather than hanging off it.
    marginLeft: -MARKER / 2, marginTop: -MARKER / 2,
  },
  faceMarkerUnknown: { backgroundColor: colors.secondary },
  faceMarkerNamed: { backgroundColor: colors.primaryContainer },
  faceMarkerActive: { borderColor: colors.tertiaryFixedDim, borderWidth: 3 },
  faceLabels: {
    position: "absolute", left: spacing.sm + 2, bottom: spacing.sm + 2,
    flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2, maxWidth: "70%",
  },
  faceLabel: {
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  faceLabelNamed: { backgroundColor: colors.primaryFixed },
  photoCount: {
    position: "absolute", right: spacing.sm + 2, bottom: spacing.sm + 2,
    backgroundColor: colors.inverseSurface,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },

  faceBody: { padding: spacing.md + 2, gap: spacing.sm },
  callingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  callingText: { flexShrink: 1 },
  answerBox: { gap: spacing.sm, marginTop: spacing.xs },
  answerAlt: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameInput: {
    flex: 1, minHeight: INPUT_MIN,
    // Filled rather than outlined: the field reads as a place to type because it
    // is recessed into the panel, not because it is fenced with a 1.5px rule.
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: spacing.md,
    fontSize: type.bodyMd.fontSize, fontFamily: fonts.sans, color: colors.onSurface,
  },
  cancel: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },

  clues: { gap: spacing.sm, marginTop: spacing.xs },
  clue: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  clueBadge: {
    width: 28, height: 28, borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
    alignItems: "center", justifyContent: "center",
  },
  clueText: { flex: 1, gap: 1, minWidth: 0 },
});
