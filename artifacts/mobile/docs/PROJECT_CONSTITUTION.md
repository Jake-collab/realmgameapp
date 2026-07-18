# PROJECT CONSTITUTION — Worlds

> **Authoritative specification for the Worlds mobile application.**
> All future development must follow this document unless explicitly instructed otherwise by the project owner. When in doubt, consult this document first.

---

## 1. Product Overview

**Application Name:** Worlds

**Purpose:**
Worlds is a scalable platform containing multiple game modes centered around exploration, learning, community interaction, creativity, and real-world activities. Players engage with the physical world through structured game experiences that are social, competitive, and rewarding.

**Initial Launch Game Modes:**
- **Quest** — story-driven, location-based puzzle experiences with daily, monthly, and geo-anchored formats
- **Hunt** — competitive scavenger hunts with official, community, and custom game variants

**Core Promise:** The architecture must support future game modes without major restructuring. Every design and engineering decision should be evaluated against this requirement.

---

## 2. Architecture Principles

### Modular Feature-Based Architecture
Code is organized by feature domain (`features/quest/`, `features/hunt/`), not by technical type. Each feature owns its screens, hooks, components, and local state. Features do not import from each other directly — shared logic lives in `components/`, `lib/`, `services/`, or `types/`.

### Reusable Components
Every UI element used in more than one screen must be extracted to `components/ui/`. No copy-pasted markup. If two screens look similar, they share a component.

### Separation of Concerns
| Layer | Responsibility | Location |
|-------|---------------|---------|
| UI | Rendering, layout, user input | `app/`, `features/*/screens/`, `components/` |
| Business Logic | Rules, transformations, orchestration | `features/*/hooks/`, `features/*/utils/` |
| Networking | API calls, Supabase queries | `services/` |
| Storage | AsyncStorage, Supabase Storage | `services/storage.service.ts` |
| Global State | UI state, auth state | `lib/store.ts`, `features/auth/` |

Components never call Supabase directly. Services never contain UI logic.

### Maintainability Over Shortcuts
- No magic numbers — all values come from design tokens (`constants/`)
- No hardcoded colors — always `useColors()`
- No `any` types — TypeScript strict mode is non-negotiable
- No duplicated logic — extract before duplicating

### Performance-First Development
- Lists use `FlatList` with `keyExtractor` and `getItemLayout` where possible
- Images use `expo-image` with caching
- React Query handles server state caching — no redundant fetches
- `React.memo`, `useCallback`, `useMemo` applied at component boundaries where profiling shows benefit
- Avoid unnecessary re-renders: Zustand selectors, stable references

### Mobile-First Experience
- Design for 375pt wide screens (iPhone SE) as the minimum
- Touch targets minimum 44×44pt
- Safe area insets via `useSafeAreaInsets()` — never hardcode pixel offsets
- Haptic feedback on all primary actions via `expo-haptics`
- Gestures feel native — use `react-native-gesture-handler` and `react-native-reanimated`

### Offline-Friendly Architecture
- React Query cache provides read access to previously-fetched data
- UI must degrade gracefully when offline — show cached state, not blank screens
- Write operations queue for retry on reconnect (future implementation)
- No feature should crash the app when the network is unavailable

### Accessibility
- All interactive elements have `accessibilityLabel` and `accessibilityHint`
- Color is never the sole means of conveying information
- Text scales with system font size where appropriate
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text

### Scalability
- Adding a new game mode requires only: a new `features/<mode>/` folder, a new entry in `types/game.types.ts`, and new tab routes — no changes to the core shell
- Database schema uses generic `game_sessions` table with a `mode` discriminator
- Navigation is parameterized, not hardcoded per mode

---

## 3. Navigation Standards

### Game Selector (Home Shell)
The root experience. Displays all available game modes as cards. Navigates into the selected mode's own tab navigator.

```
Root Stack
├── Game Selector (home)
├── Quest Tab Navigator  ← full standalone tab bar
└── Hunt Tab Navigator   ← full standalone tab bar
```

Each game mode has its own isolated tab navigator. Tabs are not shared between modes.

---

### Quest — Bottom Navigation

| Tab | Icon | Purpose |
|-----|------|---------|
| Home | house | Prioritized active quest + daily/monthly/geo summaries |
| Quests | compass | Browse daily, monthly, and geo quests |
| Map | map | Location view of nearby quest waypoints |
| Progress | bar-chart | Leaderboards, in-action, completed |
| Profile | user | Player profile, stats, achievements |

**No Geo tab.** Geo content is a section inside the Quests tab.
**No Discover page.**

---

### Hunt — Bottom Navigation

| Tab | Icon | Purpose |
|-----|------|---------|
| Map | map-pin | Primary screen — displays all hunt types |
| My Hunts | list | In Action / Ready / Completed / Invitations |
| Progress | bar-chart | Scores, streaks, history |
| Profile | user | Player profile, stats, achievements |

**The Hunt map is the primary screen** — it is the first tab and the default view.
**No Discover tab.**

---

## 4. UI Standards

> These standards govern all UI implementation. Follow them without exception.

### Spacing
- Use the `spacing` scale from `constants/spacing.ts` (4px base unit)
- Never hardcode pixel values for padding, margin, or gap
- Consistent inner padding for cards: `spacing[4]` (16px) or `spacing[5]` (20px)
- Screen-level horizontal padding: `spacing[5]` (20px)

