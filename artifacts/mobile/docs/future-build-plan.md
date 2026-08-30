# Future Build Plan

## Build 1 — Foundation (✅ Complete)
- Project structure and architecture
- Design system (colors, typography, spacing, shadows)
- Navigation shell (tabs: Home, Notifications, Profile, Settings)
- Supabase service layer (auth, database, storage)
- Auth context and role system (anonymous → administrator)
- TanStack Query and Zustand configuration
- Game type definitions and GAME_MODES registry
- Placeholder screens for all main routes
- Documentation

## Build 2 — Authentication
- Sign In screen (email + password)
- Sign Up screen (with username)
- Forgot Password / Reset Password flow
- Auth guards (redirect unauthenticated users)
- User profile creation on signup (Supabase trigger)
- Session persistence and token refresh
- Social auth (Google, Apple) — optional

## Build 3 — Quest Game Mode
- Quest data model (title, description, steps, location)
- Quest list screen (browse available quests)
- Quest detail screen (overview + start button)
- Quest play screen (step-by-step gameplay)
- Location check-in for quest waypoints
- Quest completion and XP award
- Quest history in profile

## Build 4 — Hunt Game Mode
- Hunt data model (target items, boundary, time limit)
- Hunt lobby and matchmaking
- Hunt map view (Mapbox integration)
- Real-time player positions (Supabase Realtime)
- Item discovery and confirmation flow
- Hunt scoring and leaderboard
- Hunt history in profile

## Build 5 — Maps (Mapbox)
- Mapbox SDK integration
- Custom map style (dark game theme)
- Location permission flow
- Quest waypoint overlays
- Hunt boundary rendering
- Offline map tile caching
- Map performance optimization

## Build 6 — AI Features
- AI quest generation (server-side, OpenAI)
- AI hint system for stuck players
- AI-generated narrative content
- Content moderation (AI-powered)
- All AI calls proxied through Express API (never from client)

## Build 7 — Social + Creator Tools
- Creator role: publish quests and hunts
- Content review workflow (moderator role)
- Social features: follow players, share results
- Leaderboards (global and friends)
- Push notifications (Expo Notifications)

## Build 8 — Monetization
- See `REVENUE_STAGE_1_SPEC.md` for the canonical provider-neutral revenue model
- One Worlds Membership with allowance-based Quest and Hunt access
- Weekly included Drop allowance and separate Extra Drop Credits
- Find Badges, acquired Collectibles, and provider-neutral marketplace accounting
- External payment-provider connections and store-policy validation are Stage 3 work

## Build 9 — Polish + Performance
- Offline mode (full write queue)
- Image optimization (expo-image caching)
- Code splitting and lazy loading
- Performance profiling and optimization
- Accessibility audit
- App Store submission prep
