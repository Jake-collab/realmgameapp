# Project Architecture

## Overview

This is a production-quality mobile game platform built with React Native + Expo. It supports multiple "game modes" (Quest, Hunt, and future modes) that users discover through a central Game Selector.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | React Native 0.81 + Expo SDK 54 | Cross-platform mobile |
| Router | Expo Router (file-based) | Navigation |
| Language | TypeScript (strict) | Type safety |
| Auth + DB | Supabase | Auth, PostgreSQL, Storage, RLS |
| Server State | TanStack Query v5 | Data fetching + caching |
| Client State | Zustand | Global UI state |
| Forms | React Hook Form + Zod | Validation |
| Styling | React Native StyleSheet + design tokens | UI consistency |
| Animation | React Native Reanimated 4 | Gestures + animations |
| Gestures | React Native Gesture Handler | Touch interactions |

## Architecture Principles

### 1. Feature-Based Organization
Code is organized by feature (auth, game modes, profile) rather than by type (screens, components, hooks). Each feature is self-contained.

### 2. Service Layer
All external data access (Supabase, API) goes through typed service classes in `/services`. Components never call Supabase directly.

### 3. Contract-First API
When the Express API server is used, the OpenAPI spec in `lib/api-spec/openapi.yaml` is the source of truth. Generated hooks from `@workspace/api-client-react` are used for all API calls.

### 4. React Query for Server State
All server-side data lives in React Query's cache. Components read from cache; mutations invalidate relevant queries.

### 5. Zustand for Client State
Only truly global, non-server UI state lives in Zustand (unread count, toast queue, app readiness).

## Data Flow

```
User Action
  → Component
    → React Hook Form (form validation)
    → Feature Hook / useAuth / useQuery
      → Service Layer (supabase.ts / auth.service.ts)
        → Supabase (Auth / DB / Storage)
```

## User Role Hierarchy

```
anonymous → registered → moderator → creator → administrator
```

Each role inherits all permissions of the roles below it. Role checks use the `hasRole()` helper from `types/auth.types.ts`.

## Navigation Structure

```
Root Stack (_layout.tsx)
├── (tabs)/_layout.tsx          ← Main app tabs
│   ├── index.tsx               ← Game Selector
│   ├── notifications.tsx       ← Alerts
│   ├── profile.tsx             ← User profile
│   └── settings.tsx            ← App settings
├── (auth)/_layout.tsx          ← Auth stack
│   ├── sign-in.tsx
│   └── sign-up.tsx
└── loading.tsx                 ← Boot screen
```

Game modes navigate into their own stacks from the Game Selector:

```
(tabs)/index.tsx (Game Selector)
  → quest/_layout.tsx           ← Quest stack (Build 2)
  → hunt/_layout.tsx            ← Hunt stack  (Build 3)
```

## Build Plan

See `docs/future-build-plan.md` for the full phased roadmap.
