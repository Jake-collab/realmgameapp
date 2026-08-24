---
name: OpenAPI codegen path
description: The api-spec Orval config uses a relative input path that fails when invoked from the workspace root.
---

The OpenAPI generator currently cleans generated outputs before failing to resolve its relative input target when run through the workspace filter.

**Why:** A contract change can accidentally remove tracked client and Zod outputs even though the source spec is valid.

**How to apply:** Restore generated outputs after a failed run and invoke Orval with a working-directory or absolute input target before relying on generated types.