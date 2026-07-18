# Folder Structure

```
artifacts/mobile/
│
├── app/                         # Expo Router file-based routes
│   ├── _layout.tsx              # Root layout (providers: QueryClient, Auth, SafeArea)
│   ├── +not-found.tsx           # 404 fallback
│   ├── loading.tsx              # Boot/splash loading screen
│   ├── (auth)/                  # Unauthenticated flow
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   └── (tabs)/                  # Main authenticated app shell
│       ├── _layout.tsx          # Tab bar definition
│       ├── index.tsx            # Game Selector (home)
│       ├── notifications.tsx
│       ├── profile.tsx
│       └── settings.tsx
│
├── components/                  # Shared UI components
│   ├── ui/                      # Primitive design system components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Badge.tsx
│   ├── loading/
│   │   ├── LoadingScreen.tsx
│   │   └── Skeleton.tsx
│   ├── ErrorBoundary.tsx        # React error boundary (pre-installed)
│   ├── ErrorFallback.tsx
│   └── KeyboardAwareScrollViewCompat.tsx
│
├── features/                    # Feature-scoped logic and screens
│   ├── auth/
│   │   ├── AuthProvider.tsx     # React context for auth state
│   │   └── hooks/
│   │       └── useAuth.ts
│   ├── quest/                   # (Build 2) Quest game mode
│   └── hunt/                    # (Build 3) Hunt game mode
│
├── services/                    # External data access (Supabase, API)
│   ├── supabase.ts              # Supabase client singleton
│   ├── auth.service.ts          # Supabase Auth wrapper
│   ├── database.service.ts      # Supabase table queries
│   └── storage.service.ts      # Supabase Storage uploads
│
├── lib/                         # App-level singletons
│   ├── queryClient.ts           # TanStack Query client config
│   └── store.ts                 # Zustand global store
│
├── hooks/                       # Shared React hooks
│   └── useColors.ts             # Returns current theme palette
│
├── types/                       # TypeScript type definitions
│   ├── auth.types.ts            # UserRole, AuthUser, AuthState
│   ├── user.types.ts            # UserProfile, UserStats
│   └── game.types.ts            # GameMode, GameSession, GeoLocation
│
├── constants/                   # Design tokens (no magic numbers)
│   ├── colors.ts                # Full color palette (dark + light)
│   ├── spacing.ts               # 4px-unit spacing scale + radius
│   ├── typography.ts            # Font families, sizes, presets
│   └── theme.ts                 # Shadows, z-index, animation tokens
│
├── supabase/
│   └── types.ts                 # Generated (or placeholder) DB types
│
├── assets/
│   └── images/
│       └── icon.png             # App icon
│
├── docs/                        # AI-readable project documentation
│   ├── architecture.md
│   ├── folder-structure.md      ← you are here
│   ├── coding-standards.md
│   ├── state-management.md
│   ├── networking-strategy.md
│   ├── future-build-plan.md
│   ├── database-strategy.md
│   ├── map-strategy.md
│   └── ai-strategy.md
│
├── .env.example                 # Environment variable documentation
├── .prettierrc                  # Code formatting config
├── eslint.config.js             # Linting rules
├── tailwind.config.js           # NativeWind config (see setup notes)
├── babel.config.js              # Expo babel preset
├── metro.config.js              # Metro bundler config
├── app.json                     # Expo project config (NEVER use app.config.ts)
├── tsconfig.json                # TypeScript config (strict mode)
└── package.json
```

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | PascalCase for components | `GameModeCard.tsx` |
| Files | camelCase for hooks/services | `useAuth.ts`, `auth.service.ts` |
| Types | PascalCase | `UserProfile`, `GameMode` |
| Constants | camelCase (objects) or SCREAMING_SNAKE (primitives) | `spacing.4`, `GAME_MODES` |
| Folders | kebab-case | `features/game-selector/` |
| Route files | Expo Router convention (kebab-case) | `sign-in.tsx` |