### Typography
- All fonts come from `constants/typography.ts`
- Font family: Inter (400 Regular, 500 Medium, 600 SemiBold, 700 Bold)
- Display/hero: Bold, 28–34pt
- Section headings (h2): SemiBold, 22–24pt
- Body: Regular, 15pt
- Labels/captions: Medium or SemiBold, 11–13pt
- Never use font sizes outside the `fontSize` scale

### Buttons
- Use the `Button` component from `components/ui/Button.tsx`
- Variants: `primary`, `secondary`, `ghost`, `destructive`, `outline`
- Sizes: `sm`, `md`, `lg`
- Always provide haptic feedback on press
- Disabled state must be visually distinct (opacity 0.5)
- Loading state shows spinner, never raw text "Loading..."

### Cards
- Use the `Card` component from `components/ui/Card.tsx`
- Consistent border radius: `radius.md` (12px) or `radius.lg` (16px)
- Pressable cards use scale animation (0.98) on press
- Card backgrounds always use `colors.card`, never raw hex
- Elevation via `shadows.md` for elevated cards

### Bottom Sheets
- Use `react-native-bottom-sheet` (add in the build step that needs it)
- Snap points: `['40%', '70%', '95%']` as defaults; customize per use case
- Always include a drag handle
- Dismiss on backdrop tap
- Never use `Modal` as a substitute for bottom sheets on mobile

### Lists
- Use `FlatList` for all scrollable lists with more than ~10 items
- Always provide `keyExtractor`
- Always provide `ListEmptyComponent` with icon + descriptive text (no emojis)
- Always provide `ListHeaderComponent` for section titles
- Use `Skeleton` component during loading — never show an empty list
- Pull-to-refresh on all primary data lists

### Search Bars
- Animated focus state (border color transition)
- Debounce input: 300ms before triggering search
- Show clear button when input is non-empty
- Results update inline — no separate search results screen

### Loading States
- Use `Skeleton` shimmer for content that has a known shape
- Use `LoadingScreen` for full-screen boot states
- Minimum skeleton display time: 200ms (prevent flash)
- Never show a spinner for operations under 500ms

### Error States
- Inline errors for form fields (below the input)
- Toast notifications for non-blocking errors (Zustand toast system)
- Full-screen error state for failed primary data loads — with retry button
- Never show raw error messages to users — map to human-readable strings

### Icons
- Icon set: `@expo/vector-icons` Feather
- iOS native: `expo-symbols` SF Symbols (where available)
- Never use emojis as icons in the UI
- Size scale: `xs` 14, `sm` 18, `md` 22, `lg` 28, `xl` 36

### Animations
- Use `react-native-reanimated` for all gesture-driven and performance-critical animations
- Use `Animated` (core RN) for simple opacity/scale transitions
- Spring physics for interactive elements: `{ damping: 20, stiffness: 300 }`
- Staggered entrance animations for list items (delay 50ms per item, max 300ms total)
- Page transitions: `fade` for auth flows, `slide_from_right` for drill-down navigation

### Transitions
- Tab switches: instant (no animation — system default)
- Stack pushes: `slide_from_right` (default)
- Modal/sheet presentations: `slide_from_bottom`
- Auth flows: `fade`

### Dark Mode Support
- Dark theme is the default (`userInterfaceStyle: "dark"` in app.json)
- Light theme tokens are defined and fully supported
- All colors via `useColors()` — automatic scheme switching
- No hardcoded colors anywhere in the codebase

### Responsive Layouts
- Minimum supported width: 375pt (iPhone SE)
- Maximum tested width: 430pt (iPhone 16 Pro Max)
- Use `flexbox` for all layouts — no absolute positioning for content
- Absolute positioning allowed only for: overlays, floating buttons, map markers

---

## 5. Design Philosophy

The Worlds interface is:

- **Minimal** — every element earns its place. If removing it doesn't hurt the user, remove it.
- **Modern** — current mobile design patterns, not web-ported layouts
- **Fast** — interactions feel instant; animations reinforce speed, not slow it down
- **Clean** — visual breathing room; generous whitespace; nothing competing for attention
- **Intuitive** — the user should know what to do without reading instructions
- **Low-friction** — the path from launch to playing should be as short as possible
- **Visually consistent** — every screen feels like it belongs to the same product

**Avoid:**
- Clutter — too many elements, options, or labels on one screen
- Unnecessary nested menus — flatten navigation wherever possible
- Duplicated screens — if two screens do the same thing, they are one screen
- Generic aesthetics — no purple gradients on white backgrounds, no template UIs
- Over-labeling — icons speak for themselves; trust the user

---

## 6. Quest Standards

### Quest Home Tab
Displays a prioritized summary of the player's active quest experience:

1. **Active Quest Card** (expanded, full-width) — the player's single most important active quest; shows title, progress, next step preview, and a "Continue" CTA
2. **Daily Quest Summary** — compact card; today's quest status and streak
3. **Monthly Quest Summary** — compact card; monthly completion progress
4. **Geo Quest Preview** — compact card; nearest available geo quest with distance indicator

