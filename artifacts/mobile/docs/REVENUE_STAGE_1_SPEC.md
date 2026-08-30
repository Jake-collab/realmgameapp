# Worlds Build 1 — Stage 1 Revenue Specification

**Status:** Stage 1 complete; documentation and implementation planning only  
**Canonical date:** 2026-08-30  
**Scope:** Worlds membership, Quest allowances, Hunt Drop allowances, Extra Drop Credits, Find Badges, Collectibles, and the future provider-neutral marketplace  
**Implementation status:** No Stage 2 database, payment, production Supabase, Mapbox, or application changes are included in this document update.

This document is the canonical Stage 1 interpretation of the revenue requirements. It supersedes older generic monetization language where the two conflict. It does not authorize payment-provider setup or implementation.

## Stage 1 revenue model status

**PASS**

The business rules are sufficiently defined to implement the internal Stage 2 model without selecting a payment provider. Provider selection, store policy validation, and external checkout belong to Stage 3.

## Current Worlds baseline

The current codebase already has:

- Separate Quest and Hunt domains and point ledgers.
- Server-authoritative Quest verification, completion, and points.
- Server-authoritative Hunt Drop discovery/collection, location validation, and Hunt points.
- `hunt_stops` as the canonical Hunt Drop entity. A second `hunt_drops` table must not be introduced.
- Private Hunt validation geometry and an online-only collection flow.
- Existing profile/progression badges and statistics.
- Existing creator Hunt draft, review, publication, and deactivation-oriented architecture.
- Existing mobile destinations for Hunt, My Hunts, Profile, Progress, and the Achievements hub.
- An authenticated API server and staff-authorized Worlds Admin application.

The current codebase does **not** yet implement membership entitlements, weekly Quest/Hunt allowances, Extra Drop Credits, collectible acquisition, marketplace transactions, per-Drop Find Badges, seller balances, or provider webhooks. Those are Stage 2 work.

## Current code conflicts

1. **Old roadmap monetization wording:** the existing future-build roadmap describes monetization as RevenueCat, premium Quest packs, creator revenue share, and unlimited access. That wording is superseded by this specification. The canonical model is one provider-neutral membership with fixed allowances, separate Extra Drop Credits, and a provider-neutral collectible marketplace.
2. **Generic marketplace wording:** the constitution describes a future marketplace and cosmetics at a high level but does not define this revenue model. This specification supplies the canonical meaning for the Worlds marketplace.
3. **No current commerce model:** the current schema and application have no membership, allowance, credit, collectible, marketplace, seller, refund, or payout implementation. This is an expected capability gap, not a reason to change QVAC, QAVS, Quest points, Hunt points, or the existing Hunt Drop security boundary.
4. **Existing Drop collection semantics:** the current secure Hunt flow records a verified Drop collection and Hunt-point event, but it does not yet separate a successful find from collectible acquisition. Stage 2 must add that distinction while preserving the current verified Hunt flow and its points rules.
5. **Existing badges:** the current badge system is for progression recognition. A permanent per-Drop Find Badge needs a distinct source/type and immutable Drop snapshot; it must not be confused with a generic achievement badge or with collectible ownership.

## Canonical membership rules

Worlds has exactly **one membership** covering both Quest and Hunt.

| Plan | Price | Quest benefits | Hunt benefits |
|---|---:|---|---|
| Free | $0 | 10 Monthly Quests per applicable monthly period; 1 Geo-Quest/week; 1 Daily/Personalized Quest/week | 2 Drop creations/week; unlimited hunting |
| Worlds Membership | $4.99/month or $44.99/year | 50 Monthly Quests per applicable monthly period; 2 Geo-Quests/week; 1 Daily/Personalized Quest/day | 5 Drop creations/week; unlimited hunting |

The yearly plan has the same entitlements as the monthly plan and differs only in billing cadence.

Membership status must eventually be represented by internal, server-authoritative entitlement state. Core product logic must not depend on a provider-specific subscription response or a mobile client claim.

Membership changes access and allowance ceilings only. Membership never weakens Quest verification, QVAC, QAVS, proof, GPS, timer, integrity, activity-tracking, Hunt verification, or points rules.

### Stage 2 period convention

To make allowance resets deterministic and independent of device timezone or daylight-saving changes:

