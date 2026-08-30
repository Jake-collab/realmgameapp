---
name: OpenAPI codegen path
description: Orval can clean generated clients before failing to resolve the API spec in this workspace.
---

The OpenAPI generator currently cleans generated outputs before failing to resolve its input target, including absolute targets, file URLs, and direct CLI input against the unchanged baseline spec.

**Why:** A contract change can accidentally remove tracked client and Zod outputs even though the source spec is valid; the failure appears to be in the installed Orval runtime rather than the spec path.

**How to apply:** Do not run the existing Orval command until its runtime issue is fixed. The failure reproduces in Orval 8.20 and 8.21. Preserve generated outputs and validate consuming API/Admin packages directly.