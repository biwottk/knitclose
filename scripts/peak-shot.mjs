/**
 * Dev-only: walks the Add Deed wizard end-to-end and captures the peak moment.
 *   node scripts/peak-shot.mjs [baseUrl] [outDir]
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8091";
const OUT = process.argv[3] ?? "/tmp/kcpeak";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "shell",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0,200)); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot:", n); };

/** Click the LAST element whose trimmed text equals the label (footer buttons sit last in DOM). */
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

const typeNth = async (n, text) => {
  const els = await page.$$("input, textarea");
  if (!els[n]) return console.log("!! no field", n);
  await els[n].click();
  await page.keyboard.type(text, { delay: 12 });
};

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 180000 });
await wait(4000);

await tapExact("Sign In");
await tapExact("Create a New Family Circle");
await typeNth(0, "The Okafor Family");
await tapExact("Create our circle");
await wait(1200);

// Open the wizard via the FAB.
await tapExact("+");
await shot("w1-who");

await tapExact("Joseph Garcia");   // step 1 selection
await tapExact("Next");
await shot("w2-title");

await typeNth(0, "Built a cabin by hand for the family");
await typeNth(1, "Summer of 1978");
await tapExact("Kindness");
await shot("w2-filled");

await tapExact("Next");            // -> media
await wait(600);
await shot("w3-media");

await tapExact("Almost there \u2014 Next"); // -> story
await wait(600);
await typeNth(0, "He borrowed a truck, felled the pines himself, and worked from a drawing he kept folded in his shirt pocket. He always said the cabin was for us, not for him, and every grandchild has slept under that roof since.");
await shot("w4-story");

await tapExact("Share with my family");
await wait(3000);
await shot("PEAK-celebration");

await browser.close();
console.log("done");
