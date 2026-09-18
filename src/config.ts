/**
 * Single source of truth for product naming.
 *
 * The repo and domain are "knitclose" because that was the available domain.
 * The display name is still being decided ("Close Knit" vs "Great Deeds"), so it
 * lives here alone -- changing the name later is a one-line edit, not a refactor.
 */
export const APP_NAME = "Close Knit";
export const APP_TAGLINE = "Your family's great deeds, kept safe.";
export const PRIVACY_PROMISE =
  "Everything you add here is visible only to the people in your family circle. " +
  "There are no ads, we never sell your information, and you can download all of " +
  "your family's stories and photos at any time.";
/**
 * Weekly prompts for families who do not know what to post.
 *
 * These live here, NOT in mockData.ts. They are product copy that applies to every
 * family, whereas mockData is a development fixture describing one specific family --
 * and anything a screen imports at runtime must not come from that file, or a real
 * family ends up looking at the Millers. See docs/backend.md.
 */
export const STORY_PROMPTS = [
  "What is your favourite memory of your grandparents?",
  "Share the story of how your parents met.",
  "Ask an elder relative about their first job, and post the story.",
  "What is a family recipe nobody has written down yet?",
  "Who in this family took the biggest risk, and did it work out?",
  "What object in your home has the best story attached to it?",
];