- Monthly Quest periods use the UTC calendar month.
- Weekly periods use ISO weeks beginning Monday at `00:00:00 UTC`.
- Daily personalized Quest periods use the UTC calendar day.
- The server creates or resolves the current period during an allowance check; no client reset action exists.
- A membership upgrade increases the currently available ceiling for the current period. A downgrade does not erase usage or revoke already-earned content; it applies the lower ceiling to future consumption, with the next period starting cleanly.

## Canonical Quest allowances

Free users:

- 10 Monthly Quests per applicable monthly Quest period/drop.
- 1 Geo-Quest per week.
- 1 Daily/Personalized Quest per week.

Worlds Members:

- 50 Monthly Quests per applicable monthly Quest period/drop.
- 2 Geo-Quests per week.
- 1 Daily/Personalized Quest per day.

“Daily Quest” remains the existing personalized Quest system. It is generated/assigned through the existing Interest Bubble architecture. Stage 2 must not add a separate consumer-facing Personal Quest category.

An allowance controls access to eligible Quest content. It does not grant completion, bypass verification, award points, or change any Quest requirement.

## Canonical Hunt allowances

Free users:

- 2 included Drop creations per UTC ISO week.
- Unlimited hunting, finding, and collecting other users’ eligible Drops.

Worlds Members:

- 5 included Drop creations per UTC ISO week.
- Unlimited hunting, finding, and collecting other users’ eligible Drops.

Finding or collecting another user’s Drop never consumes the user’s Drop-creation allowance.

The included weekly allowance and Extra Drop Credits are separate balances. The creation order is always:

1. Consume an available included weekly Drop.
2. Only after the included balance is exhausted, consume one Extra Drop Credit.
3. Reject creation when neither balance is available.

The UI must show the included weekly balance and Extra Drop Credits as separate values. No new bottom-navigation tab is needed.

## Drop Credit rules

Canonical provider-neutral packs:

| Price | Credits |
|---:|---:|
| $1.99 | 5 |
| $4.99 | 15 |
| $9.99 | 35 |

One Extra Drop Credit permits one additional Drop creation beyond the included weekly allowance.

Credits are:

- Account-bound.
- Consumable one at a time by an atomic server operation.
- Granted only through a trusted internal purchase/grant path.
- Tracked by an append-only server-authoritative ledger.
- Non-expiring.
- Preserved after membership cancellation.
- Independent of the included weekly allowance.
- Not Hunt Points, Quest Points, membership, or collectible ownership.

Stage 2 must not assume Stripe, Apple In-App Purchase, or Google Play Billing is the checkout rail.

## Drop find limit rules

Each creator may configure a Drop’s independent find limit as either:

- A positive integer quantity; or
- Unlimited.

The find limit controls successful verified discovery, not collectible ownership.

When the configured number of valid users has found the Drop:

- No new users may find it.
- It disappears from active Hunt discovery/map results.
- Existing find history, Find Badges, collectible ownership, and accounting history remain.

The final available find must be allocated through a row lock or an equivalent atomic database operation so simultaneous requests cannot exceed the configured limit.

Creation UI must warn:

> When the find limit is exhausted, this Drop will disappear from active Hunt discovery.

Manual creator deactivation also removes the Drop from active discovery and prevents new finds without deleting historical records.

## Collectible quantity rules

The collectible acquisition limit is independent from the Drop find limit. A creator may configure:

- A positive collectible quantity; or
- Unlimited quantity.

Examples:

- Find limit 100 and collectible quantity 5: up to 100 verified finds, but only 5 collectible acquisitions.
- Collectible quantity exhausted first: the Drop remains findable, users still receive the Find Badge, the collectible shows Sold Out, and new ownership is rejected.
- Find limit exhausted first: the Drop leaves active discovery while existing ownership and badge history remain.

The last available collectible must be allocated atomically. A concurrent final acquisition cannot create two ownership records.

## Badge versus Collection rules

### Find Badges

Every successful verified Drop find awards a permanent Find Badge, whether or not the user acquires the associated collectible.

A Find Badge means:

> I successfully found this Drop.

It remains when:

- The user declines a paid collectible.
- The collectible sells out.
- The creator deactivates or removes the Drop.
- A paid collectible purchase is refunded.

Find Badges need an accessible gallery integrated into existing Hunt, Profile, Progress, or My Hunts architecture. They should not require another bottom-navigation tab.

