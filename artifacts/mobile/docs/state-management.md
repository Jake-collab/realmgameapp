# State Management

## Decision Matrix

| State Type | Tool | Location |
|-----------|------|---------|
| Server data (profiles, sessions) | React Query | `queryClient.ts` + feature hooks |
| Authentication | React Context | `features/auth/AuthProvider.tsx` |
| Global UI (toasts, unread count) | Zustand | `lib/store.ts` |
| Form state | React Hook Form | Local to form component |
| Transient local state | `useState` | Local to component |
| Persisted preferences | AsyncStorage | Via feature context or hook |

## React Query (Server State)

All Supabase data reads use React Query hooks. Key principles:

- **staleTime: 5 minutes** — data is considered fresh for 5 minutes after fetch.
- **gcTime: 10 minutes** — inactive queries stay in cache for 10 minutes.
- **No manual caching** — let React Query handle it; never store server data in Zustand.
- Mutations call `queryClient.invalidateQueries()` after success to refresh stale data.

```ts
// Reading data
const { data: profile, isLoading } = useQuery({
  queryKey: ['profile', userId],
  queryFn: () => profilesService.getByUserId(userId),
  enabled: !!userId,
});

// Mutating data
const mutation = useMutation({
  mutationFn: (payload) => profilesService.update(userId, payload),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
});
```

## Zustand (Global UI State)

The `useAppStore` (defined in `lib/store.ts`) contains three slices:

### App Slice
- `isReady` — set to `true` after initial auth check completes
- `hasOnboarded` — persisted via AsyncStorage in a later Build

### UI Slice
- `toasts` — array of toast notifications
- `addToast / removeToast / clearToasts`

### Notifications Slice
- `unreadCount` — drives the tab bar badge
- `setUnreadCount / incrementUnread / clearUnread`

Usage:
```ts
const addToast = useAppStore((s) => s.addToast);
const unreadCount = useAppStore((s) => s.unreadCount);
```

Always use selectors (the `(s) => s.field` pattern) to prevent unnecessary re-renders.

## Auth Context

`AuthProvider` wraps the whole app and subscribes to Supabase auth state changes. Components access it via `useAuth()`:

```ts
const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();
```

Do NOT import `AuthProvider` or `useAuthContext` directly from components — always use `useAuth()`.

## AsyncStorage

Used for lightweight client-side persistence (preferences, onboarding flags):
- Session tokens are managed by Supabase's own storage adapter (already wired).
- App preferences (theme override, notification settings) will use AsyncStorage in later Builds.
- Never store sensitive data (tokens, passwords) in AsyncStorage directly.
