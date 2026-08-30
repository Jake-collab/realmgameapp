---
name: Revenue entitlement boundary
description: Durable rules for membership allowances, Drop commerce, collectible ownership, and provider-neutral marketplace accounting.
---

Membership periods and allowance consumption are resolved on the server in UTC. Included weekly Drop creation is always consumed before append-only Extra Drop Credits, and plan downgrades never reduce a period ceiling already in progress.

**Why:** Client clocks and provider state are not trusted, and lowering an active period after usage can invalidate legitimate history. Idempotent ledgers and row/advisory locks prevent retries and concurrency from double-consuming value.

**How to apply:** Route Quest participation and Hunt draft creation through the allowance boundary. Keep canonical Hunt Drop collection and Quest/Hunt verification and points unchanged.

Find Badges record verified discovery permanently; collectible ownership is a separate acquisition state that may be free, purchased, sold out, deactivated, refunded, or reversed.

**Why:** A valid find must survive a later commerce decision or reversal, while ownership and money require independent audit history.

**How to apply:** Award badges only from the canonical verified collection path. Never infer ownership from a badge, and never erase immutable find, transaction, seller-ledger, membership-event, or audit records.

Marketplace operations remain provider-neutral and trusted-server-only. Every provider event and transaction is unique, seller eligibility is rechecked at purchase time, and gross, fees, tax, seller payable, refunds, and reversals stay separately auditable.

**Why:** Provider retries, partial refunds, seller restrictions, and concurrent final-supply races must not create duplicate ownership or negative/overstated seller balances.

**How to apply:** Claim provider events before mutation, lock the order/listing, snapshot effective configuration into the order, and express corrections as new events rather than updates.