Each Find Badge must carry immutable snapshot data sufficient to remain understandable after the source Drop changes or disappears. At minimum, the snapshot should cover Drop identity, title/name, creator attribution as appropriate, collectible reference/name if relevant, rarity classification, and find timestamp.

### Collectibles

A collectible is distinct from the Find Badge. The collectible image and display metadata are granted only after successful acquisition:

- A free collectible is added after a successful $0 claim.
- A paid collectible is added only after the purchase is successfully finalized.
- Finding a Drop alone never grants a collectible.
- Declining a paid offer awards the Find Badge but does not add collection ownership.
- Collection shows only actually acquired collectibles.

Collection should be surfaced inside existing My Hunts, Profile, or Progress architecture and should show, where available:

- Image.
- Name.
- System-derived rarity.
- Creator attribution.
- Acquisition date.
- Free versus purchased state.

Ownership history survives source Drop removal or deactivation.

### Distinct statistics

The product and server reporting must keep these separate:

- Drops Found.
- Find Badges Earned.
- Collectibles Acquired.
- Drops Created.

Finding a Drop and earning its badge does not imply collectible acquisition.

## Rarity rules

Rarity is system-derived. Creators cannot select it manually.

Initial collectible scarcity scale:

| Rarity | Available quantity |
|---|---:|
| UNIQUE | 1 |
| LEGENDARY | 2–5 |
| EPIC | 6–20 |
| RARE | 21–50 |
| UNCOMMON | 51–100 |
| COMMON | 101+ or Unlimited |

Rarity primarily describes collectible scarcity. If a Drop has no collectible, the system may expose a separate Find rarity derived from the find limit, but Find rarity and collectible rarity must not be conflated.

When a collectible Drop goes live, its rarity classification must be snapshotted for already-created ownership and Find Badge records. Future policy threshold changes must not rewrite historical classifications.

## Marketplace rules

Creators choose either:

- Free collectible: `$0`.
- Paid collectible: creator-selected price with a launch minimum of `$1.00`.

Money is stored as integer minor currency units, never floating-point values. Currency is stored explicitly.

Before publishing a paid collectible, the creator must see:

> Worlds charges a 30% platform fee on collectible sales.

The accounting model must preserve separate values for:

- Gross buyer price.
- Worlds platform fee.
- Intended creator/seller economic share.
- Payment processing fees.
- App-store/platform fees.
- Taxes.
- Refunds.
- Chargebacks/reversals.
- Actual seller payable amount.

The intended pre-external-fee economics are 70% creator/seller share and 30% Worlds platform fee. The product must not promise that 70% of the buyer price is the final cash payout until the selected payment architecture establishes external fee handling.

Membership and Extra Drop Credits are separate economic categories from user-created collectible marketplace transactions and seller payouts. Purchasing a collectible must not award extra Hunt Points unless an existing legitimate Hunt completion rule independently does so. No revenue feature may create pay-to-win leaderboard behavior.

Stage 2 should expose admin-configurable:

- Paid collectible minimum price.
- Paid collectible maximum/safety limit.
- Platform fee percentage.
- Rarity thresholds.

The maximum is a safety setting, not a permanent hard-coded product maximum.

## Refund / reversal rules

Stage 2 uses provider-neutral transaction states and immutable transaction events.

A fully refunded or reversed paid collectible transaction normally:

- Revokes or disables the paid collectible ownership/access.
- Preserves the historical Find Badge.
- Reverses or adjusts seller payable proceeds.
- Records the platform accounting reversal.
- Retains the original transaction and its audit trail.

Chargebacks and disputes must be representable without erasing history. The accounting model must support partial refunds even if the launch UI does not expose manual partial-refund controls.

## Seller / payout rules

Users do not connect a card or bank account at signup.

- Buyers provide a payment method only when a paid collectible purchase requires it.
- Creators of only free collectibles do not need payout onboarding.
- Publishing a paid collectible requires or guides the creator through seller payout onboarding before paid sales are enabled.
- Earnings are represented by a seller balance/payable model, not an immediate bank payout per collectible.
- Payout timing follows the eventual provider’s supported schedule.

Exact seller onboarding, connected-account, and payout provider behavior is Stage 3.

## Payment-provider boundaries

Stage 2 core systems consume canonical internal entitlement and transaction state. They do not trust provider-specific client responses.

The internal model must be able to accept trusted server-side events from:

- Apple.
- Google.
- Stripe.
- Another approved provider if selected later.

