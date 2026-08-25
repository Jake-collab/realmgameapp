# Clean Supabase reset — Worlds

Use this runbook only when the linked Supabase project must be replaced with the
canonical Worlds schema. It preserves the legacy schema before the destructive
operation and does not alter migration history by hand.

## Required approval

Before resetting an existing project:

1. The project owner must explicitly approve the destructive reset.
2. Create and verify a schema backup. Keep it outside Git because it may
   contain application data.
3. Confirm the project reference is the intended project.

## Reset procedure

From `artifacts/mobile`, with the linked project password available only in the
environment:

```bash
export SUPABASE_DB_PASSWORD='...'
npx --yes supabase@2.115.0 db dump --linked --file /safe/path/worlds-backup.sql
test -s /safe/path/worlds-backup.sql

npx --yes supabase@2.115.0 db reset --linked --no-seed --yes
pnpm run verify:linked-supabase
```

`db reset --linked` drops the linked project’s application schema and applies
the checked-in migrations in canonical order. Do not use `migration repair`,
manual migration-history inserts, or a partial `db push` to work around a
mismatch.

## What the verification checks

`pnpm run verify:linked-supabase` reads no secrets from source control. It
requires `SUPABASE_DB_PASSWORD` in the environment and verifies:

- remote migration parity for every canonical migration from `001` through
  `049`;
- the core Quest completion and Hunt Drop authorization RPCs;
- RLS enabled on `quests` and `hunts`, plus a non-empty RLS policy set.

Run the configured live Quest and Hunt contract suites after this command when
credentials are available. Those suites use disposable fixtures and must clean
up after themselves.