If the player has no active quest, the Active Quest Card shows a "Start Your First Quest" prompt.

### Quest Quests Tab
Three sections displayed as a scrollable list with section headers:

1. **Daily Quest** — refreshes every 24 hours; one quest per day; streak counter
2. **Monthly Quest** — refreshes monthly; multi-step narrative quest arc
3. **Geo Quest** — location-anchored; available only within range; shows distance when out of range

### Quest Map Tab
Displays a Mapbox map (Build 5) with:
- Player location (pulsing dot)
- Quest waypoints (orange markers `#FF6B35`)
- Geo quest zones (radius overlays)
- Tap a waypoint to see quest info in a bottom sheet

### Quest Progress Tab
Three sections:
1. **Leaderboards** — global and friends rankings; filterable by time period
2. **In Action** — quests currently in progress
3. **Completed** — full history of finished quests with XP earned

### Quest Initiation
All quests require a **"Start Quest"** confirmation screen before gameplay begins. This screen shows: quest title, description, estimated duration, difficulty, and rewards. The player explicitly taps "Start Quest" to begin. There is no auto-start.

---

## 7. Hunt Standards

### Hunt Map Tab (Primary Screen)
The map is the center of the Hunt experience. It is the default tab and the first thing a player sees when entering Hunt mode.

The map displays pins/overlays for:
- **Official Hunts** — curated hunts published by the Worlds team (distinct visual style)
- **Community Hunts** — player-created hunts (future; grayed out until implemented)
- **Custom Games** — private games created by the player or invited to
- **Active Hunts** — hunts the player is currently participating in (highlighted)
- **Invitations** — hunt invites shown as pulsing invitation pins

A **Create** button is always visible on the map (floating action button).

### Official Hunts vs. Custom Games
| | Official Hunts | Custom Games |
|-|---------------|-------------|
| Created by | Worlds team | Any registered user |
| Reviewed | Yes — content moderation | No (private) |
| Discoverable | Yes — visible to all players on map | No — invite-only or link-only |
| Rewards | Official XP, leaderboard ranking | Custom or no rewards |
| Duration | Fixed by publisher | Set by creator |
| Availability | Geographic zones | Anywhere |

### Hunt My Hunts Tab
Four sections displayed as a tabbed list:
1. **In Action** — hunts currently in progress; shows time remaining and player rank
2. **Ready** — hunts joined but not yet started; shows start time
3. **Completed** — finished hunts with result summary
4. **Invitations** — pending hunt invitations with accept/decline actions

### Hunt Progress Tab
- Personal stats: hunts played, wins, best time, total score
- Leaderboards: global and friends
- Historical performance charts (future)

### Hunt Profile Tab
Shared profile system with Quest — same profile screen, different context.

### Create a Hunt
Accessible via the floating Create button on the map. Creates a Custom Game:
- Set title, description, area boundary, time limit, item list
- Invite players by username or share a link
- Custom Games are always private (not shown on the public map)

---

## 8. Future Systems

The following systems are planned but not yet implemented. Architecture must accommodate them:

| System | Description |
|--------|-------------|
| **Friends** | Follow/friend system; view friends' activity and progress |
| **Teams** | Small groups (2–10) competing together in hunts and quests |
| **Guilds** | Larger persistent communities with shared goals and leaderboards |
| **Events** | Time-limited special quests and hunts with unique rewards |
| **Future Game Modes** | Additional modes added via the game mode registry without core changes |
| **Creator Mode** | Tools for players to design and publish quests and hunts |
| **Marketplace** | Exchange of cosmetics, power-ups, and creator content |
| **Cosmetics** | Avatar items, trail effects, pin styles, profile frames |
| **Notifications** | Push notifications for invites, quest completions, leaderboard changes |
| **Achievements** | Milestone badges and XP multipliers across all game modes |

---

## 9. AI Standards

- **All AI generation is server-side only.** The mobile client never communicates directly with AI providers (OpenAI, Anthropic, etc.).
- AI API keys live in the Express API server environment only — never in `EXPO_PUBLIC_*` variables.
- The client calls `/api/ai/...` endpoints on the Express API server, which proxies to the AI provider.
- **Generated quests are always drafts until approved** by a moderator or administrator.
- AI-generated content is clearly labeled in the UI ("AI Draft") until published.
- Prompt templates are stored in the database and editable from the admin panel — not hardcoded.
- AI responses are cached server-side to minimize provider costs.
- Rate limiting is enforced per user per day at the API server level.

---

## 10. Mapping Standards

**Provider:** Mapbox (via `@rnmapbox/maps`)

> ⚠️ Mapbox requires a native build — it is incompatible with Expo Go. Implementation begins in Build 5.

The application will support:

| Feature | Use Case |
|---------|---------|
| **Markers** | Quest waypoints, hunt items, player position |
| **GeoJSON** | Hunt boundaries, geo quest zones |
| **Clustering** | Aggregating nearby markers at low zoom levels |
| **Bottom Sheets** | Tapping a marker reveals details in a sheet |
| **Geofencing** | Detecting when a player enters a quest zone |
| **Location Validation** | Server-side verification of claimed check-ins |
| **Distance Calculations** | Proximity sorting of quests and hunts |
| **Search** | Address and POI search for hunt creation |
| **Overlays** | Fog-of-war, boundary polygons, heatmaps |
| **Hidden Objectives** | Items revealed only when player is within range |

