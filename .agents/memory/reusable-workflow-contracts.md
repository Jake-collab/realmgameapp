---
name: Reusable workflow contracts
description: Static failure-reporting checks must follow local reusable workflow calls and validate permission handoff
---

Reusable workflows that report failures need the required permission in both the callee’s reporting job and every caller job that invokes it; caller permissions can only be passed down, not elevated.

**Why:** A direct-job-only scan can miss an issue or summary reporter moved into a reusable workflow, and GitHub will not let the callee restore permissions the caller withheld.

**How to apply:** When adding or moving CI failure reporting, keep local reusable workflow discovery recursive and validate each call site independently without querying GitHub.