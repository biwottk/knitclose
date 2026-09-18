# Great Deeds — Sprint Roadmap

Two-week sprints. **V1.0 = Sprints 1–7.** Nothing in V1 requires AI or paid third-party APIs.

## V1.0

### Sprint 1 — Foundations & design system  ← *we are here*
- Expo + TypeScript project scaffolded and running on a real phone via Expo Go.
- Warm theme tokens (colour, type scale, spacing, radii) in `src/theme.ts`.
- Core accessible components: Button, Card, Avatar, PrivacyBadge, ScreenHeader.
- Navigation shell: Feed · Family Tree · Settings, plus stacks for detail screens.
- Mock data + Context store so screens are real before the backend exists.

### Sprint 2 — Auth
- Email/password sign up + log in; Sign in with Google and Apple.
- "Why is this private?" trust explainer.
- Session persistence and a real Log Out.

### Sprint 3 — Family Circles & invitations
- Create a Family Circle; single-use expiring invite tokens.
- Web "Welcome Kit" invitation landing page showing the inviter's photo.
- Admin role, Manage Members list, revoke invite.

### Sprint 4 — Story Engine (Add Deed)
- Four-step wizard, photo + video upload, audio recording, tags, tagging people.
- Draft autosave so a long story is never lost.

### Sprint 5 — Feed, appreciation & comments
- Chronological feed of Deed cards; Applaud/Inspire/Cherish/Love with haptics.
- Threaded comments ("Add to the story…").
- Private "Flag for Admin Review".

### Sprint 6 — Family Tree & Profiles
- Add people, link parent/child/spouse, pan-and-zoom canvas.
- Profile screen with that person's deeds.

### Sprint 7 — Polish, accessibility audit & launch
- Font-scaling and screen-reader pass on every screen (see UI/UX checklist).
- Empty states, error states, offline behaviour.
- Store listings, privacy policy, TestFlight / internal testing with 3 real families.

## V1.1
- Shared Family Calendar with auto birthdays/anniversaries.
- "On This Day" + weekly Story Prompts.
- Push notifications (milestones only — never engagement bait).

## V2.0 — the paywall
- Family Premium subscription (RevenueCat), storage tiers.
- **Digital Heirloom Export** → PDF / e-book Family Book.
- Legacy Contact.

## V2.1+ backlog
- **Famous Deeds** — archive search with mandatory Admin review. Premium-only.
  *Built after the paywall, because it exists to drive upgrades and it costs money per search.*
- AI Story Assistant (Gemini) — draft-only, user always edits.
- AI photo enhancement / colorization; opt-in photo animation.
- Facial recognition tag suggestions; handwriting OCR; conversational search.
- Print-on-demand physical Family Book.
- Framed prints of restored photos and rendered trees.
