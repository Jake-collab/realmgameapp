# Stage 3 external-connection checklist

Audit basis: current repository, current non-secret configuration references,
the connected-provider state visible to this workspace, and the documented
public API state. No secret values are printed or requested.

Stage 1 and Stage 2 are not being re-run or changed. No deployment, publishing,
Mapbox work, paid Replit integration, or migration change is part of this
checklist.

## 1. RevenueCat

**STATUS: PARTIALLY CONNECTED**

### ALREADY IMPLEMENTED

- The RevenueCat Replit connection is installed and healthy.
- The server-only `REVENUECAT_WEBHOOK_AUTHORIZATION` secret exists.
- RevenueCat project and public SDK-key configuration references are present
  without exposing their values.
- Native mobile RevenueCat identity lifecycle, offerings, purchases, restores,
  account switching, logout, and collectible order attributes are implemented.
- Server-side webhook authorization uses a constant-time comparison.
- Webhook payload validation, transaction identity checks, retryable responses,
  permanent-event responses, and idempotent trusted Supabase processing exist.
- Migrations 074 and 075 are present and preserved.
- The Test Store catalog and current offering are documented as configured.

### OWNER ACTIONS REMAINING

1. Make the API available at the documented HTTPS endpoint.
2. In RevenueCat, configure the webhook endpoint:
   `https://worlds-game-app.replit.app/api/webhooks/revenuecat`.
3. Configure the exact server-only Authorization header using the existing
   secret value; do not put it in mobile configuration.
4. Confirm the iOS and Android apps, offerings, entitlements, and product
   mappings in RevenueCat.
5. Run provider sandbox and signed-device validation after the API is public.

### IDS / CONFIGURATION REMAINING

- RevenueCat iOS public SDK key: configured through environment configuration;
  value intentionally not printed.
- RevenueCat Android public SDK key: configured through environment
  configuration; value intentionally not printed.
- RevenueCat Test Store public SDK key: configured through environment
  configuration; value intentionally not printed.
- RevenueCat project identifier: configured; value intentionally not printed.
- Webhook URL: documented above, not currently serving the API.
- Webhook Authorization header: server-only secret exists; provider-side
  header configuration remains.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Any provider-specific production product mapping requiring real App Store or
  Play identifiers.
- Live webhook environment verification and production provider-event rollout.
- Provider-reported refund, expiration, billing-issue, and revocation behavior
  against real store products.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- RevenueCat webhook delivery, retry, and wrong-environment rejection.
- iOS and Android purchase, restore, account-switch, expiration, billing issue,
  refund, and cancellation flows.
- Paid Collectible provider-event reconciliation on a signed device.

### DEPENDS ON PUBLIC API

**YES** — live webhook delivery and trusted entitlement/ownership processing.

### DEPENDS ON SIGNED MOBILE BUILD

**YES** — native purchase and restore validation.

### DEPENDS ON REPLIT PAID FEATURE

**ONLY IF USING REPLIT PUBLISHING/DEPLOYMENT** — RevenueCat itself is already
connected; live delivery still needs a reachable public API.

## 2. Public Worlds API/backend deployment

**STATUS: NOT CONNECTED / NOT PUBLICLY SERVING**

### ALREADY IMPLEMENTED

- The local API workflow builds and starts successfully.
- `/api/healthz`, `/api/readiness`, and `/api/webhooks/revenuecat` are
  implemented in the repository.
- The API server and trusted worker are designed to run with server-only
  Supabase configuration.
- Readiness checks include RevenueCat webhook secret requirements.
- Deployment documentation specifies separate API, Admin, and worker concerns.

### OWNER ACTIONS REMAINING

1. Publish an always-on HTTPS API and worker service.
2. Provide production Supabase server configuration and the existing
   server-only RevenueCat secret through the deployment provider's secret
   environment.
3. Configure the production domain and exact CORS origins.
4. Verify `/api/healthz` and `/api/readiness` from the public URL.
5. Keep the worker and API supervised and confirm scheduler heartbeat signals.

The current public URL serves the platform's “app isn't live yet” placeholder;
the API routes are therefore not publicly reachable.

### IDS / CONFIGURATION REMAINING

- A healthy public API URL serving the current API build.
- Production Supabase URL and service-role configuration in the server
  environment; values must remain secret.
- Production CORS origins.
- Production worker scheduling configuration.
- Public webhook URL and TLS certificate/domain.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- No core API route code is blocked by deployment, but live endpoint
  verification and provider webhook registration are blocked.
- Production environment-specific checks can only be finalized after the
  service exists.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Public health and readiness checks.