**Map Style:** Custom dark Mapbox Studio style matching the Worlds palette (`#0A0A12` background).

**Environment Variable:** `EXPO_PUBLIC_MAPBOX_TOKEN` (public token only — never the secret token).

---

## 11. Backend Standards

**Platform:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)

### Authentication
- Supabase Auth manages all user sessions
- JWT tokens are stored in AsyncStorage via the Supabase client adapter
- Sessions auto-refresh — the app never manually manages token expiry
- Supported methods (planned): Email/password, Google OAuth, Apple Sign-In

### Database
- All tables in the `public` schema
- Snake_case column names (mapped to camelCase in TypeScript via service layer)
- Every table has `created_at TIMESTAMPTZ DEFAULT now()` and `updated_at TIMESTAMPTZ DEFAULT now()`
- Soft deletes via `deleted_at TIMESTAMPTZ` on tables where history matters
- Schema changes via Supabase CLI migrations — never manual dashboard edits in production

### Storage
- Bucket naming: `avatars`, `game-media`, `quest-assets`, `hunt-assets`
- `EXPO_PUBLIC_*` client uses anon key — Storage RLS enforces access
- The `service_role` key is used only in server-side Edge Functions or the Express API

### Security
- **Row Level Security (RLS) is mandatory on every table.** No exceptions.
- Users can only read/write their own data unless explicitly granted broader access
- Role-based access uses the `profiles.role` column checked in RLS policies
- The Supabase anon key is safe to expose in the client (controlled by RLS)

### Future Edge Functions
- Complex business logic that requires `service_role` access
- Webhook handlers (payment events, push notification triggers)
- Scheduled jobs (daily quest refresh, leaderboard recalculation)

---

## 12. Coding Standards

### Folder Organization
```
features/<mode>/
  screens/        ← route-level screen components
  components/     ← mode-specific UI components
  hooks/          ← business logic hooks
  utils/          ← pure functions
  types.ts        ← mode-specific types (re-export from global types/ if shared)
```

### Naming Conventions
| Item | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `QuestCard.tsx` |
| Hook files | camelCase, `use` prefix | `useQuestList.ts` |
| Service files | camelCase, `.service.ts` suffix | `quest.service.ts` |
| Type files | camelCase, `.types.ts` suffix | `quest.types.ts` |
| Constants | SCREAMING_SNAKE (primitives), camelCase (objects) | `MAX_HINTS`, `spacing` |
| Route files | kebab-case (Expo Router convention) | `quest-detail.tsx` |
| Folders | kebab-case | `features/game-selector/` |

### Components
- One default export per file (the component)
- Named exports allowed for sub-components in the same file (keep under 200 lines total)
- Props interface declared above the component: `interface Props { ... }`
- No inline style objects in JSX — use `StyleSheet.create()`
- All `StyleSheet` objects at the bottom of the file

### Hooks
- One responsibility per hook
- Return a plain object, not an array (except `useState`-style pairs)
- Side effects in `useEffect` with explicit dependency arrays
- Never call hooks conditionally

### Services
- Return `{ data, error }` tuples — never throw from service methods
- All methods are `async` even if currently synchronous (forward compatibility)
- Typed against `supabase/types.ts` Database types

### State Management
- Server data → React Query
- Auth state → `AuthProvider` context
- Global UI state → Zustand (`lib/store.ts`)
- Form state → React Hook Form
- Local component state → `useState`
- Never store server data in Zustand

### Error Handling
- Service layer returns typed errors — never raw `Error` objects to UI
- Components display user-friendly messages — never raw error strings from the server
- Use the Zustand toast system for non-blocking errors
- Critical failures render a full-screen error state with a retry action

### Logging
- `console.warn` and `console.error` only — no `console.log` in committed code
- Production logging goes through the Express API server (Pino logger)
- Sensitive data (tokens, passwords, PII) is never logged

### Documentation
- All exported functions and types have JSDoc comments
- Complex business logic has inline comments explaining *why*, not *what*
- Each feature folder has a brief `README.md` or header comment in its primary file

### Testing (Future — Build 12)
- Unit tests for all utility functions in `utils/`
- Integration tests for service layer methods
- E2E tests for critical user flows (sign in, start quest, complete hunt)

### Reusable Code
- If the same logic appears in two places, extract it
- If a component is used in two features, move it to `components/`
- If a type is used in two features, move it to `types/`

---

## 13. Performance Standards

### Lazy Loading
- Feature screens are lazily imported via Expo Router's automatic code splitting
- Heavy dependencies (Mapbox, AI clients) are dynamically imported at the point of use

### Virtualized Lists
- `FlatList` for all scrollable content lists with `initialNumToRender={10}` and `maxToRenderPerBatch={5}`
- `getItemLayout` provided when item height is known (eliminates layout calculation)
- `windowSize={5}` to limit off-screen rendering

### Image Optimization
- Use `expo-image` for all remote images — automatic caching and memory management
- Specify `width` and `height` on all images — no layout shift
- Use `contentFit="cover"` or `contentFit="contain"` explicitly

