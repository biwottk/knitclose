---
name: Kinship & Hearth
colors:
  surface: '#fff8f5'
  surface-dim: '#e1d8d3'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2ed'
  surface-container: '#f5ece7'
  surface-container-high: '#f0e6e1'
  surface-container-highest: '#eae1dc'
  on-surface: '#1f1b18'
  on-surface-variant: '#424844'
  inverse-surface: '#34302c'
  inverse-on-surface: '#f8efea'
  outline: '#727974'
  outline-variant: '#c1c8c3'
  surface-tint: '#486458'
  primary: '#07241a'
  on-primary: '#ffffff'
  primary-container: '#1e3a2f'
  on-primary-container: '#86a496'
  inverse-primary: '#aecebe'
  secondary: '#a23e18'
  on-secondary: '#ffffff'
  secondary-container: '#fe8357'
  on-secondary-container: '#6f2000'
  tertiary: '#2d1c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#493000'
  on-tertiary-container: '#cf921c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#caeada'
  primary-fixed-dim: '#aecebe'
  on-primary-fixed: '#032017'
  on-primary-fixed-variant: '#304c41'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#822801'
  tertiary-fixed: '#ffdeae'
  tertiary-fixed-dim: '#fdba45'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#604100'
  background: '#fff8f5'
  on-background: '#1f1b18'
  surface-variant: '#eae1dc'
typography:
  headline-xl:
    fontFamily: Merriweather
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Merriweather
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Merriweather
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Merriweather
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Merriweather
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 30px
  story-callout:
    fontFamily: Merriweather
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system serves a multi-generational family space designed to capture both the mundane beauty of an ordinary Tuesday—grocery coordination, shared school pick-up notes, quick photo check-ins—and the enduring permanence of family archives and oral histories.

The visual style blends **Editorial Warmth** with **Humanist Minimalism**. It rejects the high-velocity, gamified mechanics of conventional social platforms in favor of a tactile, print-inspired digital living room. The UI feels like an heirloom journal crafted with modern utilitarian precision: quiet, welcoming, respectful of older eyes, and immediate enough for busy parents and teenagers. Interfaces prioritize expansive readability, forgiving touch boundaries, unhurried negative space, and gentle visual weight over sharp tech minimalism.

## Colors

The palette avoids synthetic cool whites and electric primaries. Instead, it relies on grounded earthen pigments that evoke linen, botanical ink, baked clay, and natural parchment.

- **Primary (`#1E3A2F`) — Forest Pine**: Conveys endurance, dignity, and calm authority. Used for primary interactions, core navigation states, focal headers, and key actionable icons.
- **Secondary (`#C85A32`) — Terracotta**: Evokes hearth warmth, spontaneity, and creative contributions. Used for badges, primary callouts, secondary actions, and milestone moments.
- **Tertiary (`#D99B26`) — Warm Amber**: Reserved for soft reminders, celebration indicators, subtle status tags, and time-capsule unlocks without aggressive alarmist tones.
- **Neutral (`#24201D`) — Dark Espresso**: Serves as the primary high-contrast reading text, replacing stark `#000000` with an ink-washed tone that reduces eye strain across varied screen fidelities.
- **Surfaces**: Canvas begins at warm oatmeal (`#FBF9F5`) transitioning to inset cards and elevated layers (`#FFFFFF` and `#F5F1EA`), bounded by gentle raw-linen hairline dividers (`#E6DFD5`).

## Typography

Typography establishes multi-generational accessibility as a foundational standard rather than an afterthought.

- **Editorial Headings (`Merriweather`)**: Sturdy, warm, and highly legible even at low brightness. Used for names, archive headers, daily prompt questions, and journal entries.
- **Functional Body & Metadata (`Inter`)**: Neutral, tall x-height, wide apertures, and deliberate character distinction (e.g., distinguishing `1`, `l`, and `I`).
- **Scale Rules**:
  - Baseline body reading size defaults to `16px` (`body-md`), with narrative-first views leaning on `18px` (`body-lg`) to comfortably accommodate aging family members.
  - Line-height across long-form reading stays generous (1.6×–1.75×) to support continuous scanning without visual exhaustion.
  - Sub-labels never drop below `12px` (`label-sm`), ensuring high contrast against light parchment backgrounds.

## Layout & Spacing

The layout model adapts a fluid responsive grid built on an 8pt rhythmic scale. 

