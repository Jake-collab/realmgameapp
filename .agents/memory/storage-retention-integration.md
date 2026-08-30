---
name: Storage retention integration harness
description: Live local Supabase Storage cleanup tests must account for API and linked-project behavior.
---

The Supabase Storage batch-remove endpoint can return HTTP 200 with an empty
array when the requested object is already missing; treat that response as a
terminal idempotent miss, not as a deletion.

**Why:** The service API's missing-object behavior differs from a plain 404,
and linked workspaces can carry an ignored `.temp/storage-version` marker that
names a hosted Storage migration unavailable in the locally selected image.

**How to apply:** Test real object creation and deletion against the disposable
Storage service, temporarily isolate linked Storage-version metadata, and use
the disposable database superuser only for teardown when production service
roles intentionally cannot delete retention evidence.