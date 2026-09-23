---
target: Hearth
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
target_identity: "file:/Users/mac/Desktop/knitclose/src/screens/HearthScreen.tsx"
target_fingerprint: "sha256:e07496d5ba40be3d462ebcee889732cc0ae22a914afc93c694deb9ae403b56d1"
target_path: /Users/mac/Desktop/knitclose/src/screens/HearthScreen.tsx
timestamp: 2026-09-21T18-38-11Z
slug: src-screens-hearthscreen-tsx
closed: true
---
# Hearth Design Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2/4 | Active states are clear, but awake/weather/unread/recency signals imply knowledge the app does not have. |
| 2 | Match System / Real World | 2/4 | Family language is excellent; fixed weather and inferred presence are fabricated claims. |
| 3 | User Control and Freedom | 3/4 | Navigation and reactions are reversible; nudges lack undo and some controls are dead or misrouted. |
| 4 | Consistency and Standards | 2/4 | Strong visual consistency; circle, mic, avatar and content destinations do not consistently behave as labeled. |
| 5 | Error Prevention | 2/4 | Privacy safeguards help; primary actions still lead to confusion or incomplete functionality. |
| 6 | Recognition Rather Than Recall | 3/4 | Posting and Journal access are visible; Journal vs Archive vs Chat still requires learning. |
| 7 | Flexibility and Efficiency | 2/4 | Two posting speeds and reactions help; fixed ordering ignores urgency. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Polished, but giant greeting and three posts push utility several screens down. |
| 9 | Error Recovery | 3/4 | Form recovery is strong; Hearth-local actions lack retry/undo. |
| 10 | Help and Documentation | 1/4 | Initial guidance exists; destination boundaries lack contextual help. |
| **Total** | | **22/40** | **Acceptable; significant trust and IA work remains.** |

## Design Specificity Verdict

Strongly product-specific, structurally conflicted. Hearth, two-speed contribution, named family reactions, circle identity, care and remembrance are unmistakably Close Knit. The composition is less distinctive: every good product idea receives a full module, producing a generic long dashboard/feed stack.

CLI detector: 0 findings, exact JSON []. Browser detector: 35 runtime occurrences (20 low-contrast, 11 buried-raster, 2 layout-transition, 1 clipped-overflow-container, 1 all-caps-body). All buried-raster findings are RN Web false positives; all-caps is eyebrow metadata; transitions/clipping are generated/shared behavior. Real signal: repeated small-text contrast misses—#C1542F on #FCF9F6 4.4:1, #857A72 on #FCF9F6 4.0:1, #857A72 on white 4.2:1, terracotta on pale terracotta 3.7:1, muted text on warm container 3.6:1. Web also lacks semantic heading roles. No persistent human overlay was possible; headless injection and capture succeeded.

## Overall Impression

Exceptional emotional ingredients, weak prioritization. Hearth should answer “What matters in my family today?” Stories belong in that answer but cannot always outrank uncovered care, an unactivated circle, or an approaching event.

## What’s Working

1. Two-speed contribution is excellent product design: casual sharing and deliberate preservation are parallel and visible.
2. Register-sensitive reactions are humane and prevent inappropriate engagement patterns.
3. The visual identity feels authored for family life rather than like a generic startup dashboard.

## Cognitive Load

Five of eight checks fail: single focus, visual hierarchy, minimal choices, working memory, and progressive disclosure. Grouping, chunking and local one-task-at-a-time behavior pass. The first viewport exposes header controls, two posting paths, Journal navigation and five tabs; a story card exposes open, 3–4 reactions and comment; the overall scroll asks users to choose among Journal, nudges, care, radar, chat activity and resurfacing.

## Emotional Journey

Arrival creates belonging; contribution creates agency; family content provides the peak. The valley begins when archival cards delay care and connection and fabricated ambient status undermines trust. Reactions, nudges and completed care can create satisfying peaks, but the page ends as an unresolved sequence of cards.

## Priority Issues

### P0 — Quick Share advertises photo sharing, but the camera action does nothing
Quick Share is one of the two dominant home actions and promises photos. It routes to Chat where the camera handler is empty. Implement photo selection/upload or change the promise. The header mic must not claim recording if it only navigates. Suggested: /impeccable harden Chat Quick Share.

### P1 — Hearth fabricates ambient family intelligence
Weather is hard-coded; “up and about” is living-relative count, not presence; recency and some media are fixtures. Remove simulated live claims. Use verified signals or honest blanks. Suggested: /impeccable harden Hearth.

### P1 — Circle activation disappears after the first memory
isNewCircle becomes false when one deed exists even if nobody joined. Separate content activation from circle activation and retain compact invitation progress until another account joins. Suggested: /impeccable onboard Hearth.

### P1 — Three full Journal cards bury daily utility
First card y536–979, second y1047–1521, third y1589–1975, Thinking of You y2105, Care y2239, Quick Share y2401, On This Day y2974 at an 852px viewport. Use urgency-aware ordering, one strong story near the top, then operational modules; move more stories below or behind View Journal. Suggested: /impeccable layout Hearth.

### P1 — Header/profile affordances make promises they do not keep
Circle chevron is dead; unread dot lacks real state; mic label claims recording but navigates; avatar opens Settings. Wire behavior or remove affordances, and label navigation honestly. Suggested: /impeccable harden Hearth navigation.

### P2 — Story cards are too complete and repeat metadata
Create a Hearth card variant with author/date, photo, title, two-line excerpt, named reactions, comment and compact privacy. Move tags, duplicated category/date, provenance and secondary details to story detail; remove redundant chevron and dedupe On This Day. Suggested: /impeccable distill Hearth story cards.

## Persona Red Flags

Jordan: dead circle chevron, misleading mic, inert camera, and Journal/Archive/Chat taxonomy signal unfinished behavior.

Casey: giant greeting and three media-rich cards delay care; nudges lack undo; there is no concise “what needs me now” summary.

Ruth (Family Champion/elder): activation guidance disappears too early; dense taxonomy and long cards fatigue; fabricated family context is a severe trust breach; Dynamic Type remains unproven.

## Minor Observations

“View all 8” should name stories or the Journal. Greeting is oversized on repeat visits. Fahrenheit conflicts with en-GB. Story feed may duplicate QuickShareCard. Tablet composition, navigation rail, dark mode and increased contrast are unresolved. All browser-observed controls had labels and images had meaningful alt text.

## Questions to Consider

- Is Hearth primarily a daily dashboard or social feed when care is incomplete?
- Should any archival story outrank an uncovered care slot?
- What is lost by showing one exceptional story instead of three?
- Is the content taxonomy serving the family or exposing the data model?
