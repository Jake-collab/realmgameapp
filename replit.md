# GamePlatform Mobile

A production-quality mobile game platform supporting multiple adventure game modes (Quest, Hunt, and future modes). Players discover and play location-based games through a central Game Selector.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — start the Expo dev server (mobile preview)
- `pnpm --filter @workspace/api-server run dev` — start the Express API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- **Mobile:** React Native 0.81, Expo SDK 54, Expo Router (file-based routing)
- **Language:** TypeScript 5.9 (strict mode)
- **Auth + DB:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Server State:** TanStack Query v5
- **Client State:** Zustand
- **Forms:** React Hook Form + Zod
- **API Server:** Express 5 + Drizzle ORM (for non-Supabase server logic)
- **Animation:** React Native Reanimated 4
- **Icons:** @expo/vector-icons (Feather set)

## Where Things Live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/` — Expo Router routes
- `artifacts/mobile/features/` — Feature-scoped logic (auth, game modes)
- `artifacts/mobile/components/ui/` — Design system primitives
- `artifacts/mobile/services/` — Supabase service layer
- `artifacts/mobile/lib/` — Singletons (QueryClient, Zustand store)
- `artifacts/mobile/types/` — TypeScript type definitions
- `artifacts/mobile/constants/` — Design tokens (colors, spacing, typography)
- `artifacts/mobile/docs/` — Architecture and strategy documentation
- `artifacts/api-server/` — Express API server
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API)

## Architecture Decisions

- **Supabase over custom DB for auth data** — RLS handles access control automatically; user profiles are owned by Supabase auth.users.
- **Feature-based folder structure** — features/ contains all domain logic for each game mode; avoids the "components soup" anti-pattern.
- **Service layer pattern** — no component touches Supabase directly; all access via services/.
- **Dark theme as default** — `userInterfaceStyle: "dark"` in app.json; light theme tokens are defined but secondary.
- **NativeWind deferred** — NativeWind v4 needs tailwindcss@~3 but the workspace catalog pins v4; components use StyleSheet + design tokens (equivalent).

## User Preferences

- Production quality — no placeholder buttons, polished states throughout.
- Feature-based architecture, not type-based.
- No magic numbers — always use design tokens.
- AI API keys must stay server-side only (proxied through Express API server).

## Gotchas

- **Never use `app.config.ts`** — Expo Launch breaks with dynamic config. Edit `app.json` only.
- **NativeWind needs tailwindcss@~3** — workspace catalog has v4. Run `pnpm --filter @workspace/mobile add tailwindcss@~3 --save-dev` before activating NativeWind.
- **Mapbox requires a native build** — cannot run in Expo Go. Save for Build 5.
- **AI keys are server-only** — never use `EXPO_PUBLIC_` prefix for AI provider keys.
- **RLS must be enabled on every Supabase table** — never leave a table without policies.

## Pointers

- See `artifacts/mobile/docs/architecture.md` for full architecture overview
- See `artifacts/mobile/docs/future-build-plan.md` for the phased build roadmap
- See `artifacts/mobile/docs/database-strategy.md` for Supabase schema design
- See `artifacts/mobile/docs/ai-strategy.md` for AI integration approach
- See the `pnpm-workspace` skill for monorepo structure