### Caching
- React Query: `staleTime: 5 min`, `gcTime: 10 min` (default); adjust per query type
- Supabase responses cached in React Query — no duplicate requests
- Map tiles cached via Mapbox offline manager (Build 5)

### Efficient Map Rendering
- Cluster markers when density > 10 per screen
- Use `ShapeSource` + layers instead of individual `MarkerView` components for large datasets
- Throttle location updates to 1/second during active gameplay

### Minimal Re-renders
- Zustand selectors (`useAppStore(s => s.field)`) instead of subscribing to the whole store
- `React.memo` on pure list items that receive stable props
- `useCallback` for all event handlers passed as props
- `useMemo` for expensive derived values

### Future Offline Support
- React Query `networkMode: 'offlineFirst'` for read-heavy screens
- Mutation queue persisted to AsyncStorage — replayed on reconnect
- `NetInfo` from `@react-native-community/netinfo` for connection detection

---

## 14. Security Standards

### Authentication
- Sessions managed by Supabase Auth — never implement custom JWT handling
- Token refresh is automatic — the app never calls `refreshSession()` manually
- Sign-out clears the session from AsyncStorage via `supabase.auth.signOut()`

### Authorization
- All authorization is enforced server-side via Supabase RLS
- Client-side role checks (`useHasRole()`) are UX-only — they hide UI, they do not grant access
- Never trust client-sent role claims — roles are set server-side on `profiles.role`

### Secure Storage
- Session tokens: managed by Supabase client (AsyncStorage with encryption via `expo-secure-store` in a future hardening step)
- No sensitive data in plain AsyncStorage (passwords, tokens, PII)
- No sensitive data in `console.log` output

### API Secrets
- AI provider keys: Express API server environment only — never `EXPO_PUBLIC_*`
- Mapbox secret token: server-side only — only the public token in the client
- Supabase `service_role` key: server-side only — only the anon key in the client

### Media Uploads
- File type validation both client-side (before upload) and server-side (Supabase Storage MIME type rules)
- Maximum file size enforced in Storage bucket configuration
- User-uploaded content stored in user-scoped paths (`avatars/<userId>/...`)

### Future Moderation
- AI-generated content is always a draft — requires human review before publication
- User-reported content is queued for moderator review
- Banned users are blocked at the RLS level — their data becomes inaccessible

### Rate Limiting
- AI generation endpoints: rate-limited per user per day at the Express API level
- Auth endpoints: Supabase's built-in rate limiting applies
- File uploads: enforced via Storage bucket policies

### Validation
- All user input validated client-side with Zod before submission
- All API inputs re-validated server-side with Zod via `lib/api-zod`
- Database inputs validated by Supabase's column constraints and RLS policies

### Privacy
- Collect only the data required for the feature
- Location data is processed locally — never stored without explicit user consent
- User data deletion flow required before public launch (GDPR/CCPA compliance)

### Least Privilege
- The mobile client uses the Supabase anon key only
- Service operations requiring elevated access use Edge Functions with `service_role`
- Database roles follow principle of least privilege — no blanket `SELECT *` without RLS

---

## 15. Future Build Roadmap

| Build | Milestone | Description |
|-------|-----------|-------------|
| **Build 1** | ✅ Foundation | Project structure, design system, navigation shell, service layer, documentation |
| **Build 2** | Supabase Setup | Connect credentials, run migrations, configure RLS, test auth flow |
| **Build 3** | Authentication | Sign in, sign up, forgot password, social auth, session guards, profile creation |
| **Build 4** | Quest — Core | Quest data model, daily/monthly/geo quests, quest list, quest detail, initiation flow |
| **Build 5** | Mapbox | Map integration, custom style, location permissions, quest waypoints, geo zones |
| **Build 6** | Hunt — Core | Hunt map, official/custom hunt types, My Hunts, create a hunt, invite flow |
| **Build 7** | Progress & Profiles | XP system, leaderboards, achievements, player profiles, stats |
| **Build 8** | Admin Panel | Quest/hunt management, moderation queue, user management, prompt editor |
| **Build 9** | AI Generation | Quest generation, hint system, narrative content, server-side proxy, caching |
| **Build 10** | Social | Friends, teams, guilds, activity feeds, sharing |
| **Build 11** | Notifications | Push notifications for invites, completions, leaderboard changes |
| **Build 12** | Monetization | In-app purchases, subscriptions, marketplace, cosmetics (RevenueCat) |
| **Build 13** | Testing | Unit tests, integration tests, E2E tests for critical flows |
| **Build 14** | Performance | Profiling, offline mode, image optimization, map tile caching |
| **Build 15** | Deployment | App Store submission (Expo Launch), production Supabase, monitoring |

---

---

## 16. Authentication & Navigation Architecture

> Added: Build 1 — Authentication and Navigation Clarification. These rules are permanent.

### Launch Sequence

```
Native Splash Screen
        ↓
Authentication Check  (AuthProvider + NavigationGuard)
        ↓
Welcome / Login / Sign Up  ← (auth) route group
        ↓
First-Time Onboarding      ← (onboarding) route group
        ↓
Main Worlds Application    ← (main) route group
```

The app must never open directly into Quest or Hunt without first checking authentication.

### Route Group Architecture

