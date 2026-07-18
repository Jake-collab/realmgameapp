# Database Strategy

## Platform

**Supabase PostgreSQL** — managed PostgreSQL with built-in:
- Row-Level Security (RLS)
- Real-time subscriptions
- Auto-generated REST + GraphQL API
- Auth-integrated user management

## Schema Design Principles

1. **RLS on every table** — no table is accessible without a policy.
2. **`auth.users` is the source of truth for identity** — the `profiles` table extends it via FK.
3. **Snake_case column names** — Supabase convention; mapped to camelCase in TypeScript.
4. **Soft deletes** — use `deleted_at TIMESTAMPTZ` instead of hard deletes where history matters.
5. **Timestamps on every table** — `created_at` and `updated_at` with default `now()`.

## Planned Tables

### `profiles`
Extends `auth.users` with app-specific user data.

```sql
create table profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  username     text not null unique,
  display_name text,
  avatar_url   text,
  bio          text,
  role         text not null default 'registered',
  xp           integer not null default 0,
  level        integer not null default 1,
  badges       text[] not null default '{}',
  -- stats
  quests_completed  integer not null default 0,
  hunts_completed   integer not null default 0,
  total_score       integer not null default 0,
  streak            integer not null default 0,
  longest_streak    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create profile on sign up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### `game_sessions`
Tracks individual play sessions for any game mode.

```sql
create table game_sessions (
  id           uuid primary key default gen_random_uuid(),
  mode         text not null,  -- 'quest' | 'hunt'
  user_id      uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  score        integer not null default 0,
  status       text not null default 'active',  -- 'active' | 'completed' | 'abandoned'
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
```

## RLS Policies (Example)

```sql
-- Users can only read and update their own profile
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = user_id);

-- Admins can read all profiles
create policy "Admins can view all profiles"
  on profiles for select
  using (exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'administrator'
  ));
```

## Migrations

- Schema changes are written as numbered SQL migration files (Supabase CLI).
- Never modify production schema manually — always via migrations.
- Development: `npx supabase db push`
- Generate TypeScript types after schema changes:
  `npx supabase gen types typescript --project-id <id> > supabase/types.ts`

## Real-Time (Future)

Hunt mode will use Supabase Realtime for live player positions:
```ts
supabase
  .channel('hunt-room-<id>')
  .on('broadcast', { event: 'location' }, (payload) => { ... })
  .subscribe();
```
