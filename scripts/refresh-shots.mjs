/**
 * Dev-only visual check for the 2020s UI refresh.
 *
 * Drives the Expo web build in headless Chrome at phone size WITH simulated device
 * safe-area insets, and captures the screens the refresh touched. A desktop viewport
 * reports zero insets, so status-bar collisions and home-indicator clipping are
 * invisible without this -- which is exactly how a clipped header shipped once.
 *
 *   node scripts/refresh-shots.mjs [baseUrl] [outDir]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { assertRendered, finish, scrollToFraction, watchForErrors, withBrowser } from "./lib-page.mjs";

const BASE = process.argv[2] ?? "http://localhost:8091";
const OUT = process.argv[3] ?? "/tmp/kcrefresh";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// iPhone 15 Pro-ish: 59pt status bar / notch, 34pt home indicator.
const INSET_TOP = 59;
const INSET_BOTTOM = 34;

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: 393, height: 852, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const errors = watchForErrors(page);

// The app reads these params in devForcedMetrics() and pins the insets.
await page.goto(`${BASE}?insetTop=${INSET_TOP}&insetBottom=${INSET_BOTTOM}`, {
  waitUntil: "networkidle2",
  timeout: 180000,
});
// Webfonts must land before any screenshot, or the type is measured wrong.
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 4000));

const shot = async (name) => {
  await assertRendered(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot:", name);
};

/** Click an element by its visible text, searching the whole render tree. */
const tapText = async (text, nth = 0) => {
  const ok = await page.evaluate((t, n) => {
    const els = [...document.querySelectorAll("div,span,button,input,a")];
    // Prefer the deepest element containing the text, so we hit the label itself
    // rather than an outer container that may not be the touchable.
    const hits = els
      .filter((e) => (e.textContent ?? "").trim().includes(t))
      .filter((e) => ![...e.children].some((c) => (c.textContent ?? "").includes(t)));
    const target = hits[n];
    if (!target) return false;
    let clickable = target;
    for (let i = 0; i < 6 && clickable; i++) {
      if (
        clickable.tagName === "BUTTON" ||
        clickable.getAttribute?.("role") === "button" ||
        clickable.getAttribute?.("role") === "tab" ||
        clickable.tabIndex >= 0
      ) break;
      clickable = clickable.parentElement;
    }
    (clickable ?? target).click();
    return true;
  }, text, nth);
  if (!ok) console.log("!! could not find text:", text);
  await new Promise((r) => setTimeout(r, 1500));
  return ok;
};

await shot("01-signin");

/**
 * Sign in for real.
 *
 * Auth is a live API call now, so the harness needs actual seeded credentials. The
 * previous version tapped "Sign In" and then typed a family name into the first
 * input, which was harmless when sign-in was a fake button -- but against the real
 * form it typed into the EMAIL field, failed validation, and captured the same error
 * screen fifteen times while still exiting 0. Hence assertSignedIn below: a visual
 * check that cannot tell "the app" from "the login screen" is not a check.
 */
const EMAIL = process.env.SHOTS_EMAIL ?? "sarah@example.com";
const PASSWORD = process.env.SHOTS_PASSWORD ?? "familyfirst2024";

await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  inputs.forEach((i) => { i.value = ""; });
});

const inputs = await page.$$("input");
if (inputs.length < 2) throw new Error(`expected email+password inputs, found ${inputs.length}`);
await inputs[0].click();
await page.keyboard.type(EMAIL, { delay: 15 });
await inputs[1].click();
await page.keyboard.type(PASSWORD, { delay: 15 });

await tapText("Sign In");
// Login is a network round trip plus a full family fetch, so this waits for the app
// rather than a fixed sleep.
await page.waitForFunction(
  () => !document.body.innerText.includes("Welcome back"),
  { timeout: 30000 },
).catch(() => {});
await new Promise((r) => setTimeout(r, 2500));

/** Fail loudly if we are still looking at the sign-in screen. */
const assertSignedIn = async () => {
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes("Welcome back") || text.includes("Create your account")) {
    throw new Error(`sign-in failed -- still on the auth screen. Is the API running on :4001 and seeded? (${EMAIL})`);
  }
};
await assertSignedIn();

// Offsets are fractions of each screen's own scroll range, not fixed pixels: the
// five tabs differ in length, so a fixed 900px both clamps on the short ones and
// leaves the bottom of the long ones unseen.
await withBrowser(browser, async () => {
  await assertSignedIn();
  await shot("03-hearth-top");
  await scrollToFraction(page, 0.5);
  await shot("04-hearth-mid");
  await scrollToFraction(page, 1);
  await shot("05-hearth-lower");

  for (const [tab, name] of [
    ["Chat", "06-chat"],
    ["Care", "07-care"],
    ["Archive", "08-archive"],
    ["Kinship", "09-kinship"],
  ]) {
    await scrollToFraction(page, 0);
    await tapText(tab);
    await new Promise((r) => setTimeout(r, 1200));
    await shot(name);
    await scrollToFraction(page, 0.55);
    await shot(`${name}-scrolled`);
    await scrollToFraction(page, 1);
    await shot(`${name}-bottom`);
  }
});

await browser.close();
finish(errors, OUT);
