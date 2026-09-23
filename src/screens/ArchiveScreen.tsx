import React from "react";
import {
  Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, TextInput, View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";
import { Card } from "../components/Card";
import { AppText } from "../components/Text";
import { Chip } from "../components/Chip";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { Icon, IconBadge, type IconName } from "../components/Icon";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { VoiceNote } from "../components/VoiceNote";
import {
  colors, fonts, INPUT_MIN, motion, PRESSED_OPACITY, radii, ROW_MIN, shadow,
  spacing, TOUCH_MIN, type,
} from "../theme";
import { useStore } from "../store";
import { LETTER_KIND_LABEL, OBJECT_KIND_LABEL, OBJECT_STATUS_LABEL } from "../types";
import type {
  ArchivePhoto, FaceTag, FamilyObject, Letter, Recipe, VoiceRecording,
} from "../types";

/**
 * The Archive holds HEIRLOOMS: objects a family goes looking for deliberately, months
 * later. That test is what decides what belongs here -- a recipe and a letter pass it, an
 * event does not (it belongs with deeds), and a will does not (it belongs beside Care's
 * emergency card, because its purpose is retrieval under stress). See
 * docs/archive_contents.md.
 */
type Tab = "recipes" | "letters" | "voices" | "objects" | "faces";

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
  onOpenProfile, onAddRecipe, onAddLetter, onAddObject, onOpenChat,
}: {
  onOpenProfile: () => void;
  onAddRecipe: () => void;
  onAddLetter: () => void;
  onAddObject: () => void;
  /** The voice vault is fed from Chat, so its empty state points there. */
  onOpenChat: () => void;
}) {
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
        {/*
          Four sections no longer fit as equal-width pills, so the row scrolls. Kept as one
          horizontal strip rather than a 2x2 grid: a grid of four reads as a menu of
          separate features, whereas a strip reads as "parts of one archive", which is what
          they are.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabScroller}
        >
          <ArchiveTab
            label="Recipe Box"
            icon="recipe"
            count={store.recipes.length}
            selected={tab === "recipes"}
            onPress={() => setTab("recipes")}
          />
          <ArchiveTab
            label="Letter Box"
            icon="note"
            count={store.letters.length}
            selected={tab === "letters"}
            onPress={() => setTab("letters")}
          />
          <ArchiveTab
            label="Voices"
            icon="voice"
            count={store.voices.length}
            selected={tab === "voices"}
            onPress={() => setTab("voices")}
          />
          <ArchiveTab
            label="Objects"
            icon="box"
            count={store.objects.length}
            selected={tab === "objects"}
            onPress={() => setTab("objects")}
            // Something the family has lost track of is a live question, not an archive
            // entry, so the tab flags it the same way unnamed faces are flagged.
            urgent={store.objects.some((o) => o.status === "lost")}
          />
          <ArchiveTab
            label="Who Is This?"
            icon="search"
            count={unnamed}
            selected={tab === "faces"}
            onPress={() => setTab("faces")}
            urgent
          />
        </ScrollView>

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
        ) : tab === "letters" ? (
          store.letters.length > 0 ? (
            <LetterBox letters={store.letters} />
          ) : (
            /*
             * A letter box is the strongest thing a family can add after recipes: the
             * bundle exists in a drawer, it is physically decaying, and nobody has ever
             * been able to search it. The copy names the decay, because that is the reason
             * to act today rather than eventually.
             */
            <EmptyState
              icon="note"
              title="The letter box is empty"
              body={
                "Photograph the letters and cards before the ink goes. Type out what they " +
                "say and they become searchable forever -- and the handwriting is kept " +
                "either way, because that is the part that is really theirs."
              }
              actionLabel="Add the first letter"
              onAction={onAddLetter}
            />
          )
        ) : tab === "objects" ? (
          store.objects.length > 0 ? (
            <ObjectShelf objects={store.objects} onAddObject={onAddObject} />
          ) : (
            /*
             * The empty state leads with the question the feature answers rather than with
             * what it stores. "Where did the ring go" is a real thing families ask, and
             * naming it is what makes somebody realise this is worth filling in.
             */
            <EmptyState
              icon="box"
              title="No objects yet"
              body={
                "The ring, the clock, the toolbox. Photograph them and record who has each " +
                "one -- then nobody has to ask where something went, and the passing-on is " +
                "written down while everyone still remembers it."
              }
              actionLabel="Add the first object"
              onAction={onAddObject}
            />
          )
        ) : tab === "voices" ? (
          <VoiceVault
            voices={store.voices}
            openPrompts={store.openPrompts}
            onOpenChat={onOpenChat}
          />
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
          <Button title="Preview · Cook This Sunday" icon="meal" fill onPress={() => previewArchive("Meal planning from recipes")}/>
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
        accessibilityLabel="Preview of keepsake print ordering, four pounds fifty"
        onPress={() => previewArchive("Keepsake print ordering")}
        style={({ pressed }) => [styles.printRow, pressed && { opacity: PRESSED_OPACITY }]}
      >
        <IconBadge name="box" size={32} tone="paper" />
        <AppText variant="small" color={colors.onSurfaceVariant} style={styles.printLabel}>
          Preview · Keepsake Print Card (£4.50)
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
        actionLabel={"Preview · View All " + total}
        onAction={() => previewArchive("The complete heirloom shelf")}
      />

      {recipes.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={r.title + ". " + r.provenance}
          onPress={() => previewArchive("Opening this heirloom")}
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
            title="Preview · Record Voice Memory"
            icon="voice"
            kind="secondary"
            onPress={() => previewArchive("Voice clues for unidentified photographs")}
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
                label="Preview · Pass to Uncle Dave"
                tone="terracotta"
                icon="share"
                onPress={() => previewArchive("Passing a photo-identification question to a relative")}
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


// ---------------------------------------------------------------------------
// The Letter Box
// ---------------------------------------------------------------------------

/**
 * Letters, oldest first.
 *
 * THE PHOTOGRAPH LEADS. A letter is an object before it is text: the handwriting, the
 * paper, the way she crossed her sevens are the parts that are really hers, and the typed
 * transcript is a convenience for reading and searching. Leading with the transcript would
 * turn an heirloom into a database row.
 */
function LetterBox({ letters }: { letters: Letter[] }) {
  return (
    <>
      <SectionHeader
        title="In their own hand"
        compact
        icon="note"
        action={letters.length + (letters.length === 1 ? " letter" : " letters")}
      />
      {letters.map((l) => (
        <LetterCard key={l.id} letter={l} />
      ))}
    </>
  );
}

function LetterCard({ letter }: { letter: Letter }) {
  const { actions } = useStore();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(letter.transcript ?? "");
  const [editing, setEditing] = React.useState(false);

  const image = letter.imageUri ?? letter.pages[0]?.uri;

  return (
    <Card padded={false} feature style={styles.letterCard}>
      {image ? (
        <Image source={{ uri: image }} style={styles.letterImage} accessibilityLabel={letter.title} />
      ) : null}

      <View style={styles.letterBody}>
        <View style={styles.letterMeta}>
          <Chip label={LETTER_KIND_LABEL[letter.kind]} tone="mint" icon="note" />
          {letter.whenText ? (
            <AppText variant="micro" color={colors.secondary}>{letter.whenText}</AppText>
          ) : null}
        </View>

        <AppText variant="subtitle">{letter.title}</AppText>

        {/* Who wrote it and who it was for -- the two facts that make a letter make sense. */}
        {letter.fromName || letter.toName ? (
          <AppText variant="small" color={colors.onSurfaceVariant}>
            {letter.fromName ? "From " + letter.fromName : ""}
            {letter.fromName && letter.toName ? "  ·  " : ""}
            {letter.toName ? "To " + letter.toName : ""}
          </AppText>
        ) : null}

        {letter.transcript ? (
          <>
            {/*
              An UNCONFIRMED transcript is labelled as a draft to be checked, never shown as
              her words. This is the human-in-the-loop rule the product applies everywhere:
              a machine reading of somebody handwriting is a guess, and presenting a guess as
              a dead relative speech is the fabrication line the product refuses to cross.
            */}
            {!letter.transcriptConfirmed ? (
              <View style={styles.draftFlag}>
                <Icon name="info" size={14} color={colors.onTertiaryFixedVariant} />
                <AppText variant="micro" color={colors.onTertiaryFixedVariant}>
                  Not checked yet -- read it against the original
                </AppText>
              </View>
            ) : null}

            {editing ? (
              <>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  style={styles.transcriptInput}
                  accessibilityLabel="Transcription"
                />
                <View style={styles.letterActions}>
                  <Button
                    title="Save and confirm"
                    small
                    icon="check"
                    onPress={async () => {
                      await actions.confirmTranscript(letter.id, draft);
                      setEditing(false);
                    }}
                  />
                  <Button title="Cancel" kind="quiet" small onPress={() => setEditing(false)} />
                </View>
              </>
            ) : (
              <>
                {/*
                  Set in the serif italic used everywhere for the family own words, so a
                  transcription never reads as our copy.
                */}
                <AppText
                  variant="quote"
                  numberOfLines={open ? undefined : 4}
                  style={styles.transcript}
                >
                  {letter.transcript}
                </AppText>
                <View style={styles.letterActions}>
                  <Button
                    title={open ? "Show less" : "Read it all"}
                    kind="quiet"
                    small
                    icon={open ? "chevronUp" : "chevronDown"}
                    onPress={() => setOpen((o) => !o)}
                  />
                  <Button
                    title={letter.transcriptConfirmed ? "Fix a word" : "Check it"}
                    kind="outline"
                    small
                    icon="edit"
                    onPress={() => { setDraft(letter.transcript ?? ""); setEditing(true); }}
                  />
                </View>
              </>
            )}
          </>
        ) : (
          /*
           * No transcript at all. Worth offering plainly: a letter nobody has typed up is
           * unsearchable, and in fifty years it may also be unreadable.
           */
          <Button
            title="Type out what it says"
            kind="tonal"
            small
            icon="edit"
            onPress={() => { setDraft(""); setEditing(true); }}
          />
        )}

        {/* An elder reading it aloud: the words in a living voice that knew the writer. */}
        {letter.reading ? (
          <VoiceNote audio={letter.reading} label="Read aloud" />
        ) : null}

        {letter.provenance || letter.heldByName ? (
          <View style={styles.provenance}>
            <Icon name="box" size={13} color={colors.onSurfaceFaint} />
            <AppText variant="micro" color={colors.onSurfaceFaint} style={{ flexShrink: 1 }}>
              {[letter.provenance, letter.heldByName ? "Held by " + letter.heldByName : null]
                .filter(Boolean).join("  ·  ")}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// The Voice Vault
// ---------------------------------------------------------------------------

/**
 * Recordings somebody chose to keep.
 *
 * ideas.md is explicit that a voice note IS a primary source. The material already exists
 * -- it is being produced in Chat every day -- and the only problem is that a feed loses it.
 * So this section is a shelf, plus the thing that makes a shelf fill up: a question to ask.
 */
function VoiceVault({
  voices, openPrompts, onOpenChat,
}: { voices: VoiceRecording[]; openPrompts: string[]; onOpenChat: () => void }) {
  return (
    <>
      {/*
        THE PROMPT COMES FIRST, even when the vault is full.

        A family that does not know what to ask records nothing, and "tell me about your
        life" gets silence. These questions are deliberately about ordinary life, because
        "what did the house smell like" gets a five-minute answer.
      */}
      {openPrompts.length > 0 ? (
        <Card tone="alert" feature style={styles.promptCard}>
          <SectionHeader title="Ask them this" icon="listen" compact />
          <AppText variant="story" style={styles.promptText}>
            {openPrompts[0]}
          </AppText>
          <AppText variant="small" color={colors.onSecondaryFixedVariant}>
            Record the answer in Chat and keep it here. Their voice is the part that cannot
            be written down.
          </AppText>
          <Button
            title="Ask in the family chat"
            kind="secondary"
            icon="voice"
            onPress={onOpenChat}
          />
        </Card>
      ) : null}

      {voices.length === 0 ? (
        <EmptyState
          icon="voice"
          title="No voices kept yet"
          body={
            "Voice notes in Chat scroll away. Anything kept here stays findable forever -- " +
            "and a recording of how somebody actually spoke is the one thing a written " +
            "archive can never recover."
          }
          actionLabel="Record one in Chat"
          onAction={onOpenChat}
        />
      ) : (
        <>
          <SectionHeader
            title="Kept voices"
            compact
            icon="voice"
            action={voices.length + (voices.length === 1 ? " recording" : " recordings")}
          />
          {voices.map((v) => (
            <Card key={v.id} style={styles.voiceCard}>
              <View style={styles.voiceHead}>
                <IconBadge name="voice" size={40} tone="paper" />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{v.speakerName}</AppText>
                  <AppText variant="small" color={colors.onSurfaceVariant}>
                    {v.title}
                  </AppText>
                </View>
              </View>

              {/*
                The QUESTION is kept beside the answer. In fifty years nobody will remember
                what was asked, and an answer without its question is half a record.
              */}
              {v.prompt ? (
                <View style={styles.askedRow}>
                  <Icon name="quote" size={13} color={colors.onSurfaceFaint} />
                  <AppText variant="micro" color={colors.onSurfaceFaint} style={{ flexShrink: 1 }}>
                    Asked: {v.prompt}
                  </AppText>
                </View>
              ) : null}

              {/*
                The transcript rides along: it is what makes a recording searchable, and
                ideas.md calls transcription the single highest-value AI feature here.
              */}
              <VoiceNote
                audio={v.audio}
                label={v.whenText ?? undefined}
                transcript={v.audio.transcript}
              />
            </Card>
          ))}
        </>
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// Objects & Heirlooms
// ---------------------------------------------------------------------------

/**
 * The shelf.
 *
 * Lost things come first (the server orders them that way): an object nobody can find is
 * the only entry here that is still a live question, and burying it below the ones safely
 * in a drawer gets the priority exactly backwards.
 */
function ObjectShelf({
  objects, onAddObject,
}: { objects: FamilyObject[]; onAddObject: () => void }) {
  const lost = objects.filter((o) => o.status === "lost").length;

  return (
    <>
      <SectionHeader
        title="Things we have kept"
        compact
        icon="box"
        action={objects.length + (objects.length === 1 ? " object" : " objects")}
      />

      {/*
        Stated once at the top rather than repeated on each card: the family needs to know
        there is an open question, not be reminded of it five times.
      */}
      {lost > 0 ? (
        <Card tone="alert" style={styles.lostBanner}>
          <Icon name="alert" size={16} color={colors.onSecondaryFixedVariant} />
          <AppText variant="small" color={colors.onSecondaryFixedVariant} style={{ flexShrink: 1 }}>
            {lost === 1
              ? "One object has gone missing. Somebody may remember where it went."
              : lost + " objects have gone missing. Somebody may remember where they went."}
          </AppText>
        </Card>
      ) : null}

      {objects.map((o) => <ObjectCard key={o.id} object={o} />)}

      <Button
        title="Add another object"
        kind="outline"
        icon="add"
        onPress={onAddObject}
        style={styles.shelfAdd}
      />
    </>
  );
}

function ObjectCard({ object }: { object: FamilyObject }) {
  const { people, actions } = useStore();
  const [openChain, setOpenChain] = React.useState(false);
  const [handing, setHanding] = React.useState(false);
  const [toPersonId, setToPersonId] = React.useState<string | undefined>();
  const [note, setNote] = React.useState("");

  const image = object.imageUri ?? object.photos[0]?.uri;
  const lost = object.status === "lost";

  return (
    <Card padded={false} feature style={styles.objectCard}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.objectImage}
          accessibilityLabel={object.name}
        />
      ) : null}

      <View style={styles.objectBody}>
        <View style={styles.objectMeta}>
          <Chip label={OBJECT_KIND_LABEL[object.kind]} tone="mint" icon="box" />
          {object.originYear ? (
            <AppText variant="micro" color={colors.secondary}>{object.originYear}</AppText>
          ) : null}
        </View>

        <AppText variant="subtitle">{object.name}</AppText>

        {/*
          WHO HAS IT, given the most prominent line after the name.

          This is the whole reason the section exists, so it is not buried in a metadata row.
          When the answer is "nobody knows" it says so plainly in the error tone, because a
          vague absence is what lets an object quietly disappear from a family.
        */}
        <View style={[styles.holderRow, lost && styles.holderRowLost]}>
          <Icon
            name={lost ? "alert" : "people"}
            size={15}
            color={lost ? colors.onErrorContainer : colors.primary}
          />
          <AppText
            variant="label"
            color={lost ? colors.onErrorContainer : colors.onSurface}
            style={{ flexShrink: 1 }}
          >
            {object.status === "held" && object.heldByName
              ? object.heldByName + " has it"
              : OBJECT_STATUS_LABEL[object.status]}
          </AppText>
        </View>

        {/* The detail that actually finds a thing in a house. */}
        {object.whereKept && !lost ? (
          <AppText variant="small" color={colors.onSurfaceVariant}>
            Kept in {object.whereKept}
          </AppText>
        ) : null}

        {object.statusNote ? (
          <AppText variant="small" color={colors.onSurfaceVariant}>{object.statusNote}</AppText>
        ) : null}

        {object.story ? (
          <AppText variant="quote" numberOfLines={openChain ? undefined : 3}>
            {object.story}
          </AppText>
        ) : null}

        {object.originPersonName ? (
          <View style={styles.askedRow}>
            <Icon name="leaf" size={13} color={colors.onSurfaceFaint} />
            <AppText variant="micro" color={colors.onSurfaceFaint} style={{ flexShrink: 1 }}>
              Originally {object.originPersonName}
              {object.originText ? "  \u00b7  " + object.originText : ""}
            </AppText>
          </View>
        ) : null}

        {/*
          THE CUSTODY CHAIN.

          Collapsed by default, because most of the time you want to know who has it now.
          Expanded it reads as a provenance, which is precisely what separates an heirloom
          from a merely old thing -- two entries is already a story: Grandma, then Sarah.
        */}
        {object.custody.length > 1 ? (
          <>
            <Button
              title={openChain
                ? "Hide who has had it"
                : "Who has had it (" + object.custody.length + ")"}
              kind="quiet"
              small
              icon={openChain ? "chevronUp" : "chevronDown"}
              onPress={() => setOpenChain((o) => !o)}
            />
            {openChain ? (
              <View style={styles.chain}>
                {object.custody.map((c, i) => (
                  <View key={c.id} style={styles.chainRow}>
                    {/* A rail with a dot per holder: a handover is a sequence. */}
                    <View style={styles.chainRail}>
                      <View style={styles.chainDot} />
                      {i < object.custody.length - 1 ? (
                        <View style={styles.chainLine} />
                      ) : null}
                    </View>
                    <View style={styles.chainText}>
                      <AppText variant="label">{c.holderName}</AppText>
                      {c.fromText ? (
                        <AppText variant="micro" color={colors.onSurfaceFaint}>
                          {c.fromText}
                        </AppText>
                      ) : null}
                      {c.note ? (
                        <AppText variant="small" color={colors.onSurfaceVariant}>
                          {c.note}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {/*
          Handing it on, inline.

          A separate screen would be wrong: this happens at a kitchen table while somebody is
          holding the thing, and the cost of recording it has to be near zero or it never gets
          recorded at all.
        */}
        {handing ? (
          <View style={styles.handOn}>
            <AppText variant="label">Who has it now?</AppText>
            <View style={styles.choices}>
              {people.map((p) => {
                const on = toPersonId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setToPersonId(on ? undefined : p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={p.name}
                    style={[styles.choice, on && styles.choiceOn]}
                  >
                    <Avatar person={p} size={22} />
                    <AppText
                      variant="labelSm"
                      color={on ? colors.onPrimary : colors.onSurface}
                    >
                      {p.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="How did it come to them?"
              placeholderTextColor={colors.outline}
              accessibilityLabel="How did it come to them?"
              style={styles.handOnInput}
            />

            <View style={styles.letterActions}>
              <Button
                title="Record the handover"
                small
                icon="check"
                disabled={!toPersonId}
                onPress={async () => {
                  await actions.handOnObject(object.id, {
                    personId: toPersonId,
                    note: note.trim() || undefined,
                  });
                  setHanding(false);
                  setNote("");
                  setToPersonId(undefined);
                }}
              />
              <Button
                title="Cancel"
                kind="quiet"
                small
                onPress={() => setHanding(false)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.letterActions}>
            <Button
              title="Hand it on"
              kind="outline"
              small
              icon="handshake"
              onPress={() => setHanding(true)}
            />
            {/*
              Reversing "lost" needs no separate control: the server clears it on any
              handover, because somebody holding a thing is proof it was found.
            */}
            {lost ? null : (
              <Button
                title="It has gone missing"
                kind="quiet"
                small
                icon="alert"
                onPress={() => void actions.setObjectStatus(object.id, "lost")}
              />
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

function previewArchive(feature: string) {
  Alert.alert("Preview", feature + " is planned but is not available yet. Nothing will be changed or ordered.");
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  section: { gap: spacing.md },
  tabScroller: { flexGrow: 0, marginHorizontal: -spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md },

  // -- The Letter Box ------------------------------------------------------
  letterCard: { marginTop: spacing.md },
  /**
   * A generous fixed height rather than an aspect ratio: letters are photographed at every
   * conceivable angle, and a uniform band keeps a list of them looking like a collection
   * instead of a ransom note.
   */
  letterImage: { width: "100%", height: 190 },
  letterBody: { padding: spacing.md, gap: spacing.sm },
  letterMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  transcript: { marginTop: 2 },
  transcriptInput: {
    minHeight: 140,
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    fontSize: type.bodyMd.fontSize,
    // Serif: the family's words, even while being corrected.
    fontFamily: fonts.serif,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  draftFlag: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    backgroundColor: colors.tertiaryFixed,
    borderRadius: radii.pill,
    paddingVertical: 4, paddingHorizontal: spacing.sm + 2,
    alignSelf: "flex-start",
  },
  letterActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  provenance: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },

  // -- Objects & Heirlooms -------------------------------------------------
  lostBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginTop: spacing.md,
  },
  objectCard: { marginTop: spacing.md },
  objectImage: { width: "100%", height: 200 },
  objectBody: { padding: spacing.md, gap: spacing.sm },
  objectMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  /** Who has it, in its own tinted row: it is the answer people came for. */
  holderRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.primaryFixed,
    borderRadius: radii.inner,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm + 2,
  },
  holderRowLost: { backgroundColor: colors.errorContainer },
  chain: { marginTop: spacing.xs },
  chainRow: { flexDirection: "row", gap: spacing.sm + 2 },
  chainRail: { width: 12, alignItems: "center" },
  chainDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.primary,
    // Optical alignment with the holder name's cap height.
    marginTop: 5,
  },
  chainLine: { flex: 1, width: 2, backgroundColor: colors.primaryFixed, marginVertical: 2 },
  chainText: { flex: 1, gap: 1, paddingBottom: spacing.md },
  handOn: { gap: spacing.sm, marginTop: spacing.xs },
  handOnInput: {
    minHeight: INPUT_MIN,
    borderRadius: radii.inner,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    fontSize: type.bodyMd.fontSize,
    fontFamily: fonts.sans,
    color: colors.onSurface,
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
  shelfAdd: { marginTop: spacing.md },

  // -- The Voice Vault ----------------------------------------------------
  promptCard: { gap: spacing.md, marginTop: spacing.md },
  /** The question is a pull-quote: it is the family's language, not our chrome. */
  promptText: { marginTop: 2 },
  voiceCard: { gap: spacing.sm, marginTop: spacing.md },
  voiceHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  askedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },

  // -- Restored from the pre-refactor file (recipes, face tagging, tab pills) --
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs + 2,
    minHeight: TOUCH_MIN, paddingHorizontal: spacing.md - 2,
    // A pill, like every other control in the app.
    borderRadius: radii.pill, borderWidth: 1,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.card },
  /** Unselected: outlined, never a grey fill -- Chip's filter pattern. */
  tabOff: { backgroundColor: "transparent", borderColor: colors.borderStrong },
  tabLabel: { flexShrink: 1 },
  /** Selected: forest fill with its own soft lift, so it sits above its sibling. */
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
  methodItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  bullet: {
    width: spacing.xs + 1, height: spacing.xs + 1, borderRadius: radii.pill,
    backgroundColor: colors.primaryFixedDim,
    // Sits on the first line's optical centre rather than at its cap height.
    marginTop: spacing.sm + 2,
  },
  methodLine: { flex: 1, minWidth: 0 },
  methodHead: { marginTop: spacing.sm },
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
  faceMarkerNamed: { backgroundColor: colors.primaryContainer },
  faceMarkerUnknown: { backgroundColor: colors.secondary },
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
  answerAlt: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cancel: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },

  clues: { gap: spacing.sm, marginTop: spacing.xs },
  clue: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  clueBadge: {
    width: 28, height: 28, borderRadius: radii.pill,
    backgroundColor: colors.primaryContainer,
    alignItems: "center", justifyContent: "center",
  },

  /** The clue's text column beside its author badge. minWidth:0 lets it truncate. */
  clueText: { flex: 1, gap: 1, minWidth: 0 },
});
