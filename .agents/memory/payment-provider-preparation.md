---
name: Payment provider preparation boundary
description: Keep local payment contracts, store mappings, and reconciliation separate from live provider availability.
---

Local payment preparation must never be presented as live provider readiness:
canonical catalog values and provider-neutral ports can be tested without
credentials, but Apple/Google product IDs, Stripe Connect operations, signed
device purchases, webhook delivery, and settlement reconciliation require
explicit owner setup and a healthy public API.

**Why:** free-mode work must not consume deployment credits or fabricate store
identifiers, while the server remains the only authority for entitlements,
ownership, refunds, disputes, and payouts.

**How to apply:** preserve explicit owner-configured placeholders, keep
provider adapters behind typed ports, show provider/event identifiers only to
authorized staff, and label ingestion visibility separately from matched
reconciliation or executed provider refunds.