Provider identifiers are stored separately from canonical internal IDs. The mobile client is never authoritative for:

- Membership status.
- Credit grants.
- Seller earnings.
- Collectible purchase success.
- Refunds.
- Payment state.
- Entitlements.
- Ownership.

Provider webhook/event ingestion must be idempotent, signature-verified by the selected provider adapter, and mapped to immutable internal events.

## App Store / Play Store considerations

Architectural considerations only; no implementation is authorized in Stage 1:

- Re-check current Apple and Google rules immediately before Stage 3 production payment work.
- Treat Worlds Membership, Extra Drop Credits, marketplace collectible purchases, and seller payouts as separate economic categories.
- Determine per platform, country, product type, and launch policy whether Apple/Google billing, permitted alternative billing, web checkout, or another compliant route is available.
- Do not disguise digital purchases as physical goods.
- Do not use deceptive redirects or prohibited payment steering.
- Do not assume a permanent universal store fee percentage.
- Keep product identifiers and entitlement state flexible enough to support platform-specific catalogues without changing core internal IDs.
- Model store/platform fees, taxes, refunds, and chargebacks explicitly rather than silently subtracting them.

## Stage 2 required Supabase changes

No migrations are created or applied in Stage 1. Future migrations must be forward-only after the current `001–070` history.

### Anticipated tables

1. **Membership catalog and entitlements**
   - Membership plan definitions for monthly and yearly plans.
   - Internal user membership entitlement records.
   - Immutable membership entitlement events and provider-event mappings.
2. **Allowance periods and usage**
   - Server-created UTC period records for monthly Quest, weekly Quest, daily personalized Quest, and weekly Drop creation allowance.
   - Usage rows or ledger events with unique user/period/allowance keys.
3. **Drop Credits**
   - Credit pack definitions.
   - Append-only credit grant/consumption/reversal ledger.
   - Provider references kept separate from internal grant and ledger IDs.
4. **Drop commerce configuration**
   - Extensions to canonical `hunt_stops` or a one-to-one Drop commerce table for find limit, find count/status, collectible reference, and deactivation state.
   - Do not introduce a competing `hunt_drops` entity.
5. **Collectibles**
   - Collectible definitions and immutable display metadata.
   - Quantity, price in integer minor units, currency, free/paid state, sale status, creator attribution, and rarity snapshot.
   - Acquired collectible ownership records.
6. **Find events and Find Badges**
   - Immutable, idempotent verified find records.
   - Per-user Find Badge records with immutable Drop and rarity snapshots.
   - A unique user/Drop constraint.
7. **Marketplace accounting**
   - Provider-neutral transaction/order records.
   - Immutable payment/refund/reversal/chargeback events.
   - Seller balance/payable ledger.
   - Auditable platform fee and external-fee components.
   - Seller onboarding/status records.
8. **Configuration and audit**
   - Admin-configurable pricing, fee, rarity, and safety settings with effective dates/versioning.
   - Audit records for membership, credit, entitlement, pricing, supply, ownership, refund, seller, and admin changes.

### Anticipated enums or constrained values

- Membership billing cadence and entitlement status.
- Allowance kind and period status.
- Drop Credit ledger event type.
- Free/paid collectible and transaction state.
- Refund, reversal, chargeback, dispute, and payout state.
- Seller onboarding state.
- Find Badge source/type.
- Universal collectible rarity.

Use existing project enum/constrained-value conventions and preserve nullable legacy fields where needed.

### Anticipated RPCs/functions

All sensitive transitions must be authenticated and server-authoritative:

- Resolve current membership entitlement.
- Resolve current Quest and Hunt allowances.
- Consume Quest allowance.
- Consume included Drop allowance first, then one Extra Drop Credit atomically.
- Grant or reverse credits through trusted service/admin/provider paths.
- Create/activate/deactivate a creator Drop with allowance enforcement.
- Record a verified Drop find with atomic find-limit enforcement.
- Award an idempotent Find Badge.
- Claim a free collectible with atomic quantity enforcement.
- Create a paid collectible purchase intent.
- Finalize a provider-confirmed purchase.
- Revoke/reverse/refund ownership and seller payable entries.
- Read owner-scoped Membership, allowance, Credit, Find Badge, Collection, transaction, and statistics views.
- Staff/admin operations for catalogues, safety limits, moderation, refund visibility, seller status, and suspicious activity.

