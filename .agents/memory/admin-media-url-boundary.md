---
name: Admin media URL boundary
description: Authorized staff retrieve sensitive media by ID through a short-lived server-signed URL.
---

Admin moderation media access must accept a media asset ID, authorize the staff role first,
validate the stored bucket and path against the canonical set, and issue a short-lived URL
from the server. Do not accept a bucket or object path from the browser.

**Why:** Proofs, pending creator sweeps, and quarantined files remain in private buckets;
client-side service credentials or arbitrary Storage paths would bypass the intended boundary.

**How to apply:** Keep the endpoint behind moderation-read authorization, restrict it to
canonical bucket records that have not been deleted, and return the signed URL plus expiry
without a separate raw storage-path field.

For moderator cleanup actions, confirm the current canonical reference with an opaque
fingerprint and a trusted, row-locking RPC; never accept or persist browser-supplied bucket/path
values.

**Why:** Reference drift is exactly when stale or tampered storage metadata is most dangerous;
the worker must remain the only component that performs physical deletion.

**How to apply:** Keep evidence redacted, verify the fingerprint against the locked media row,
record the operator decision immutably, and let the service-role worker handle any requeued
cleanup.