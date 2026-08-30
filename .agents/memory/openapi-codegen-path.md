---
name: OpenAPI codegen path
description: Orval can clean generated clients before failing to resolve the API spec in this workspace.
---

Orval 8.21's Scalar loader requires a relative filesystem target resolved from
the current working directory; absolute targets fail before parsing. Keep
generated outputs protected from preflight failures with `clean: false`.

**Why:** A contract change can accidentally remove tracked client and Zod
outputs even though the source spec is valid. Workspace-root and package-local
pnpm invocations also use different working directories.

**How to apply:** Derive the input target with
`path.relative(process.cwd(), path.resolve(__dirname, "openapi.yaml"))`.
Pin `override.zod.version` to the workspace's installed Zod major. If Zod
schema files are generated separately, disable Orval package index generation
and export only the runtime schema barrel to avoid duplicate inline body names.