```
app/
├── (auth)/           → unauthenticated users only
│   ├── welcome       → brand entry point; Sign Up + Log In
│   ├── login         → email + password; social auth slots reserved
│   ├── signup        → display name, username, email, password, ToS/PP
│   ├── forgot-password
│   └── reset-password
│
├── (onboarding)/     → authenticated, first-time users only
│   ├── welcome       → personalized greeting
│   ├── interests     → interest bubble selection (skippable)
│   ├── location      → location permission explanation + request (skippable)
│   └── starting-mode → choose Quest or Hunt as default
│
└── (main)/           → authenticated + onboarded users
    ├── quest/        → 5-tab Quest navigator
    └── hunt/         → 4-tab Hunt navigator
```

### NavigationGuard Rules
- Unauthenticated → `(auth)/welcome`
- Authenticated + `hasOnboarded: false` → `(onboarding)/welcome`
- Authenticated + `hasOnboarded: true` → `(main)/<activeMode>`
- After logout: clear session, clear sensitive cache, redirect to `(auth)/welcome`
- Authenticated users must never see the welcome/auth screens on return launch

### Welcome Screen
- Shows: Worlds logo, "Worlds" wordmark, tagline, Sign Up (primary), Log In (outline)
- Feels like the entrance to a game platform
- No login fields on this screen
- Subtle blue-and-green decorative treatment

### Sign-Up Screen
- Fields: display name, username, email, password, confirm password, ToS acceptance, Privacy Policy acceptance
- Future slots: Sign in with Apple, Sign in with Google
- No phone-number auth unless explicitly requested
- States: field validation, password requirements, loading, error, email-verification pending

### Login Screen
- Fields: email, password
- Links: Forgot password, Sign Up
- Future slots: Sign in with Apple, Sign in with Google
- States: loading, invalid credentials, unverified account, network error
- Never expose raw server error strings to users

### Password Recovery
- Forgot Password → email input → "Send reset link"
- Reset Password → new password + confirm → deep link: `worlds://reset-password?token=...`
- Deep link scheme `worlds` is already configured in app.json

### First-Time Onboarding
Steps (all skippable except final):
1. Welcome — personalized greeting
2. Interests — interest bubble selection; saved to profile (Build 4+)
3. Location — explains WHY location is useful before requesting; permission deferred to Build 5
4. Starting Mode — choose Quest or Hunt as default world

### Navigation Architecture: Two Layers

```
Top Game-Mode Switcher    ← compact header control
        +
Game-Specific Bottom Navigation  ← replaces based on active mode
```

### Top Game-Mode Switcher

- Location: left side of the shared header, present in both Quest and Hunt tab layouts
- Shows current mode name + chevron: `[ Quest ▼ ]`
- Tapping opens a modal: "Choose a World" → Quest / Hunt / (future modes)
- Selection calls `router.replace('/(main)/<mode>')`
- Zustand `activeMode` and `lastQuestTab`/`lastHuntTab` preserve state across switches

**The mode switcher replaces the old Game Selector home screen.** Quest and Hunt are modes, not bottom-nav destinations.

### Quest Bottom Navigation (exactly 5 tabs — permanent)

| # | Tab | Route | Icon | Purpose |
|---|-----|-------|------|---------|
| 1 | Home | index | house | Active quest + daily/monthly/geo summaries |
| 2 | Quests | quests | compass | Daily, Monthly, Geo-Quest browse |
| 3 | Map | map | map | Quest waypoints (Build 5) |
| 4 | Progress | progress | bar-chart | Leaderboards, In Action, Completed |
| 5 | Profile | profile | user | Shared player profile + settings |

**Forbidden tabs:** Discover · Geo · Hunt · Notifications · Settings

### Hunt Bottom Navigation (exactly 4 tabs — permanent)

| # | Tab | Route | Icon | Purpose |
|---|-----|-------|------|---------|
| 1 | Map | index | map-pin | PRIMARY — live hunt map (Build 5+) |
| 2 | My Hunts | my-hunts | flag | In Action, Ready, Completed, Invitations |
| 3 | Progress | progress | bar-chart | Personal stats and leaderboards |
| 4 | Profile | profile | user | Shared player profile + settings |

**Forbidden tabs:** Discover · Quest · Create · Notifications · Settings

The **+ Create** action for Custom Games lives inside the My Hunts tab — not in the bottom navigation.

### Switching Between Modes

- Switching mode replaces the bottom navigation with the new mode's tabs
- Each mode's last-visited tab is preserved in Zustand (`lastQuestTab`, `lastHuntTab`)
- The last active mode is stored in Zustand (`activeMode`) — persisted to AsyncStorage in Build 2
- Switching does not reset both modes to their first tab

Example:
```
User on: Quest → Progress
Switches to: Hunt → Map (default)
Returns to Quest: Quest → Progress (restored)
```

### Shared Profile

Quest Profile and Hunt Profile point to the same underlying user data.
Screens may show mode-specific stats but must not create separate user identities.
Settings are accessed through Profile — never through a dedicated Settings bottom tab.

### Header Behavior

```
[ Mode ▼ ]              [Notifications Bell]
```

- Left: GameModeSwitcher (compact pill button)
- Right: NotificationBell (with unread count badge)
- Map screens: header may use transparent/floating variant so map remains dominant

