/**
 * Dev-only visual check WITH SIMULATED DEVICE SAFE-AREA INSETS.
 *
 * Why this exists: a desktop browser viewport reports zero safe-area insets, so
 * status-bar collisions and home-indicator clipping are invisible in it. That is
 * exactly how a clipped header shipped. This script injects iPhone-like insets
 * so those bugs are catchable without a physical device.
 *
 *   node scripts/device-shot.mjs [baseUrl] [outDir]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8091";
const OUT = process.argv[3] ?? "/tmp/kcdevice";
mkdirSync(OUT, { recursive: true });

// iPhone 15 Pro-ish: 59pt status bar / notch, 34pt home indicator.
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

/**
 * react-native-safe-area-context's web build reads the CSS env() values through
 * a probe element. Overriding the custom properties it falls back to, plus
 * painting guide bars, lets us both drive and SEE the unsafe regions.
 */
await page.evaluateOnNewDocument((top, bottom) => {
  const inject = () => {
    if (!document.head) return false;
    const style = document.createElement("style");
    style.textContent = `
    /* Visual guides: anything the app draws under these bars is clipped on device.
       The insets themselves are driven through ?insetTop/?insetBottom, which the
       app reads in devForcedMetrics(). */
    body::before, body::after {
      content: ""; position: fixed; left: 0; right: 0; z-index: 99999;
      pointer-events: none; background: rgba(220, 40, 40, 0.28);
    }
    body::before { top: 0; height: ${top}px; }
    body::after { bottom: 0; height: ${bottom}px; }
    `;
    document.head.appendChild(style);
    return true;
  };
  // evaluateOnNewDocument runs before <head> exists, so retry on DOM ready.
  if (!inject()) {
    document.addEventListener("DOMContentLoaded", inject);
    new MutationObserver((_m, obs) => { if (inject()) obs.disconnect(); })
      .observe(document.documentElement ?? document, { childList: true, subtree: true });
  }
}, INSET_TOP, INSET_BOTTOM);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot:", n); };

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
  await wait(1100);
};

const url = `${BASE}?insetTop=${INSET_TOP}&insetBottom=${INSET_BOTTOM}`;
await page.goto(url, { waitUntil: "networkidle2", timeout: 180000 });
await wait(4000);

await shot("d1-signin");
await tapExact("Sign In");
await shot("d2-onboarding");
await tapExact("Create a New Family Circle");
const inputs = await page.$$("input, textarea");
if (inputs[0]) { await inputs[0].click(); await page.keyboard.type("The Biwott Family", { delay: 15 }); }
await tapExact("Create our circle");
await wait(1200);
await shot("d3-feed");
await tapExact("Family Tree");
await shot("d4-tree");
await tapExact("Settings");
await shot("d5-settings");

/**
 * Assertion: measure the topmost visible text against the top inset. If any text
 * baseline starts inside the unsafe strip, the screen is broken on device.
 */
const worst = await page.evaluate((top) => {
  const out = [];
  for (const el of document.querySelectorAll("div,span")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join("");
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) continue;
    if (r.top < top) out.push({ text: own.slice(0, 40), top: Math.round(r.top) });
  }
  return out.slice(0, 8);
}, INSET_TOP);

console.log(worst.length === 0
  ? "PASS: no text intrudes into the top safe area"
  : "FAIL: text under the status bar -> " + JSON.stringify(worst));

await browser.close();