- **Breakpoints**:
  - **Mobile (<768px)**: 4-column fluid layout with `margin: 1rem` (16px) and `gutter: 1rem` (16px). All interactive targets maintain a mandatory minimum physical touch zone of 48px by 48px, even if the visible asset is smaller.
  - **Tablet (768px–1024px)**: 8-column layout with `margin-md: 2rem` (32px) and `gutter-md: 1.5rem` (24px). Sidebar navigations remain persistent to provide steady orientation for non-tech-savvy users.
  - **Desktop (>1024px)**: 12-column layout maxed at 1280px container width with `margin-lg: 3rem` (48px) and `gutter-lg: 2rem` (32px). Content never stretches unbounded; reading wells maintain an optimal 65-character line length.

## Elevation & Depth

Visual hierarchy uses **tonal layering** and **low-contrast outlines** rather than stark floating dropshadows, reinforcing an organic paper and stationery sensibility.

- **Base Layer (Canvas)**: Warm oatmeal (`#FBF9F5`) provides the canvas foundation.
- **Mid-Tier (Cards & Inset Containers)**: Bleached parchment (`#FFFFFF`) or subdued wheat (`#F5F1EA`), outlined with a gentle 1px border (`#E6DFD5`). Cards communicate hierarchy through crisp delineation and interior padding rather than heavy shadows.
- **Overlays & Modals**: Ambient, diffused depth with warm undertones. Shadows use a custom tinted formula: `0 8px 32px -4px rgba(36, 32, 29, 0.08)` and `0 2px 8px -2px rgba(36, 32, 29, 0.04)`. The background dimming scrim uses `#24201D` at 40% opacity, preserving warmth instead of applying cold, sterile grays.

## Shapes

The design system incorporates **Rounded** geometry (`roundedness: 2`, 8px base radius). This produces approachable, friendly corners that soften digital rigidity while retaining structured alignment.

- **Base controls (Buttons, Form Inputs, Tooltips)**: 8px (`0.5rem`) corner radius.
- **Cards, Story Modules, & Media Containers**: 16px (`1rem` / `rounded-lg`) corner radius for visual containment.
- **Dialogs & Sheet Panels**: 24px (`1.5rem` / `rounded-xl`) corner radius, bringing warmth to contextual drawers and bottom sheets.
- **Avatars & Pill Filters**: Fully circular / capsules (`9999px`) to emphasize people and rapid status filtering.

## Components

### Buttons
- **Primary**: Solid Deep Forest Green (`#1E3A2F`) with pure white or warm cream text, 8px corner radius, minimum height 48px, minimum padding `0.75rem 1.5rem`.
- **Secondary**: Terracotta tint (`#C85A32`) or ghost outline with 1.5px border (`#1E3A2F`), emphasizing low pressure and easy readability.
- **Tertiary / Utility**: Quiet text buttons with clear hover/pressed states using `#F5F1EA` fills.

### Chips & Badges
- **Status & Member Pills**: Warm tinted backgrounds (e.g., Terracotta 10% `#F8EDE8`, Amber 15% `#FBF3E3`) with full capsule radii, 32px height, paired with `label-sm` or `label-md` bold styling.
- **Filter Tags**: Soft border (`#E6DFD5`), turning to forest green upon selection.

### Form Inputs
- **Text Fields**: Minimum height of 52px to facilitate effortless mobile tapping. Framed by a 1.5px border in `#E6DFD5`, shifting to Deep Forest Green (`#1E3A2F`) on focus with a warm 2px halo. Label text remains permanent above the field, avoiding disappearing placeholder patterns that confuse older users.

### Cards & Activity Tiles
- **Daily Utility vs. Timeless Archive**:
  - *Daily Check-ins*: Clean white backgrounds, `#E6DFD5` borders, compact padding (`space-md`), highlighting straightforward tasks like groceries or reminders.
  - *Heirloom Memory & Voice Note Cards*: Subdued parchment backgrounds (`#F5F1EA`), pairing rich `Merriweather` titles with generous photography framing and dedicated audio playback controls.

### Lists & Timelines
- Separated by soft 1px hairline rules (`#E6DFD5`). Item slots maintain a vertical clearance of at least 56px to guarantee separation between adjacent interactive rows.

### Audio & Story Prompt Modules (System-Specific)
- Dedicated persistent audio capture and playback bars designed with high-contrast pause/record mechanisms, tactile waveform indicators, and immediate feedback for multi-generational family contributors.