- RevenueCat webhook delivery and retries.
- Production worker heartbeat and scheduled maintenance behavior.
- End-to-end server-authoritative purchase/refund/reversal processing.

### DEPENDS ON PUBLIC API

**YES**

### DEPENDS ON SIGNED MOBILE BUILD

**NO** for API health and webhook delivery; **YES** for end-to-end mobile
purchase validation.

### DEPENDS ON REPLIT PAID FEATURE

**YES IF USING REPLIT PUBLISHING/DEPLOYMENT.** An externally hosted HTTPS API
could avoid Replit publishing, but that would be a separate infrastructure
decision and is not configured here.

## 3. Apple App Store Connect

**STATUS: NOT CONNECTED**

### ALREADY IMPLEMENTED

- Expo iOS bundle identifier: `com.worlds.mobile`.
- RevenueCat iOS SDK integration and platform key selection exist.
- Provider-neutral membership, credit, collectible, ownership, refund, and
  entitlement boundaries exist.
- Apple product mapping placeholders are explicit and currently unset rather
  than fabricated.

### OWNER ACTIONS REMAINING

1. Enroll the Apple Developer/App Store account and accept current agreements.
2. Create or confirm the `com.worlds.mobile` App Store app.
3. Configure banking, tax, and App Store commerce agreements.
4. Create the five products below.
5. Add the real product identifiers to RevenueCat's iOS app and offering.
6. Create a signed TestFlight build and add internal testers.
7. Submit required App Review metadata and review notes for digital goods.

### IDS / CONFIGURATION REMAINING

- Auto-renewable subscription product ID for Worlds Membership monthly:
  owner-defined; target price **$4.99/month**.
- Auto-renewable subscription product ID for Worlds Membership yearly:
  owner-defined; target price **$44.99/year**.
- Consumable product ID for `drop_credits_5`: owner-defined; **$1.99 → 5
  Drop Credits**.
- Consumable product ID for `drop_credits_15`: owner-defined; **$4.99 → 15
  Drop Credits**.
- Consumable product ID for `drop_credits_35`: owner-defined; **$9.99 → 35
  Drop Credits**.
- iOS App Store app record, subscription group, localizations, tax category,
  and storefront availability.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Replacing the explicit Apple `null` mapping placeholders with real product
  identifiers.
- Final RevenueCat iOS offering/product mapping.
- Any product-specific review configuration that depends on the real IDs.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Signed TestFlight monthly and yearly subscription purchases, renewal,
  expiration, billing issue, cancellation, and restore.
- Signed consumable purchases for all three Drop Credit packs.
- Refund/revocation and account-switch isolation.
- Apple-to-RevenueCat-to-Worlds webhook/entitlement confirmation.

### DEPENDS ON PUBLIC API

**YES** for trusted entitlement processing and live webhook delivery.

### DEPENDS ON SIGNED MOBILE BUILD

**YES**

### DEPENDS ON REPLIT PAID FEATURE

**NO** for App Store Connect itself; **ONLY IF USING REPLIT PUBLISHING** for
the API dependency.

## 4. Google Play Console

**STATUS: NOT CONNECTED**

### ALREADY IMPLEMENTED

- Expo Android package identifier: `com.worlds.mobile`.
- RevenueCat Android SDK integration and platform key selection exist.
- Provider-neutral purchase, entitlement, credit, collectible, refund, and
  ownership boundaries exist.
- Google Play mapping placeholders are explicit and currently unset.

### OWNER ACTIONS REMAINING

1. Create or confirm the `com.worlds.mobile` Play Console app.
2. Accept Play Console developer, payments, tax, and merchant agreements.
3. Configure a subscription product with monthly and yearly base plans.
4. Create the three one-time Drop Credit products below.
5. Configure regional prices, tax settings, and internal testers.
6. Add the real identifiers to RevenueCat's Android app and offering.
7. Create a signed internal-test build and configure purchase
   acknowledgement/consumption testing.

### IDS / CONFIGURATION REMAINING

- Subscription product/base-plan mapping for Worlds Membership monthly:
  owner-defined; target price **$4.99/month**.
- Subscription product/base-plan mapping for Worlds Membership yearly:
  owner-defined; target price **$44.99/year**.
- One-time product ID for `drop_credits_5`: owner-defined; **$1.99 → 5 Drop
  Credits**.
- One-time product ID for `drop_credits_15`: owner-defined; **$4.99 → 15
  Drop Credits**.
- One-time product ID for `drop_credits_35`: owner-defined; **$9.99 → 35
  Drop Credits**.
- Package record, base-plan identifiers, regional availability, and tester
  accounts.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Replacing the explicit Google Play `null` mapping placeholders with real
  product and base-plan identifiers.