Existing `complete_quest`, QVAC/QAVS, Hunt verification, `collect_hunt_drop`, and Hunt point ledger behavior remain authoritative and are extended only at explicit integration points.

### RLS, indexes, and constraints

- Enable and force RLS on every new table.
- Prevent client inserts, updates, or deletes for entitlement, credit, supply, transaction, ownership, seller balance, and audit state.
- Restrict owner reads to the user’s own private commerce and collection records.
- Keep provider secrets, webhook payload signatures, private payment details, and seller payout details out of mobile-readable tables.
- Use unique idempotency keys for provider events, credit consumption, finds, acquisitions, and refunds.
- Use row locks or equivalent atomic constraints for weekly allowance consumption, find limits, collectible quantity, and final-item races.
- Add indexes for owner/period lookup, active discovery filtering, collectible availability, transaction reconciliation, and audit queries.
- Use integer minor currency units and explicit currency codes.
- Preserve historical records with soft deactivation and `ON DELETE RESTRICT`/snapshot semantics where required.

### Scheduled/reset jobs

- No client-driven reset exists.
- Server resolution handles the current UTC period on read/consume.
- Scheduled maintenance may archive or compact old period records only under an explicit retention policy and without removing financial, ownership, badge, or audit history.
- A trusted worker must reconcile provider events, expire stale purchase intents, and maintain marketplace operational state once Stage 3 provider adapters exist.

### Retention requirements

- Preserve transactions, refunds, reversals, chargebacks, seller ledger entries, ownership, Find Badges, and audit records for the required financial/legal retention period.
- Minimize provider payload and payment-sensitive data; retain references and normalized facts rather than unnecessary raw payloads.
- Do not delete a legitimate Find Badge or acquired collectible because the source Drop is deactivated.
- Apply account deletion/anonymization rules only after financial, ownership, and legal-retention requirements are reconciled.

## Stage 2 required application changes

### Mobile

- Add provider-neutral membership, allowance, credit, Find Badge, collectible, and acquisition types/repositories/hooks.
- Add a clear Membership screen or modal reachable from existing Profile, Settings, Progress, or Quest/Hunt surfaces.
- Show the Free and Worlds Membership comparison with the exact prices and allowances.
- Show included weekly Drop balance separately from Extra Drop Credits.
- Add passive, non-repeating Quest upsell near the end of available free Quest content.
- Add passive Hunt creation copy near the allowance/action; do not use disruptive repeated modals.
- Keep the existing Quest/Hunt navigation and do not add unnecessary bottom tabs.
- Add creator Drop fields for find limit, collectible choice, quantity, price, and required warnings/disclosures.
- Add a post-find flow that always confirms the Find Badge separately from optional free claim or paid purchase.
- Add Sold Out and deactivated/discovery-unavailable states.
- Add Find Badge gallery and Collection surfaces within existing Hunt/Profile/Progress/My Hunts architecture.
- Add distinct statistics for Drops Found, Find Badges Earned, Collectibles Acquired, and Drops Created.
- Never let client state grant membership, credits, ownership, completion, points, or seller proceeds.

### API and Admin

- Add provider-neutral schemas for plans, entitlements, allowances, credit packs, collectibles, orders, refunds, seller status, and accounting.
- Add staff-only catalogue, safety-limit, fee, rarity, transaction, refund, seller, suspicious-activity, and Drop-deactivation controls.
- Add visible audit history for financial and entitlement transitions.
- Keep provider adapters and secrets server-side only.
- Do not weaken existing Admin authorization or content moderation.

### Verification and regression coverage

- Unit-test period boundaries, membership transitions, exact allowance ceilings, and included-before-credit ordering.
- Add connected Supabase tests for self-grant prevention, reset prevention, credit idempotency, concurrent final Drop finds, concurrent final collectible acquisition, deactivation preservation, badge/collection separation, refund reversal, RLS, and cross-user privacy.
- Add mobile tests for membership display, passive upsell visibility, allowance copy, creator warnings, Sold Out behavior, badge awarding without acquisition, free acquisition, paid-purchase pending/failure/success, and preserved history.
- Retain the existing QVAC/QAVS, Quest point, Hunt point, Hunt verification, social privacy, and Admin authorization suites unchanged except for explicit integration assertions.

## Stage 3 external payment connections