Do not add: large Worlds branding on every screen · search on every screen · too many action icons

---

## 17. Permanent Navigation Rules

These rules are binding. Deviation requires explicit written instruction.

1. Quest and Hunt are switched through the compact top-level GameModeSwitcher.
2. Quest and Hunt must **never** be added as bottom-navigation tabs.
3. Bottom navigation changes entirely when the game mode changes.
4. Quest has exactly **five** bottom tabs: Home, Quests, Map, Progress, Profile.
5. Hunt has exactly **four** bottom tabs: Map, My Hunts, Progress, Profile.
6. Notifications are accessed from the top header bell — not a bottom tab.
7. Settings are accessed through Profile — not a bottom tab.
8. Hunt creation (+ Create) is accessed through My Hunts — not the bottom nav.
9. The selected game mode and last tab in each mode must be preserved across switches.
10. Splash, authentication, onboarding, and the main application use separate route groups.
11. Do not invent additional tabs without explicit approval from the project owner.
12. Unauthenticated users must be redirected to `(auth)/welcome` — never see main app screens.
13. Authenticated returning users must never see the welcome/auth screens.

---

## 18. UI/UX Direction

> Added: Build 1 — UI Direction Addendum. This section supersedes any prior visual direction notes.

### Overall Visual Direction

Worlds should feel like a polished, modern real-world exploration game.

**The interface must be:**
Immersive · Minimal · Modern · Friendly · Adventurous · Fast · Clean · Slightly futuristic · Easy to understand immediately

**It must not feel like:**
A generic business dashboard · A social-media feed · A crowded marketplace · A children's cartoon · A copy of Pokémon GO · A collection of disconnected cards · A web page squeezed into a mobile app

Use a game-oriented visual language while remaining professional and accessible.

---

### Brand Presentation

Display the application name as **Worlds**.

Show "Worlds" on: splash screen, authentication screens, app metadata, loading screens, empty states where appropriate, documentation, admin branding.

**Do not** place the Worlds name at the top of every gameplay screen. Gameplay screens must prioritize the game content itself.

---

### Color & Style Direction

**Primary palette:**
- Deep blue `#1D4ED8` — primary actions, active states, UI chrome
- Natural green `#16A34A` — accent, success, accent markers
- Soft neutral `#F8FAFC` — primary background
- Dark charcoal `#111827` — body text

The blue and green suggest: exploration, earth, movement, discovery, technology.

**Game-mode colors:**
- Quest: warm adventure orange `#F97316`
- Hunt: forest green `#059669`

**Rules:**
- Avoid excessive gradients
- Avoid neon-heavy cyberpunk styling
- Avoid unrelated accent colors
- Use accent colors purposefully: active states, points, progress, selected markers, success, warnings, errors
- All colors via `useColors()` — design tokens defined for both light and dark

**Mode:** Light is the primary experience. Dark mode tokens are fully defined and ready for future activation.

---

### Layout Philosophy

**Use:**
- Clear visual hierarchy
- Generous but efficient spacing
- Large touch targets (minimum 44×44pt)
- Minimal text clutter
- Consistent rounded corners (`radius.md` = 12px, `radius.lg` = 16px)
- Concise labels
- Bottom sheets for map-related details
- Full-width primary actions
- Scrollable content only where necessary
- Persistent bottom navigation inside each game mode

**Avoid:**
- Excessive nested cards
- Too many horizontal carousels
- Overly large headers
- Redundant section titles
- Multiple competing primary buttons
- Deep menu hierarchies
- Tiny text
- Desktop-style sidebars

---

### Universal App Shell

The top-level game-mode selector allows switching between Quest, Hunt, and future modes. It must feel like switching between game experiences — not ordinary settings tabs.

Implementation options (choose when building): compact mode switcher, swipeable selector, polished dropdown/modal, distinct mode iconography.

**Rules:**
- The selector must not consume excessive vertical space
- Each game mode must preserve the user's last screen when switching modes

---

### Quest UI Direction

Quest should feel focused, encouraging, and activity-oriented.

**Home screen (when active quest exists):**
- One expanded active-quest panel, visually dominant
- Shows: title, current objective, points, status, one action (Continue Quest or Submit Proof)
- Progress bar only for genuinely multi-step quests
- Below: compact previews for Daily Quest, Monthly Quest Drop, Geo-Quest
- Do not create a grid of equal cards — the active quest must dominate

**Quests screen contains only:**
- Daily Quest
- Monthly Quest Drop
- Geo-Quest
- No complicated discovery categories; no unnecessary filters in the first build

**Geo-Quest items must clearly show:** location-pin icon, title, referenced location, distance when available, points, access/availability status

**Quest Detail includes:** hero/contextual image, title, points, duration, difficulty, indoor/outdoor indicator, accessibility info, location, objective, proof requirements, safety notes, one primary action
- Before initiation: **"Start Quest"**
- After initiation: appropriate state action

**Quest Progress contains:** Leaderboards, In Action, Completed
- User's own point total and rank must be visually prominent
- In Action uses clear status indicators, not excessive progress bars

---

### Hunt UI Direction

Hunt should feel map-first and immersive.

