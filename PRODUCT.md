# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

The primary user is the **Family Champion**: usually the relative who creates the family circle, invites everyone else, coordinates practical care or events, and recognizes that family knowledge is disappearing unless somebody preserves it. They are often balancing several jobs at once—organizer, caregiver, archivist, and connector.

The product must also work for the whole family circle:

- older relatives who may prefer speaking to typing and have low confidence with unfamiliar interfaces;
- adult relatives participating casually through chat, photos, reactions, memories, care, and planning;
- children, whose accounts require stricter audience controls and safe defaults;
- living and deceased relatives represented in the family graph even when they never have an account.

Product decisions optimize first for the Family Champion successfully activating and sustaining the circle, while making contribution effortless and dignified for every generation.

## Product Purpose

Close Knit is a **private family home that keeps what matters**. It should be useful during ordinary family life—talking, sharing photos, coordinating care, remembering dates—and make it natural to preserve selected stories, voices, recipes, letters, photographs, and heirlooms before they disappear.

Success means a family returns for everyday utility, contributes across generations, and accumulates a trustworthy record that outlives the person who first organized it. Preservation should feel like a consequence of family life, not a separate archival chore.

## Positioning

The neighboring product is the family WhatsApp group, not conventional genealogy software. Messaging products win daily attention but lose family knowledge in a stream; heritage products preserve structure but are rarely lived in.

Close Knit combines an active, invitation-only family circle with deliberate permanence: ordinary conversation and quick sharing can be promoted into attributed, structured family records, while care and kinship context remain attached to the same private circle. A generic social network or public family-tree product could not truthfully make that combined promise without changing its operating model.

## Operating Context

- One Family Champion creates a private circle and recruits relatives.
- Family members primarily use the product on phones in short, recurring sessions.
- iOS and Android are the authoritative product experiences. The browser is a companion, invitation, access, preview, and development surface rather than the interaction model to optimize first.
- The Hearth is the daily entry: recent family stories alongside quick sharing, chat, care signals, family dates, and gentle prompts.
- Contribution has two speeds: **Quick Share** for ordinary photos or notes today, and **Add to Journal** for memories, lore, milestones, hard times, remembrance, and great deeds worth keeping.
- Chat and voice notes are ordinary family communication; a person explicitly decides when material should enter the permanent Family Journal or Voice Vault.
- The Family Journal is chronological and private. The Archive holds deliberately curated heirloom objects such as recipes, letters, voices, photographs needing identification, and family objects with provenance.
- Care coordination deals with real-world visits, medication, meals, notes, and emergency information where ambiguity or diffusion of responsibility can cause harm.
- Kinship is a graph of people and relationships, not an idealized nested tree.

## Capabilities and Constraints

- Private, invitation-only family circles with no public search or social discovery.
- People and user accounts are distinct: most people in a family history never log in.
- Audience controls include the whole family, adults only, a care circle, or one family branch; enforcement belongs on the server, not only in the client.
- Six permanent memory registers: memory, great deed, milestone, hard time, in memory, and family lore. Reactions and resurfacing behavior must respect the emotional register.
- Memories support fuzzy human time and place rather than demanding false calendar or map precision.
- Quick shares, messages, voice notes, reactions, comments, care coordination, recipes, letters, objects, photo identification, and family profiles are part of the product model.
- Media is private and accessed through expiring signed URLs; permanent public media URLs are not acceptable.
- Grief-sensitive content is never resurfaced automatically by default. Memorialising a person must silence inappropriate prompts and reminders.
- AI may reduce work through transcription, OCR, tagging suggestions, or editable drafts. It must never invent family history or publish unapproved claims as fact.
- Core use must not depend on paid third-party APIs. Advanced AI, archive discovery, exports, and physical products may be later or premium capabilities.
- Full family-data export is a standing no-lock-in commitment, even if implementation is not complete.
- Open decision: the final store-facing product name. **Close Knit** is the current working display name; **knitclose** is the repository/domain identifier. Earlier “Great Deeds” naming describes one story type, not the whole product.

## Brand Commitments

- Working product name: **Close Knit**. Repository and domain identifier: **knitclose**.
- Existing logo artwork and generated app assets live in `design/screen.png` and `assets/`; future work must not replace them casually or fabricate a new identity by default.
- The privacy promise is substantive: no advertising, no sale of family data, no public discovery, and clear control over who can see sensitive material.
- Voice is plain, warm, specific, and non-technical. The interface names family actions rather than infrastructure operations.
- Appreciation is expressed with context-sensitive family language such as Cherish, Love, Hold, Strength, Applaud, and Inspire rather than generic engagement mechanics.

## Evidence on Hand

- Product strategy and user model: `ideas.md`, `docs/great_deeds_strategy.md`.
- Capability specification: `docs/great_deeds_features.md`, `docs/memory_kinds.md`, `docs/archive_contents.md`, `docs/backend.md`.
- Implemented mobile application and interaction evidence: `src/`, `App.tsx`, and the device screenshots supplied during development.
- Existing identity assets: `design/screen.png`, `assets/logo-mark.png`, `assets/logo-lockup.png`, `assets/logo-wordmark.png`, app icons, splash image, and favicon.
- Real backend model and executable privacy boundaries: `server/`, PostgreSQL migrations, and MinIO/S3-compatible private media storage.
- Development fixtures demonstrate product behavior but are not customer evidence and must never appear in a real family circle.
- No verified customer testimonials, usage benchmarks, press claims, pricing validation, or market-performance evidence are currently on hand. Future work must not fabricate them.

## Product Principles

1. **Earn the archive through everyday usefulness.** A family will only trust its history to a place it already uses on an ordinary Tuesday.
2. **Make contribution easier than omission.** Offer quick sharing, voice, forgiving human dates and places, and short paths before asking for archival structure.
3. **Preserve truth, provenance, and dignity.** Attribute records, keep original media, distinguish machine guesses from human confirmation, and never manufacture memory.
4. **Make privacy and responsibility visible.** People should know which circle they are speaking into, who can see something, and who has claimed a care task before acting.
5. **Design for the whole family, especially the least confident participant.** The Family Champion activates the circle; elders, children, and occasional contributors determine whether it survives.

## Accessibility & Inclusion

- Multi-generational accessibility is foundational. Body copy, controls, and navigation must remain readable with system font scaling and low confidence or low dexterity.
- Touch targets should be at least 48×48 points, with clear labels and no essential gesture-only actions.
- Voice contribution is a primary access path, not an optional novelty.
- Forms must remain operable with the on-screen keyboard visible and must preserve a person's work when network or upload errors occur.
- Family structures must accommodate divorce, remarriage, adoption, estrangement, blended families, deceased relatives, and people without accounts without implying an idealized family.
- Sensitive care, child, grief, and adult material requires respectful defaults and server-enforced audience boundaries.
