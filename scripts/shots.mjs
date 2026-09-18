/**
 * Dev-only visual check: drives the Expo web build in headless Chrome and captures
 * each V1 screen at phone size. Not shipped in the app.
 *
 *   node scripts/shots.mjs [baseUrl] [outDir]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { assertRendered, finish, scrollTo, watchForErrors, withBrowser } from "./lib-page.mjs";

const BASE = process.argv[2] ?? "http://localhost:8091";
const OUT = process.argv[3] ?? "/tmp/kcshots";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const errors = watchForErrors(page);

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 180000 });
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
    // Prefer the deepest element that contains the text, so we click the label itself
    // rather than an outer container that may not be the touchable.
    const hits = els.filter((e) => (e.textContent ?? "").trim().includes(t))
      .filter((e) => ![...e.children].some((c) => (c.textContent ?? "").includes(t)));
    const target = hits[n];
    if (!target) return false;
    let clickable = target;
    for (let i = 0; i < 6 && clickable; i++) {
      if (clickable.tagName === "BUTTON" || clickable.getAttribute?.("role") === "button"
          || clickable.tabIndex >= 0) break;
      clickable = clickable.parentElement;
    }
    (clickable ?? target).click();
    return true;
  }, text, nth);
  if (!ok) console.log("!! could not find text:", text);
  await new Promise((r) => setTimeout(r, 1400));
  return ok;
};

await shot("01-signin");

await tapText("Sign In");
await shot("02-onboarding-choice");

await tapText("Create a New Family Circle");
// react-native-web inputs need a real focus before keyboard input lands.
await page.click("input:not([type=password])").catch(() => {});
await page.focus("input:not([type=password])").catch(() => {});
await page.keyboard.type("The Garcia Family", { delay: 30 });
await new Promise((r) => setTimeout(r, 500));
await shot("03-onboarding-name");

await tapText("Create our circle");
await shot("04-feed");

// Open the first story
await tapText("Thirty-two years in the same classroom");
await shot("05-deed-detail");
await scrollTo(page, 99999);
await shot("06-deed-comments");

// Family tree tab
await tapText("Family Tree");
await shot("07-tree");

await tapText("Joseph Garcia");
await shot("08-profile");

await tapText("Settings");
await shot("09-settings");

// Add Deed wizard
await tapText("Feed");
await new Promise((r) => setTimeout(r, 800));
await tapText("+");
await shot("10-adddeed-step1");
await tapText("Rosa Garcia");
await tapText("Next");
await shot("11-adddeed-step2");

// Fill the wizard through to the celebration (the peak moment).
const typeInto = async (n, text) => {
  const inputs = await page.$$("input, textarea");
  if (!inputs[n]) return console.log("!! no input at", n);
  await inputs[n].click();
  await page.keyboard.type(text, { delay: 15 });
};
// Step 2 renders title + when + tags; inputs appear in DOM order.
await typeInto(0, "Built a cabin by hand for the family");
const all = await page.$$("input, textarea");
if (all[1]) { await all[1].click(); await page.keyboard.type("Summer of 1978", { delay: 15 }); }
await new Promise((r) => setTimeout(r, 300));
await shot("12-adddeed-filled");
await tapText("Next");                    // -> step 3 (media)
await new Promise((r) => setTimeout(r, 900));
await tapText("Next");                    // -> step 4 (story)
await new Promise((r) => setTimeout(r, 900));
await typeInto(0, "He borrowed a truck, felled the pines himself, and worked from a drawing he kept folded in his shirt pocket all summer long.");
await shot("13-adddeed-story");
await tapText("Share with my family");
await new Promise((r) => setTimeout(r, 2500));
await shot("14-PEAK-celebration");

await browser.close();
finish(errors, OUT);
