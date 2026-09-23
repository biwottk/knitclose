import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard, type KeyboardEvent, Platform, ScrollView, StyleSheet, TextInput, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, GUTTER, SCREEN_MARGIN, shadow, spacing } from "../theme";

/**
 * Standard screen frame: warm canvas, 20pt screen margin, 14pt gutter between
 * stacked cards, optional sticky footer for a primary action.
 *
 * SAFE AREA -- read this before changing it.
 *
 * A screen presented WITHOUT a navigation header sits directly under the status
 * bar (clock, battery, notch). Without a top inset its first line of text collides
 * with the clock. That is exactly what shipped once, and it is invisible in a
 * desktop browser because a browser viewport reports zero insets -- so it has to be
 * reasoned about, not just eyeballed on the web build. Append
 * `?insetTop=59&insetBottom=34` to the web URL to reproduce phone insets.
 *
 * Default is `insetTop` ON, because too much breathing room is a cosmetic nit
 * while a clipped title is a broken screen. Pass `insetTop={false}` only when a
 * React Navigation header or our own AppHeader already occupies that space.
 *
 * THE KEYBOARD -- read this before changing it too.
 *
 * Every "Add ..." form in the app puts its save button in the footer. Before this, the
 * keyboard simply covered that footer: a person typing a story could not see, let alone
 * reach, "Add to the archive", and there was no visible way to get the keyboard out of
 * the way. For the people this product is for, that reads as "the app is broken" and
 * the story does not get written down. So:
 *
 *  1. THE FOOTER RIDES ABOVE THE KEYBOARD. When the keyboard shows, the footer is lifted
 *     by exactly the amount the keyboard overlaps THIS screen -- measured, not assumed,
 *     because on iOS a modal sheet does not start at the top of the window and a fixed
 *     offset would be wrong by the header height. The primary action is therefore always
 *     on screen, typing or not.
 *
 *  2. THE FOCUSED FIELD IS SCROLLED CLEAR. The content is padded by the keyboard + footer
 *     height and the focused input is scrolled to sit just above them, so people can see
 *     what they are typing and can reach every field below it.
 *
 *  3. A DRAG DISMISSES THE KEYBOARD. `keyboardDismissMode="interactive"` (iOS) /
 *     `"on-drag"` gives the natural gesture, and taps on non-inputs go through.
 *
 * Implemented with Keyboard events rather than KeyboardAvoidingView because KAV pads
 * the whole screen and fights the scroll view; lifting only the footer and padding only
 * the content is smaller, and it is the behaviour iOS Messages and Notes have.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  insetTop = true,
  /** Extra bottom padding, e.g. to clear a floating composer. */
  bottomExtra = 0,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  /** A node, or a renderer that can return a compact keyboard accessory. */
  footer?: React.ReactNode | ((keyboardVisible: boolean) => React.ReactNode);
  insetTop?: boolean;
  bottomExtra?: number;
  /** Width/structure adaptation owned by a specific surface. */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** Where this screen starts in the window; a modal sheet or a header pushes it down. */
  const rootTop = useRef(0);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  /**
   * How much of the keyboard covers this screen, in this screen's coordinates.
   *
   * `measureInWindow` gives the root's absolute bottom; the keyboard's top comes from
   * the event. The difference is the only number that is right for a modal AND a full
   * screen AND a tablet, so nothing here hard-codes a header height.
   *
   * Measured one frame late on purpose: on Android the window itself may have been
   * resized for the keyboard by the time we look, in which case the root already ends
   * above it and the overlap is (correctly) zero -- lifting the footer as well would
   * double-compensate.
   */
  const onKeyboardChange = useCallback((e: KeyboardEvent | null) => {
    if (!e || e.endCoordinates.height === 0) { setKeyboardOverlap(0); return; }
    const keyboardTop = e.endCoordinates.screenY;
    requestAnimationFrame(() => {
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        rootTop.current = y;
        setKeyboardOverlap(Math.max(0, y + h - keyboardTop));
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    // iOS fires "will" events with the animation; Android only has "did".
    const show = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(show, onKeyboardChange);
    const b = Keyboard.addListener(hide, () => onKeyboardChange(null));
    return () => { a.remove(); b.remove(); };
  }, [onKeyboardChange]);

  /**
   * Bring whichever field is focused into view above the compact accessory.
   *
   * This must run in TWO situations: when the keyboard first opens, and whenever a
   * different field is tapped while it is already open. Only handling the first case is
   * why the device screenshot showed "When was it?" half-hidden under the old footer.
   */
  const revealFocusedField = useCallback(() => {
    if (!scroll || keyboardOverlap === 0) return;
    setTimeout(() => {
      const focused = TextInput.State.currentlyFocusedInput();
      if (!focused) return;
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        focused, footerHeight + rootTop.current + spacing.md, true,
      );
    }, 50);
  }, [scroll, keyboardOverlap, footerHeight]);

  useEffect(() => {
    if (keyboardOverlap === 0) return;
    revealFocusedField();
  }, [keyboardOverlap, revealFocusedField]);

  const keyboardVisible = keyboardOverlap > 0;
  const liftedFooter = Boolean(footer) && keyboardVisible;
  const footerContent = typeof footer === "function" ? footer(keyboardVisible) : footer;

  const topPad = insetTop ? { paddingTop: insets.top + spacing.sm } : null;
  // With a footer, the scroll view shrinks as the footer lifts (both are flex children of
  // the root), so the visible bottom IS the footer's top and nothing more is needed.
  // Without one, the keyboard covers the scroll view's tail, so pad it out instead.
  const bottomPad = {
    paddingBottom:
      spacing.xl + bottomExtra + (footer ? 0 : Math.max(insets.bottom, keyboardOverlap)),
  };

  return (
    <View ref={rootRef} style={styles.root}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, topPad, bottomPad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // Focus changes happen after the touch; reveal on the next frame via the helper.
          onTouchEnd={revealFocusedField}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, topPad, contentStyle]}>{children}</View>
      )}

      {footer ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={[
            styles.footer,
            liftedFooter && styles.keyboardFooter,
            {
              // While lifted, the home-indicator inset is under the keyboard, not us.
              paddingBottom: liftedFooter ? spacing.sm : Math.max(spacing.md, insets.bottom),
              // Lift by the measured overlap: the primary action stays reachable.
              marginBottom: liftedFooter ? keyboardOverlap : 0,
            },
          ]}
        >
          {footerContent}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.sm, gap: GUTTER },
  /**
   * The footer floats above the content on a shadow rather than being fenced off
   * by a top border -- the same change made everywhere else in the refresh.
   */
  footer: {
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: SCREEN_MARGIN,
    paddingTop: spacing.md,
    gap: spacing.sm,
    ...shadow.floating,
  },
  /** Keyboard state is an accessory strip, not a second modal covering the form. */
  keyboardFooter: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