- Final RevenueCat Android offering/product mapping.
- Any product-specific acknowledgement/consumption configuration.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Signed internal-test subscription purchase, renewal, expiration, billing
  issue, cancellation, and restore.
- Signed one-time purchases for all three Drop Credit packs.
- Acknowledgement/consumption, refund/revocation, and account-switch
  isolation.
- Google Play-to-RevenueCat-to-Worlds webhook/entitlement confirmation.

### DEPENDS ON PUBLIC API

**YES** for trusted entitlement processing and live webhook delivery.

### DEPENDS ON SIGNED MOBILE BUILD

**YES**

### DEPENDS ON REPLIT PAID FEATURE

**NO** for Play Console itself; **ONLY IF USING REPLIT PUBLISHING** for the API
dependency.

## 5. Stripe

**STATUS: NOT CONNECTED**

### ALREADY IMPLEMENTED

- Provider-neutral payment intent, payment, refund, dispute, seller, payout,
  webhook normalization, and reconciliation contracts exist under
  `artifacts/api-server/src/payments/`.
- Server-controlled routing fails closed unless provider availability and real
  product mappings are present.
- Canonical catalog values and the 30% Worlds platform-fee boundary remain
  owned by the existing Stage 2 model; no fee or creator-share values were
  changed.
- Admin can inspect provider names, transaction IDs, event IDs, and bounded
  external-event ingestion history.
- No Stripe SDK, Stripe secret, Stripe webhook secret, Stripe product ID, or
  Stripe connection was added.

### OWNER ACTIONS REMAINING

1. Create/activate the Stripe platform account and complete business,
   identity, tax, and payout setup.
2. Decide which web Collectible price tiers are eligible. Arbitrary
   creator-defined native IAP prices must not be assumed to exist.
3. Create real Stripe Products/Prices for supported web tiers. The production
   checkout path must use real provider Price IDs, not client-provided
   amounts or synthetic `price_data`.
4. Configure Stripe webhook signing and an HTTPS webhook endpoint.
5. Choose either the Replit Stripe connector or a manual server-only
   credential path.

### IDS / CONFIGURATION REMAINING

- Stripe account/platform identifier.
- Real Stripe Product and Price IDs for supported web products.
- Server-only Stripe API credential.
- Server-only Stripe webhook signing secret.
- Webhook endpoint and event subscription list.
- Environment separation between test and live Stripe accounts/modes.

### MANUAL CREDENTIAL PATH WITHOUT REPLIT'S ONE-CLICK CONNECTOR

**Yes, this is architecturally possible, but it is not implemented or
connected today.** The secure manual path would require:

- storing the Stripe secret and webhook signing secret only through the
  workspace's server environment/secrets mechanism;
- adding the official Stripe SDK and a server-only client;
- adding authenticated server Checkout/session routes;
- adding a raw-body signature-verified webhook route;
- mapping real Stripe Price IDs to the existing provider-neutral catalog;
- keeping all ownership, seller payable, refund, dispute, and reconciliation
  decisions server-authoritative.

No secret values should be pasted into chat or committed to the repository.
This manual path would avoid Replit's built-in Stripe connector, but it still
requires an externally reachable HTTPS API and Stripe dashboard setup.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Real Stripe client and credential adapter.
- Stripe Checkout session creation from authenticated server routes.
- Stripe webhook signature verification and event normalization.
- Real Price-ID mapping and supported web Collectible checkout.
- Provider-backed refund/dispute requests and confirmation handling.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Checkout success, cancellation, duplicate submission, and abandoned
  session behavior.
- Server confirmation before ownership finalization.
- Refund, partial refund, dispute, chargeback, and reversal behavior.
- Wrong-signature, duplicate-event, retry, and wrong-environment webhook
  behavior.
- Reconciliation of Stripe transactions against local marketplace orders.

### DEPENDS ON PUBLIC API

**YES**

### DEPENDS ON SIGNED MOBILE BUILD

**NO** for eligible web checkout; native mobile digital goods remain on
RevenueCat and do require signed builds.

### DEPENDS ON REPLIT PAID FEATURE

**NO** if using securely managed manual Stripe credentials; **ONLY IF USING
REPLIT'S BUILT-IN STRIPE CONNECTOR**.

## 6. Stripe Connect

**STATUS: NOT CONNECTED**

Stripe Connect is a separate marketplace capability layered on top of the
Stripe platform account.

### ALREADY IMPLEMENTED

- Canonical seller states, seller ledger, seller payable accounting, refunds,
  reversals, and admin authorization boundaries exist in Stage 2.
