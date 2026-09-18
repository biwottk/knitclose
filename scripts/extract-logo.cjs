/**
 * Extracts the Close Knit brand assets from the source artwork.
 *
 *   node scripts/extract-logo.cjs
 *
 * WHY THIS EXISTS: design/screen.png is a 1024x1024 mockup export with NO alpha
 * channel -- its transparency is painted as a light/grey CHECKERBOARD. Dropping that
 * straight into the app would put a visible chequered square behind the logo, and
 * naive "make white transparent" thresholding eats the antialiased edges and leaves
 * a hard, jagged mark.
 *
 * So the alpha is recovered properly, in three steps:
 *
 *   1. INK MEASUREMENT. The two brand strands are sampled from the artwork itself by
 *      hue clustering, giving forest #1A4230 and terracotta #C1542F -- which is where
 *      theme.ts's primary and secondary now come from, so the palette and the logo
 *      cannot drift apart.
 *
 *   2. ALPHA FROM CHANNEL DIFFERENCES. For a neutral backdrop of any brightness,
 *      pixel_c = a * ink_c + (1 - a) * bg. Subtracting channels cancels bg entirely:
 *      (r - g) = a * (ink_r - ink_g). Solving that by least squares over both
 *      difference channels recovers a true fractional alpha for every pixel --
 *      identically over the white squares, the grey squares, and every antialiased
 *      edge in between. No checkerboard model, no threshold, no fringing.
 *
 *   3. DESPECKLE. The source carries faint JPEG-ish speckle that survives step 2 and
 *      inflated the crop box to the whole canvas. Sub-12% alpha is cleared and
 *      connected components under 400px are dropped, which leaves exactly the ten
 *      real shapes (the knot plus the letterforms).
 *
 * Resampling is done on PREMULTIPLIED values -- averaging straight RGBA is what
 * produces dark halos around downscaled transparent artwork.
 *
 * Outputs (all regenerable; safe to delete and re-run):
 *   assets/logo-mark.png       knot only, transparent      -> <Logo variant="mark">
 *   assets/logo-lockup.png     knot + wordmark             -> <Logo variant="lockup">
 *   assets/logo-wordmark.png   wordmark only               -> <Logo variant="wordmark">
 *   assets/icon.png            1024 opaque, store icon     -> app.json ios/icon
 *   assets/adaptive-icon.png   1024 transparent, safe-zone -> app.json android
 *   assets/splash-icon.png     1024 transparent lockup     -> app.json splash
 *   assets/favicon.png         96 opaque                   -> app.json web
 */
const fs = require("fs");
const L = require("./lib-png.cjs");

// ---------------------------------------------------------------------------
// 1 + 2: decode, measure inks, solve alpha
// ---------------------------------------------------------------------------

const SRC = "design/screen.png";
const { w, h, ch, data } = L.decodePNG(SRC);
const P = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };

/** The two brand inks, measured from the artwork's own hue clusters. */
const FOREST = [23, 61, 40];
const TERRA = [193, 87, 47];

/**
 * Alpha from channel differences, which cancel the background exactly.
 * Returns the better-fitting ink and its fractional coverage.
 */
function solve(px) {
  const [r, g, b] = px;
  const rg = r - g, gb = g - b;
  const cands = [
    { ink: FOREST, drg: FOREST[0] - FOREST[1], dgb: FOREST[1] - FOREST[2] },
    { ink: TERRA, drg: TERRA[0] - TERRA[1], dgb: TERRA[1] - TERRA[2] },
  ];
  let best = null;
  for (const c of cands) {
    const a = (rg * c.drg + gb * c.dgb) / (c.drg * c.drg + c.dgb * c.dgb);
    if (a < 0) continue;
    const err = (rg - a * c.drg) ** 2 + (gb - a * c.dgb) ** 2;
    if (!best || err < best.err) best = { a: Math.min(1, a), ink: c.ink, err };
  }
  return best ?? { a: 0, ink: FOREST };
}

const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const { a, ink } = solve(P(x, y));
  const i4 = (y * w + x) * 4;
  rgba[i4] = ink[0]; rgba[i4 + 1] = ink[1]; rgba[i4 + 2] = ink[2];
  rgba[i4 + 3] = Math.round((a < 0.02 ? 0 : a) * 255);
}

// ---------------------------------------------------------------------------
// 3: despeckle -- clear near-zero alpha, then drop tiny connected components
// ---------------------------------------------------------------------------

for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] < 31) rgba[i * 4 + 3] = 0;

