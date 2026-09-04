# Stage 3 free-mode implementation status

This document records the Stage 3 work that is safe to complete without a
public API deployment, provider credentials, store-console changes, or signed
device builds.

## RevenueCat

**Local implementation: PASS**

- Mobile RevenueCat identity, offerings, purchase, restore, account-switch, and
  logout flows are already present.
- Membership and Drop Credit purchases use the provider-neutral catalog codes.
- Paid Collectible checkout creates the server purchase intent first and passes
  the resulting order ID as a RevenueCat subscriber attribute.
- The API webhook requires the server-only Authorization value, performs
  constant-time comparison, validates UUIDs and transaction identity, and
  forwards only normalized facts to the trusted Supabase adapter.
- Migration 074 is the idempotent RevenueCat adapter. Migration 075 is the
  proof-session issuer repair and is preserved unchanged.
- Client purchase callbacks never grant membership, credits, ownership, or
  seller balance.

**Live RevenueCat webhook delivery: PENDING API PUBLICATION**

The documented URL is not currently serving the API. No live delivery or retry
claim is made in free mode.

## Canonical product catalog

The provider-neutral catalog remains:

| Internal code | Category | Amount | Quantity/entitlement |
|---|---|---:|---|
| `worlds_monthly` | Membership | USD 4.99 | `worlds_membership` |
| `worlds_yearly` | Membership | USD 44.99 | `worlds_membership` |
| `drop_credits_5` | Drop Credits | USD 1.99 | 5 credits |
| `drop_credits_15` | Drop Credits | USD 4.99 | 15 credits |
| `drop_credits_35` | Drop Credits | USD 9.99 | 35 credits |

`artifacts/api-server/src/payments/catalog.ts` and the mobile revenue types
assert these canonical values. RevenueCat maps to the internal codes. Apple,
Google Play, and Stripe IDs are explicit owner-configured `null` placeholders;
no live IDs are invented.

## Apple architecture

**Architecture: PARTIAL / provider-ready**

The internal membership and consumable model is ready for Apple mapping, and
RevenueCat remains the native orchestration layer. The following still require
owner setup in App Store Connect and RevenueCat:

- matching iOS app for bundle ID `com.worlds.mobile`;
- monthly and yearly auto-renewable subscriptions;
- three consumable Drop Credit products;
- real product IDs, prices, localizations, agreements, tax, and banking;
- RevenueCat iOS products, entitlement, and offering configuration;
- signed TestFlight purchase, restore, refund, expiration, billing-issue, and
  account-switch validation.

No StoreKit production transaction credentials or product IDs are stored in the
repository.

## Google Play architecture

**Architecture: PARTIAL / provider-ready**

The provider-neutral model is ready for Google Play mapping, but Play-specific
IDs and adapters are not fabricated. Owner setup still requires:

- matching Play Console app for package ID `com.worlds.mobile`;
- monthly and yearly subscription base plans;
- three one-time Drop Credit products;
- regional prices, billing/tax configuration, and internal testers;
- RevenueCat Android products, entitlement, and offering configuration;
- signed Android acknowledgement/consumption, restore, refund/revocation,
  billing-issue, and account-switch validation.

Purchase-token/order identity and acknowledgement/consumption remain provider
adapter responsibilities; they do not change the Stage 2 ledgers.

## Paid Collectibles and seller payouts

**Payment design: PENDING PROVIDER DECISION**

Stage 2 remains the canonical order, fee, ownership, seller-ledger, refund, and
reversal model. A creator-selected amount is represented internally as
`collectible_<grossMinor>`, but that does not prove that an arbitrary price is
available as a native Apple or Google product.

The compliant routing boundary is:

- native mobile digital-goods routes only when the relevant store product exists
  and the storefront policy permits it;
- eligible web marketplace checkout through Stripe/Connect after Stripe is
  connected and seller eligibility is trusted;
- `UNAVAILABLE` when no compliant provider route is available.

No client-selected provider, ownership grant, payout, tax calculation, identity
document, or bank-detail collection was added.

## Provider-neutral Stripe/Connect preparation

Stripe is **not connected** and no Stripe SDK or secret was added. The following
local-only contracts now exist under `src/payments/`:

- payment intent, payment, refund, dispute, seller account, and payout states;
- payment, seller, and payout provider ports;
- server-controlled routing by platform, category, product mapping, provider
  availability, and seller eligibility;
- webhook normalization and reconciliation matcher ports;
- conservative seller, payout, and dispute status mapping;
- deterministic canonical catalog and collectible product-ID helpers;
- pure duplicate, unknown-event, provider, transaction, amount, and currency
  reconciliation results.

These contracts are intentionally not wired to Stripe until the owner connects
the provider and confirms the eligible web checkout policy.

## Admin and reconciliation

The protected Admin revenue response and UI now show:

- provider name and provider transaction IDs on marketplace transactions;
- provider name and event IDs on immutable transaction events;
- bounded `revenue_external_events` ingestion history;
- provider event counts and latest received timestamp;
- explicit copy that ingestion visibility is not the same as completed
  reconciliation or provider refund execution.

The existing staff/admin authorization boundaries remain in force. Provider
secrets and raw provider payloads are not returned.

Full settlement comparison, payout execution, dispute resolution, and automatic
replay/repair remain blocked until a provider connection and the required
trusted production path exist. No migration was added for those operations.

## Testing

- API typecheck: PASS.
- API test suite: PASS, 29 tests.
- Mobile typecheck: PASS.
- Mobile RevenueCat/revenue UX contract suites: PASS, 13 tests.
- Worlds Admin typecheck: PASS.
- Live webhook delivery, signed-store purchases, refunds, retries, and provider
  reconciliation: PENDING API PUBLICATION / owner provider setup.

## Remaining owner actions

1. Publish a healthy public API before configuring and testing the RevenueCat
   webhook. This is intentionally deferred in free mode.
2. Create and configure the real Apple and Google store products and supply the
   public RevenueCat platform keys.
3. Connect Stripe before enabling eligible web collectible checkout, Connect
   seller onboarding, payouts, disputes, or settlement reconciliation.
4. Run signed-device and live-provider validation only after the relevant
   provider and API prerequisites are complete.

## Explicit exclusions

- No deployment, republish, or deployment-credit action.
- No Mapbox work.
- No changes to migrations 001–075.
- No claim that live provider delivery or signed-store validation passed.