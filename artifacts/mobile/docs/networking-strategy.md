# Networking Strategy

## Architecture

The app communicates with two backends:

1. **Supabase** — Auth, PostgreSQL database, file storage, Row-Level Security
2. **Express API Server** (`artifacts/api-server`) — Server-side logic, AI proxying, non-database business logic

```
Mobile App
├── Supabase Client (services/supabase.ts)
│   ├── Auth  → services/auth.service.ts
│   ├── DB    → services/database.service.ts
│   └── Storage → services/storage.service.ts
│
└── Express API (via @workspace/api-client-react)
    └── Generated React Query hooks from openapi.yaml
```

## Supabase Rules

- The Supabase client is a singleton (`services/supabase.ts`).
- **Never expose the `service_role` key on the client.** It goes in the API server only.
- Row-Level Security (RLS) must be enabled on every table. The client JWT enforces access.
- Storage buckets must have appropriate RLS policies (avatars: owner-only write, public read).

## Express API Rules

- The API server handles: AI API calls (OpenAI, etc.), complex server-side business logic,
  and any operation requiring `service_role` privileges.
- The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the source of truth.
- After any spec change: `pnpm --filter @workspace/api-spec run codegen`
- Use generated hooks from `@workspace/api-client-react` — never write manual fetch calls.
- The base URL is set in `app/_layout.tsx` via `setBaseUrl(...)`.

## URL Strategy

- In development: `process.env.EXPO_PUBLIC_DOMAIN` resolves to the Replit dev domain.
- Never hardcode `localhost` or specific domains in app code.
- The API base URL is set once at boot; all hooks use it automatically.

## Offline Support (Future)

React Query's cache provides offline read capability for previously-fetched data.
Full offline support (write queue) will be implemented in a dedicated Build step using:
- React Query's `networkMode: 'offlineFirst'`
- A mutation queue persisted to AsyncStorage
- Background sync on reconnect

## Error Handling

- Service methods return `{ data, error }` tuples — never throw.
- React Query's `retry` is configured to 2 attempts with exponential backoff.
- Network errors surface via the `error` state in query hooks.
- User-visible errors use the toast system: `useAppStore().addToast(...)`.

## Caching Strategy

| Data | Cache Duration | Invalidation |
|------|---------------|-------------|
| User profile | 5 min stale, 10 min gc | On profile mutation |
| Game sessions | 5 min stale | On session creation/end |
| Notifications | 1 min stale | On notification read |
| Static content (modes, maps) | 30 min stale | Manual refresh |
