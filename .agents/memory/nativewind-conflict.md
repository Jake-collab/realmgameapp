---
name: NativeWind v4 tailwind conflict
description: NativeWind v4 requires tailwindcss@~3 but workspace catalog pins tailwindcss 4.3.2 — cannot activate without override.
---

**Rule:** Do not activate NativeWind babel/metro plugins without first pinning tailwindcss to v3 in the mobile package.

**Why:** The pnpm workspace catalog (`pnpm-workspace.yaml`) declares `tailwindcss: 4.3.2`. NativeWind v4 peer-requires `tailwindcss@~3`. Installing `nativewind` resolves the catalog version and fails the peer check.

**How to apply:**
1. Run `pnpm --filter @workspace/mobile add tailwindcss@~3 --save-dev` (overrides catalog for this package)
2. Then add `'nativewind/babel'` to babel.config.js presets
3. Wrap metro config with `withNativeWind`
4. Create `global.css` and import in `app/_layout.tsx`

Until then, components use `StyleSheet.create()` + design tokens (fully equivalent in output).
