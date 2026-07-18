# Worlds

A scalable mobile game platform for exploration, learning, and real-world adventure. Initial game modes: **Quest** (story-driven location puzzles) and **Hunt** (competitive scavenger hunts). Architecture supports unlimited future game modes without structural changes.

> **All development must follow `artifacts/mobile/docs/PROJECT_CONSTITUTION.md`.** When in doubt, consult the Constitution before making any architectural, UX, or coding decision.

---

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — Expo dev server (mobile preview + QR code)
- `pnpm --filter @workspace/api-server run dev` — Express API server
- `pnpm run typecheck` — full TypeScript check across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec

---

## Stack

- **Mobile:** React Native 0.81, Expo SDK 54, Expo Router (file-based)
- **Language:** TypeScript 5.9 — strict mode, no `any`
- **Auth + DB:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Server State:** TanStack Query v5 — all API/DB data here
- **Client State:** Zustand — global UI state only (toasts, unread count, app readiness)
- **Forms:** React Hook Form + Zod validation
- **API Server:** Express 5 (AI proxy, server-side business logic)
- **Animation:** React Native Reanimated 4 + Gesture Handler
- **Icons:** @expo/vector-icons Feather (+ SF Symbols on iOS via expo-symbols)

---

## Architecture

Feature-based. Code is organized by domain, not by type:

```
artifacts/mobile/
├── app/           → Expo Router routes
├── features/      → Feature domains (auth, quest, hunt, ...)
├── components/    → Shared UI primitives (Button, Card, Input, Badge, Skeleton)
├── services/      → Supabase service layer (auth, database, storage)
├── lib/           → Singletons (QueryClient, Zustand store)
├── types/         → Shared TypeScript types
├── constants/     → Design tokens (colors, spacing, typography, theme)
└── docs/          → Architecture documentation
```

**Key rules:**
- Components never call Supabase directly — use `services/`
- Server data lives in React Query — not in Zustand
- All colors via `useColors()` — no hardcoded hex values
- All spacing/typography from `constants/` — no magic numbers
- `app.json` only — never `app.config.ts` (breaks Expo Launch)

---

## Navigation

```
Root Stack
├── Game Selector (home)      → choose Quest or Hunt
├── Quest Navigator           → Home | Quests | Map | Progress | Profile
└── Hunt Navigator            → Map | My Hunts | Progress | Profile
```

Quest and Hunt each have their own isolated tab navigator. The Hunt map is the primary/default screen in Hunt mode.

---

## Coding Standards (summary — see Constitution for full detail)

- **TypeScript strict** — no `any`, no implicit types
- **Services return `{ data, error }` tuples** — never throw to UI
- **Hooks have one responsibility** — one hook, one concern
- **No `console.log`** — `console.warn`/`console.error` only
- **Imports via `@/`** — never relative paths like `../../`
- **Forms: React Hook Form + Zod** — consistent across all screens
- **Errors: user-friendly strings only** — never raw server error messages
- **Lists: FlatList always** — with empty state, loading skeleton, pull-to-refresh

---

## Design Philosophy

Minimal · Modern · Fast · Clean · Intuitive · Low-friction · Visually consistent

Dark theme default. No magic numbers. No emoji icons. No copy-pasted markup.

---

## Implementation Order

See `artifacts/mobile/docs/PROJECT_CONSTITUTION.md` Section 15 for the full 15-build roadmap. Next steps:

1. **Build 2** — Connect Supabase credentials + run migrations
2. **Build 3** — Authentication UI (sign in, sign up, session guards)
3. **Build 4** — Quest core gameplay
4. **Build 5** — Mapbox integration
5. **Build 6** — Hunt core gameplay

---

## Critical Constraints

- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` must be set for auth/DB to work
- AI provider keys are **server-side only** — never `EXPO_PUBLIC_*`
- Mapbox requires a **native build** — incompatible with Expo Go (implement in Build 5)
- NativeWind v4 needs `tailwindcss@~3` — workspace catalog has v4 (deferred until resolved)
- RLS must be enabled on **every** Supabase table — no exceptions

---

## Key Files

| File | Purpose |
|------|---------|
| `artifacts/mobile/docs/PROJECT_CONSTITUTION.md` | **Authoritative spec — read before any feature work** |
| `artifacts/mobile/docs/future-build-plan.md` | Phased build roadmap |
| `artifacts/mobile/constants/colors.ts` | Color palette (dark + light) |
| `artifacts/mobile/constants/spacing.ts` | Spacing scale |
| `artifacts/mobile/constants/typography.ts` | Font families and sizes |
| `artifacts/mobile/services/supabase.ts` | Supabase client (null-safe) |
| `artifacts/mobile/features/auth/AuthProvider.tsx` | Auth context |
| `artifacts/mobile/lib/store.ts` | Zustand global store |
| `artifacts/mobile/lib/queryClient.ts` | React Query config |
| `lib/api-spec/openapi.yaml` | API contract (source of truth) |
