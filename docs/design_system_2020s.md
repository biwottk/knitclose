# Close Knit UI refresh — the 2020s pass

This is the contract every screen and component follows after the refresh. It exists
because the previous build was internally consistent but consistently dated, and the
fastest way to regress is to fix one screen in isolation.

## The diagnosis

The old UI was not ugly — it was *2014*. Specifically:

| Symptom | Why it dates the app |
| --- | --- |
| Emoji as the icon set (🏡 💚 📖 🌳 🎤 📷 ✏️ ✓) | Different artwork per OS, uncontrollable colour/gloss, cannot inherit text colour or stroke weight, cannot animate |
| 1px hairline around every card, no real shadow | Produces a "boxed table" page; modern UI separates layers with soft depth and tone |
| 8px corner radius on full-width cards | The single clearest tell of a mid-2010s layout |
| Letter-spacing 0 on every role | Display type needs negative tracking, caps labels need positive; 0 everywhere reads as untuned |
| Merriweather + Inter | Both fine, both ubiquitous to the point of invisibility |
| Header repeating the wordmark on every screen | Chrome from an era before users knew which app they had opened |
| No motion vocabulary | Static waveforms, snapping tab states, dimming presses |
| The logo appeared nowhere | A green heart emoji stood in for the actual brand mark |

## The rules now

### Icons — never emoji, ever
Use `<Icon name="..." />` from `src/components/Icon.tsx`, which wraps
`lucide-react-native` behind **semantic** names (`voice`, `archive`, `celebrate`),
never library names. One retune point for the whole app.

- `<Icon>` for a bare glyph. Default 20px, inherits an explicit `color`.
- `<IconBadge>` for the tinted-round-container pattern (list-row leading icon,
  card header, callout). Do not hand-roll it — that is how the sizes drifted before.
- `filled` only where a solid glyph reads better: hearts, stars, play/pause.
- Stroke weight is automatic by size; override only with reason.

### Depth, not borders
`<Card>` defaults to `elevation="card"` — a warm, low-opacity shadow. Borders appear
only on **tinted** cards (`alert`, `warm`, `mint`), where a warm shadow cannot
separate a warm card from a warm canvas. Use `elevation="flat"` for a card nested
inside another card. Never re-add a hairline "because it looks crisper".

### Shape
`radii.card` (20) for cards, `radii.cardLg` (26) for feature/hero modules,
`radii.inner` (16) for media and sub-panels inside a card, `radii.pill` for all
buttons and chips, `radii.sheet` (32) for sheets. Nothing structural at 8.

### Type
Always `<AppText variant="...">`; never a raw `<Text>` and never a hand-set
`fontSize`. Tracking is a property of the role and must not be overridden.
Fraunces (serif) carries the family's own words and headings; Plus Jakarta Sans
carries chrome. Use `variant="mono"` for anything that counts — timers, durations,
"3 of 5" — because proportional digits visibly jitter as they change.

### Motion
Durations and springs come from `motion` in `theme.ts`. Presses scale to
`motion.pressScale` (0.97) rather than dimming; large surfaces must scale, because
dimming a big card looks like a rendering fault. Anything that represents live state
(a waveform during playback, a tab becoming active) has to actually move.

### Colour
Forest `#1A4230` and terracotta `#C1542F` are **sampled from the logo**, so the
brand and the product finally agree. Terracotta means "today / spontaneous / needs a
person". Forest means "permanent / archive / primary action". Amber nudges, never
alarms. No tech blue anywhere.

### The logo
`<Logo>` and `<LogoBadge>` render the real mark, extracted from
`design/screen.png` by `scripts/extract-logo.cjs`. Screens showing the **lockup**
must not also print "Close Knit" as text — the wordmark is part of the artwork.

## Accessibility — unchanged, still mandatory
17px body baseline, 12px hard floor, 48×48 minimum touch target even where the
visible control is smaller (use `hitSlop`), `allowFontScaling` left on everywhere,
and an `accessibilityLabel` on every control whose purpose is not its visible text.
Tab labels stay visible: icon-only navigation is a comprehension tax on exactly the
family members this product cannot afford to lose.