- Provider-neutral seller-account and payout ports exist.
- Seller status mapping distinguishes onboarding-required, pending, active,
  restricted, disabled, and not-onboarded states.
- The application does not collect or persist seller KYC documents or bank
  details.

### OWNER ACTIONS REMAINING

1. Activate Connect in the Stripe platform account.
2. Complete Connect platform profile, branding, terms, and required business
   disclosures.
3. Select the Stripe-hosted/embedded onboarding model and connected-account
   type with legal/accounting review.
4. Configure capabilities, payout schedule, supported countries, and
   platform fee/transfer policy.
5. Configure Connect webhook events for account requirements, capabilities,
   payouts, transfers, refunds, disputes, and chargebacks.
6. Run onboarding with a test seller and verify that Stripe owns KYC and bank
   collection.

### IDS / CONFIGURATION REMAINING

- Stripe Connect activation and platform settings.
- Connected account IDs created by trusted seller onboarding.
- Onboarding-link configuration and return/refresh URLs.
- Payout and transfer event identifiers.
- Connect webhook signing configuration.
- Country, currency, capability, payout, refund, and dispute policy.

### CODE THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Provider-backed seller onboarding link creation.
- Connected-account status/capability retrieval.
- Provider-backed payout creation and retrieval.
- Transfer/payout/refund/dispute webhook adapters.
- Reconciliation of seller payable balances against provider transfers and
  payouts.

### LIVE TESTING THAT CAN ONLY BE COMPLETED AFTER CONNECTION

- Seller onboarding completion and requirement changes.
- Restricted/inactive seller gating.
- Eligible sale, platform fee, seller payable, transfer, and payout flow.
- Failed, reversed, delayed, and excluded payouts.
- Seller refund, dispute, chargeback, and balance-reversal behavior.
- Provider/local-ledger reconciliation and Admin mismatch visibility.

### DEPENDS ON PUBLIC API

**YES**

### DEPENDS ON SIGNED MOBILE BUILD

**NO** for web marketplace seller operations.

### DEPENDS ON REPLIT PAID FEATURE

**NO** if using securely managed manual Stripe credentials; **ONLY IF USING
REPLIT'S BUILT-IN STRIPE CONNECTOR**.

## Other Stage 3 requirements

These are outside the six provider systems but still required before Stage 3
can be declared live:

- A healthy public API and trusted worker with production Supabase
  configuration.
- Production Auth redirect/CORS/domain configuration.
- App Store and Play Store agreements, tax/banking setup, product review,
  signed build distribution, and privacy/review disclosures.
- RevenueCat offering/product synchronization after real Apple/Google product
  creation.
- Storefront, tax, merchant-of-record, refund, and dispute policy decisions.
- Signed iOS and Android device validation.
- Web checkout, seller onboarding, payout, refund/dispute, and reconciliation
  sandbox validation.
- Final release monitoring for webhook failures, worker heartbeat, payout
  drift, and reconciliation mismatches.

No new Stage 2 migration or database reset is required by this checklist.

## Final status

**STAGE 1:** COMPLETE

**STAGE 2:** COMPLETE — 70/70 connected checks verified

**STAGE 3 LOCAL IMPLEMENTATION:** COMPLETE

This includes provider-neutral routing, catalog contracts, seller/payout/
refund/dispute states, reconciliation matching, Admin visibility, RevenueCat
webhook handling, and local regression coverage.

**STAGE 3 EXTERNAL CONNECTIONS REMAINING:** 5 net-new external
connection/configuration tracks:

1. Public API/backend publication
2. Apple App Store Connect
3. Google Play Console
4. Stripe platform
5. Stripe Connect

RevenueCat is already connected, but its public webhook configuration and live
validation remain incomplete. Stripe Connect is dependent on the Stripe
platform track.

**STAGE 3 LIVE VALIDATION REMAINING:**

- Public API health/readiness and worker validation.
- RevenueCat webhook delivery, retries, and trusted event processing.
- Signed iOS purchases/restores/refunds/expiration/billing issues.
- Signed Android purchases/acknowledgement/restores/refunds/revocations.
- Eligible web Checkout success/cancellation/refund/dispute flows.
- Seller onboarding, capability changes, payouts, failures, reversals, and
  Connect reconciliation.
- End-to-end Admin mismatch and audit verification.

**NEXT SINGLE RECOMMENDED OWNER ACTION:**

When the current no-deployment/no-paid-integration constraint is lifted, make
the public Worlds API and trusted worker reachable at a stable HTTPS URL and
verify `/api/healthz` and `/api/readiness`. This is the first dependency for
RevenueCat live delivery and the remaining provider webhook tests. Do not
perform that action during the current constrained session.