**Hunt Map (primary screen):**
- Opens immediately when Hunt is selected
- Map occupies nearly the entire usable screen
- Floating controls only: search, filters, location, re-center
- No large permanent discovery panel over the map
- Eventually displays: Official Hunts, Custom Games, Active Hunts, Invitations, future Community Hunts

**Map markers must be:** distinct, readable, consistent, visually controlled, appropriate for clustering. No large user photos across the map.

**Tapping a marker opens a bottom sheet showing:** hunt image, title, type, distance, estimated time, points/reward, access state, one primary action

**Active Hunt gameplay:** map stays dominant; compact overlays for objective, distance, clue access, progress, exit/pause. No permanent panels covering the map.

**My Hunts contains:** In Action, Ready, Completed, Invitations. A visible **+ Create** button is always present. Custom Game creation must not be hidden in settings.

**Custom Game creation:** guided step-by-step flow (Basic details → Privacy/scheduling → Starting location → Add stops → Clues/validation → Invite players → Review & create). Allow cover image and stop image uploads.

---

### Image Presentation

- Consistent aspect ratios across all image contexts
- Proper placeholder during load — prevent layout shifts
- Image compression and optimization before upload
- No low-quality stretched images
- Unapproved uploads must not be exposed in future moderation flow

---

### Map Presentation Rules

When Mapbox is added (Build 5):
- Map fills its intended area — no decorative placeholder appearance
- Markers use coherent iconography; selected markers are visually distinct
- Bottom sheets coordinate with selected map content
- Controls must not overlap the bottom navigation bar
- Dense markers cluster automatically
- Hidden objectives are never exposed before the player is in range
- Private Custom Game locations remain access-controlled

---

### Motion & Feedback

Use subtle motion for: screen transitions, bottom sheets, marker selection, quest-start confirmation, progress updates, completion feedback, loading placeholders.

Avoid excessive animations. Animations communicate state — they do not decorate every interaction.

Support `prefers-reduced-motion` / `isReduceMotionEnabled` in a future accessibility pass.

---

### Shared Component Registry

The following components are defined in the design system. Feature build steps must use these rather than creating ad-hoc equivalents:

| Component | Location | Status |
|-----------|----------|--------|
| Button | `components/ui/Button.tsx` | ✅ Built |
| Card | `components/ui/Card.tsx` | ✅ Built |
| Input | `components/ui/Input.tsx` | ✅ Built |
| Badge / StatusBadge | `components/ui/Badge.tsx` | ✅ Built |
| Skeleton / SkeletonCard | `components/loading/Skeleton.tsx` | ✅ Built |
| LoadingScreen | `components/loading/LoadingScreen.tsx` | ✅ Built |
| EmptyState | `components/ui/EmptyState.tsx` | ✅ Stubbed |
| ErrorState | `components/ui/ErrorState.tsx` | ✅ Stubbed |
| ScreenHeader | `components/ui/ScreenHeader.tsx` | ✅ Stubbed |
| PointsBadge | `components/ui/PointsBadge.tsx` | ✅ Stubbed |
| ProgressIndicator | `components/ui/ProgressIndicator.tsx` | ✅ Stubbed |
| ConfirmationModal | `components/ui/ConfirmationModal.tsx` | ✅ Stubbed |
| MapFloatingButton | `components/ui/MapFloatingButton.tsx` | ✅ Stubbed |
| InterestBubble | `components/ui/InterestBubble.tsx` | ✅ Stubbed |
| ImageUploader | `components/ui/ImageUploader.tsx` | ✅ Stubbed |
| QuestCard | `components/quest/QuestCard.tsx` | ✅ Stubbed |
| HuntPreviewSheet | `components/hunt/HuntPreviewSheet.tsx` | ✅ Stubbed |
| GameModeSelector | `components/ui/GameModeSelector.tsx` | 🔲 Future |
| BottomNavigation | Expo Router tab layouts | 🔲 Per-mode |

---

## 19. Permanent UX Rules

These rules are binding on all future build steps. Deviating from them requires explicit written instruction from the project owner.

1. **Do not invent additional bottom-navigation tabs** beyond those specified per mode in Section 3.
2. **Do not recreate a Hunt Discover screen.** The map is the discovery surface.
3. **Do not create a separate Geo tab for Quest.** Geo-Quest lives inside the Quests tab.
4. **Do not duplicate content across Home, Progress, and My Hunts.** Each screen has a defined and non-overlapping purpose.
5. **The Hunt map must remain the primary Hunt experience.** It is the default tab; do not demote it.
6. **Quest Home must prioritize one active quest.** No equal-weight card grids on the Home tab.
7. **Custom Game creation must be accessible from My Hunts.** Do not hide it in settings or a separate creator dashboard.
8. **Use one dominant primary action per screen.** No competing CTAs.
9. **Prefer bottom sheets for map-item details.** Do not navigate away from the map for hunt/quest previews.
10. **Avoid generic dashboard layouts.** Every screen should feel like part of a game, not an admin panel.
11. **Preserve the approved blue-and-green Worlds visual direction.** Do not introduce new primary palette colors without explicit instruction.
12. **Ask for explicit instruction before materially redesigning established navigation.** Navigation changes affect every screen — they are not routine refactors.

---

*Last updated: Build 1 — Authentication and Navigation Clarification*
*This document supersedes all prior architectural notes in individual doc files.*