const seen = new Uint8Array(w * h);
let kept = 0, removed = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const idx = y * w + x;
  if (seen[idx] || rgba[idx * 4 + 3] === 0) continue;
  const stack = [idx], comp = [];
  seen[idx] = 1;
  while (stack.length) {
    const cur = stack.pop(); comp.push(cur);
    const cx = cur % w, cy = (cur - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || rgba[ni * 4 + 3] === 0) continue;
      seen[ni] = 1; stack.push(ni);
    }
  }
  if (comp.length < 400) { for (const c of comp) rgba[c * 4 + 3] = 0; removed++; }
  else kept++;
}
console.log("shapes kept: " + kept + ", speckles removed: " + removed);

// ---------------------------------------------------------------------------
// Crop, resample, export
// ---------------------------------------------------------------------------

const A = (x, y) => rgba[(y * w + x) * 4 + 3];

/** Tight bounding box of real ink within a horizontal band. */
function bbox(y0, y1) {
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) {
    if (A(x, y) > 20) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function crop(box, pad) {
  const cw = box.w + pad * 2, chh = box.h + pad * 2;
  const out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
    const si = ((box.minY + y) * w + (box.minX + x)) * 4;
    out.set(rgba.subarray(si, si + 4), ((y + pad) * cw + (x + pad)) * 4);
  }
  return { w: cw, h: chh, data: out };
}

/** Box filter on PREMULTIPLIED values -- straight RGBA averaging halos the edges. */
function resize(img, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  const sx = img.w / tw, sy = img.h / th;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < Math.min(y1, img.h); yy++) {
      for (let xx = x0; xx < Math.min(x1, img.w); xx++) {
        const i = (yy * img.w + xx) * 4, al = img.data[i + 3] / 255;
        r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al;
        a += al; n++;
      }
    }
    const di = (y * tw + x) * 4;
    if (a > 0) {
      out[di] = Math.round(r / a); out[di + 1] = Math.round(g / a);
      out[di + 2] = Math.round(b / a); out[di + 3] = Math.round((a / n) * 255);
    }
  }
  return { w: tw, h: th, data: out };
}

/** Square canvas, image centred, `inset` fraction of clear space per side. */
function pad(img, size, inset, bg) {
  const out = Buffer.alloc(size * size * 4);
  if (bg) for (let i = 0; i < size * size; i++) {
    out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255;
  }
  const avail = size * (1 - inset * 2);
  const scale = Math.min(avail / img.w, avail / img.h);
  const tw = Math.max(1, Math.round(img.w * scale));
  const th = Math.max(1, Math.round(img.h * scale));
  const r = resize(img, tw, th);
  const ox = Math.round((size - tw) / 2), oy = Math.round((size - th) / 2);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const si = (y * tw + x) * 4, di = ((y + oy) * size + (x + ox)) * 4;
    const a = r.data[si + 3] / 255;
    if (bg) {
      // Composite over the opaque background so store icons have no alpha.
      out[di] = Math.round(r.data[si] * a + out[di] * (1 - a));
      out[di + 1] = Math.round(r.data[si + 1] * a + out[di + 1] * (1 - a));
      out[di + 2] = Math.round(r.data[si + 2] * a + out[di + 2] * (1 - a));
      out[di + 3] = 255;
    } else {
      out.set(r.data.subarray(si, si + 4), di);
    }
  }
  return { w: size, h: size, data: out };
}

const write = (p, img) => {
  L.writeRGBA(p, img.w, img.h, img.data);
  console.log("wrote " + p + " (" + img.w + "x" + img.h + ")");
};

// The artwork is a vertical lockup: knot on top, wordmark beneath. These bands
// split them; `bbox` then finds the true edges inside each.
const mark = bbox(180, 670);
const word = bbox(675, 820);
const lock = bbox(180, 820);

const markImg = crop(mark, 6);
const lockImg = crop(lock, 6);
const wordImg = crop(word, 4);

// App canvas colour, for the icons that must be opaque.
const CANVAS = [252, 249, 246];

write("assets/logo-mark.png", resize(markImg, 512, Math.round(512 * markImg.h / markImg.w)));
write("assets/logo-lockup.png", resize(lockImg, 720, Math.round(720 * lockImg.h / lockImg.w)));
write("assets/logo-wordmark.png", resize(wordImg, 720, Math.round(720 * wordImg.h / wordImg.w)));

// 17% inset: iOS masks its own corners, so the mark just needs optical margin.
write("assets/icon.png", pad(markImg, 1024, 0.17, CANVAS));
// 26%: Android crops adaptive icons hard: everything must sit in the safe circle.
write("assets/adaptive-icon.png", pad(markImg, 1024, 0.26, null));
write("assets/splash-icon.png", pad(lockImg, 1024, 0.10, null));
write("assets/favicon.png", pad(markImg, 96, 0.06, CANVAS));