Eventually, Stage 3 will need a selected, compliant connection for the relevant products:

- Apple In-App Purchase / App Store subscription and consumable product configuration, if required for iOS.
- Google Play Billing subscription and consumable product configuration, if required for Android.
- A permitted web or external checkout provider for products where legally and operationally appropriate.
- A marketplace payment provider or marketplace-capable alternative for paid collectible transactions.
- Seller payout/onboarding capability.
- Provider webhook/event delivery, signature verification, reconciliation, refund, dispute, and payout operations.
- Store-country, tax, fee, and policy configuration.

No provider is selected or connected by Stage 1.

## Unresolved product decisions

**NONE for Stage 1 or the provider-neutral Stage 2 core.**

Payment-provider selection, platform routing, seller onboarding provider, and current Apple/Google policy interpretation are intentionally Stage 3 decisions, not blockers for implementing the internal entitlement and accounting boundaries.

## True blockers before Stage 2

**NONE**

Stage 2 can begin with provider-neutral Supabase and application implementation. It must not apply production migrations or connect payment providers until the implementation and connected tests are complete.

## Exact Stage 2 implementation plan

1. **Freeze contracts and compatibility boundaries**
   - Treat this document as the revenue source of truth.
   - Confirm current migration parity remains `001–070`.
   - Define TypeScript/API/database contracts without changing QVAC, QAVS, Quest points, Hunt points, or existing navigation.
2. **Implement internal membership and allowance state**
   - Add plan catalog, internal membership entitlement state, UTC period resolution, allowance usage, and audit events.
   - Add atomic Quest allowance checks and consumption.
   - Add the unified Membership screen and passive upsell copy.
3. **Implement weekly Drop allowance and Extra Drop Credits**
   - Add included weekly allowance and credit-pack catalogue.
   - Add append-only credit ledger and idempotent trusted grant path.
   - Add the atomic included-first Drop creation operation.
   - Add creator and mobile allowance UI without a new tab.
4. **Extend the canonical Hunt Drop model**
   - Add creator-configurable find limits and deactivation state to the existing `hunt_stops`-based Drop model.
   - Add atomic verified find events and discovery filtering.
   - Preserve current private geometry, collection-session, Hunt verification, and Hunt-point behavior.
5. **Separate Find Badges from Collectibles**
   - Add immutable Find Badge snapshots and idempotent awarding.
   - Add collectible definitions, rarity snapshots, quantity constraints, and owner-only Collection.
   - Implement free claims and Sold Out behavior with atomic supply enforcement.
6. **Add provider-neutral marketplace accounting**
   - Add purchase intents, finalized transactions, immutable payment events, refund/reversal/chargeback states, seller balances, fee components, and seller onboarding state.
   - Keep provider identifiers separate from canonical IDs.
   - Add creator fee disclosure and paid-listing gating.
7. **Add Admin and audit operations**
   - Add plan/allowance/pack/pricing/fee/rarity controls.
   - Add transaction, refund, seller, suspicious-activity, and Drop-deactivation visibility.
   - Audit all financial and entitlement changes.
8. **Integrate mobile and statistics**
   - Add membership, allowance, credit, creator, find, badge, acquisition, Collection, and lifetime-statistics UI within existing architecture.
   - Keep purchased collectibles and Find Badges independent.
9. **Run connected security and concurrency validation**
   - Test RLS, IDOR resistance, self-grant prevention, allowance reset prevention, included-before-credit ordering, final-find races, final-quantity races, refund preservation, and deactivation history.
   - Run full mobile/API/Admin regression and typechecks.
10. **Prepare Stage 3 without starting it**
    - Document provider adapter interfaces and reconciliation contracts.
    - Re-check live store policies and choose compliant rails only immediately before external payment implementation.
    - Do not connect providers as part of Stage 2 planning.

## Stage 1 boundary confirmation

This Stage 1 update does not:

- Connect Stripe.
- Connect Apple In-App Purchase.
- Connect Google Play Billing.
- Configure payment-provider secrets.
- Create payment products or prices in an external provider.
- Modify production Supabase.
- Apply database migrations.
- Start Mapbox.
- Alter QVAC, QAVS, Quest points, Hunt points, existing Hunt verification, social architecture, or Admin authorization.

STAGE 1 REVENUE SPECIFICATION: COMPLETE
READY FOR STAGE 2 SUPABASE + APPLICATION IMPLEMENTATION