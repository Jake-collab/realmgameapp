# Database backup and recovery

Supabase is the intended production database. Replit PostgreSQL is not a replacement for this schema.

## Before launch

1. Enable the Supabase project’s managed backups and record retention/restore ownership.
2. Keep development, preview, and production projects separate.
3. Review migrations in `artifacts/mobile/supabase/migrations/` in numeric order.
4. Apply schema changes through a linked Supabase CLI/CI environment after review:

```bash
supabase link --project-ref <owner-supplied-project-ref>
supabase db push
supabase gen types typescript --project-id <owner-supplied-project-ref> --schema public > artifacts/mobile/lib/supabase/database.types.ts
```

Never paste project passwords or service keys into source control or chat. The production readiness check does not run `db push`.

## Recovery runbook

- Declare the incident and stop application writes if corruption is suspected.
- Capture the current timestamp, migration version, affected tables, and audit records.
- Restore into a separate recovery project first; validate RLS, storage policies, trusted RPCs, Auth, and reward/proof invariants.
- Compare recovery results with the last known-good production checkpoint.
- Obtain owner approval before switching traffic or applying corrective writes.
- Re-run `/api/healthz`, `/api/readiness`, Auth, storage, and protected workflow checks after recovery.
- Record the restore decision, scope, and follow-up corrective migration.