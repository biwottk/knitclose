/**
 * Dev-only visual check for the five-tab shell, WITH SIMULATED DEVICE INSETS.
 *
 * A desktop browser reports zero safe-area insets, so status-bar collisions and
 * home-indicator clipping are invisible in it -- that is exactly how a clipped
 * header shipped once. This drives phone-like insets and paints guide bars over
 * the unsafe regions, so anything drawn underneath them is visibly wrong.
 *
 *   node scripts/tabs-shot.mjs [baseUrl] [outDir]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8099";
const OUT = process.argv[3] ?? "/tmp/kctabs";
mkdirSync(OUT, { recursive: true });

const INSET_TOP = 59;
const INSET_BOTTOM = 34;

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "shell",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: 393, height: 852, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 300));
});

await page.evaluateOnNewDocument((top, bottom) => {
  const inject = () => {
    if (!document.head) return false;
    const style = document.createElement("style");
    style.textContent =
      "body::before, body::after { content: ''; position: fixed; left: 0; right: 0;" +
      "z-index: 99999; pointer-events: none; background: rgba(220,40,40,0.22); }" +
      "body::before { top: 0; height: " + top + "px; }" +
      "body::after { bottom: 0; height: " + bottom + "px; }";
    document.head.appendChild(style);
    return true;
  };
  if (!inject()) {
    document.addEventListener("DOMContentLoaded", inject);
    new MutationObserver((_m, obs) => { if (inject()) obs.disconnect(); })
      .observe(document.documentElement ?? document, { childList: true, subtree: true });
  }
}, INSET_TOP, INSET_BOTTOM);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n, full = false) => {
  await page.screenshot({ path: OUT + "/" + n + ".png", fullPage: full });
  console.log("shot:", n);
};

/** Click the innermost element whose trimmed text matches exactly. */
const tapExact = async (label) => {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll("div,span,button")]
      .filter((e) => (e.textContent ?? "").trim() === t)
      .filter((e) => ![...e.children].some((c) => (c.textContent ?? "").trim() === t));
    const el = els[els.length - 1];
    if (!el) return false;
    let c = el;
    for (let i = 0; i < 6 && c; i++) {
      if (c.tagName === "BUTTON" || c.getAttribute?.("role") === "button" || c.tabIndex >= 0) break;
      c = c.parentElement;
    }
    (c ?? el).click();
    return true;
  }, label);
  if (!ok) console.log("!! not found:", label);
  await wait(1200);
};

const url = BASE + "?insetTop=" + INSET_TOP + "&insetBottom=" + INSET_BOTTOM;
await page.goto(url, { waitUntil: "networkidle2", timeout: 180000 });
await wait(5000);

// Walk the sign-in -> onboarding -> app flow.
await shot("t0-signin");
await tapExact("Sign In");
await tapExact("Create a New Family Circle");

const inputs = await page.$$("input");
if (inputs[0]) { await inputs[0].click(); await page.keyboard.type("The Miller Family"); }
await wait(400);
await tapExact("Create our circle");
await wait(2000);

// Each tab, both viewport and full-page (full-page catches overflow/clipping).
for (const tab of ["Hearth", "Chat", "Care", "Archive", "Kinship"]) {
  await tapExact(tab);
  await shot("t-" + tab.toLowerCase());
  await shot("t-" + tab.toLowerCase() + "-full", true);
}

// The Archive's second mode: face tagging is the riskiest layout (absolute
// markers positioned as percentages over a photo).
await tapExact("Archive");
await tapExact("Who Is This?");
await wait(800);
await shot("t-faces-full", true);

await browser.close();
console.log("done ->", OUT);
