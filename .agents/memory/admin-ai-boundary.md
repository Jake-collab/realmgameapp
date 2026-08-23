---
name: Admin AI boundary
description: Worlds Admin AI generation is server-only and must fail closed without staff authorization and provider configuration.
---

Admin AI credentials and provider calls belong exclusively to the API server. The browser may edit prompt text and request previews, but it must never receive provider secrets, protected user data, exact validation geometry, hidden reasoning, or an autonomous publish path.

**Why:** The workspace commonly runs without Supabase or an AI provider configured; pretending generation succeeded would create unsafe, non-persistent admin content and undermine the existing draft/review workflow.

**How to apply:** Keep AI routes behind server-resolved staff permissions, report missing services explicitly, validate structured Quest output before draft creation, and require human review before publication.