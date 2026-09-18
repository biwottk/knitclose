/**
 * Shared browser-driving helpers for the dev-only screenshot harnesses.
 *
 * WHY THIS EXISTS: both harnesses independently got two things wrong, and the
 * combination let a real crash ship as a clean "done".
 *
 * 1. SCROLLING. react-native-web renders <ScrollView> as a nested div with
 *    `overflow: auto`; the document itself never scrolls, so `window.scrollTo`
 *    is a silent no-op and `window.scrollY` stays 0. Every "-scrolled" capture
 *    was therefore byte-identical to its unscrolled twin, and nothing below the
 *    fold was ever actually verified.
 *
 * 2. ERROR REPORTING. Page errors were printed but never affected the exit code,
 *    so a harness that rendered a red error screen still exited 0. A visual check
 *    that cannot fail is not a check.
 */

/**
 * Scroll the app's real scroll container (not the document) and settle.
 *
 * The container is found by HIT-TESTING the middle of the viewport rather than by
 * querying the tree, because a bottom-tab navigator keeps every visited tab
 * mounted: after touring the app there are five live ScrollViews in the DOM, all
 * reporting `visibility: visible` with a non-zero box. Selecting by tree order or
 * by height therefore scrolls a screen the camera is not pointed at, which is a
 * silent no-op in exactly the same way the original `window.scrollTo` was.
 * `elementFromPoint` can only return what is genuinely painted on top.
 */
export async function scrollTo(page, y) {
  const applied = await page.evaluate((target) => {
    const isScrollable = (e) => {
      const oy = getComputedStyle(e).overflowY;
      return (oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 4;
    };
    const cx = Math.round(window.innerWidth / 2);
    // Several probe depths: the centre of the screen may land on a card, a modal
    // scrim, or a gap between sections.
    for (const frac of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      let el = document.elementFromPoint(cx, Math.round(window.innerHeight * frac));
      while (el) {
        if (isScrollable(el)) {
          el.scrollTop = target;
          return { requested: target, actual: el.scrollTop, max: el.scrollHeight - el.clientHeight };
        }
        el = el.parentElement;
      }
    }
    return null;
  }, y);

  if (applied === null) {
    // Not fatal: a short screen legitimately has nothing to scroll.
    if (y > 0) console.log(`   (no scroll container; y=${y} skipped)`);
  } else if (applied.requested > applied.actual) {
    // Two captures at different requested offsets that both clamp to the bottom
    // produce identical images, which reads as a passing check of content that was
    // never actually framed. Say so.
    console.log(`   (scroll clamped: asked ${applied.requested}, got ${applied.actual} of ${applied.max})`);
  }
  await new Promise((r) => setTimeout(r, 700));
  return applied;
}

/**
 * Scroll to a fraction of the screen's own scrollable range (0 = top, 1 = bottom).
 * Screens differ in length, so fixed pixel offsets either clamp on short screens or
 * miss the lower half of long ones.
 */
export async function scrollToFraction(page, frac) {
  const max = await page.evaluate(() => {
    const isScrollable = (e) => {
      const oy = getComputedStyle(e).overflowY;
      return (oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 4;
    };
    const cx = Math.round(window.innerWidth / 2);
    for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      let el = document.elementFromPoint(cx, Math.round(window.innerHeight * f));
      while (el) {
        if (isScrollable(el)) return el.scrollHeight - el.clientHeight;
        el = el.parentElement;
      }
    }
    return 0;
  });
  return scrollTo(page, Math.round(max * frac));
}

/**
 * Collect page errors so the caller can exit non-zero.
 *
 * The React Native Web build is noisy with deprecation warnings that are not
 * defects in this app, so those are filtered out; anything else counts.
 */
const IGNORED = [
  '"shadow*" style props are deprecated',
  "props.pointerEvents is deprecated",
  "useNativeDriver",
  "Download the React DevTools",
];

/**
 * Warnings that indicate a real defect and must fail the run. `Icon` now falls back
 * to a placeholder rather than crashing the screen, which is right for the user but
 * means a bad icon name would otherwise pass a visual check unnoticed -- it is only
 * one wrong 20px glyph in a screenshot. Promoting the warning keeps the safety net
 * from becoming a way to ship mistakes.
 */
const FATAL_WARNINGS = ["is not in the icon map"];

export function watchForErrors(page) {
  const errors = [];
  const note = (kind, text) => {
    if (IGNORED.some((i) => text.includes(i))) return;
    errors.push(`${kind}: ${text}`);
    console.log(`${kind}: ${text.slice(0, 400)}`);
  };
  page.on("pageerror", (e) => note("PAGEERROR", e.message));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error") note("CONSOLE ERROR", text);
    else if (FATAL_WARNINGS.some((w) => text.includes(w))) note("ICON WARNING", text);
  });
  return errors;
}

/**
 * Assert the app actually mounted. A blank or error-screen capture otherwise
 * looks like a successful shot.
 */
export async function assertRendered(page) {
  const text = await page.evaluate(() => document.body.innerText ?? "");
  if (text.trim().length < 20) throw new Error("app rendered no visible text -- blank screen");
  for (const marker of ["Uncaught Error", "Element type is invalid", "Unexpected text node"]) {
    if (text.includes(marker)) throw new Error(`error screen rendered: ${marker}`);
  }
}

/**
 * Run the body of a harness, guaranteeing the browser is closed even when a check
 * throws. Without this a failed assertion leaks a headless Chrome per run.
 */
export async function withBrowser(browser, body) {
  try {
    await body();
  } catch (err) {
    console.log("\nFAILED --", err.message);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

/** Report collected errors and exit non-zero if any were seen. */
export function finish(errors, outDir) {
  if (errors.length) {
    console.log(`\nFAILED -- ${errors.length} page error(s):`);
    for (const e of [...new Set(errors)]) console.log("  -", e.slice(0, 300));
    process.exit(1);
  }
  console.log("done ->", outDir);
}
