# Row Level Security — Worlds

This document explains the RLS strategy. All policies are defined in
`supabase/migrations/014_rls_policies.sql`.

---

## Principle

**Default deny.** Every table has RLS enabled. A table with no permissive
policies is inaccessible to all authenticated and anonymous users.
`service_role` bypasses RLS (Supabase default) — it is used only by
Edge Functions and trusted server code.

---

## Policy Summary by Table

| Table | Anon | Auth User | Owner | service_role |
|---|---|---|---|---|
| `profiles` | Select (active accounts) | Select (active accounts) | Update own (no role/status) | All |
| `user_settings` | None | None | Select + Update | All |
| `user_interests` | None | None | Select + Insert + Delete | All |
| `interests` | Select (active) | Select (active) | None | All |
| `media_assets` | Public+approved only | Own + public+approved | Own CRUD | All |
| `quests` | Published+available | Published+available | None | All |
| `quest_objectives` | Published quests | Published quests | None | All |
| `quest_locations` | Published quests | Published quests | None | All |
| `quest_geofences` | **None** | **None** | **None** | **All** |
| `quest_participations` | None | Own only | Own only | All |
| `quest_step_progress` | None | Own (via participation) | Own (via participation) | All |
| `proof_submissions` | None | Own (draft only to update) | Own | All |
| `hunts` | Public/unlisted | Public/unlisted + accessible | Custom game creator | All |
| `hunt_stops` | Via hunt access | Via hunt access | None | All |
| `hunt_clues` | Revealed only | Revealed only | None | All |
| `hunt_stop_geofences` | **None** | **None** | **None** | **All** |
| `hunt_participants` | None | Own + creator sees list | Own status update | All |
| `hunt_invitations` | None | Inviter + invitee | Respond / revoke | All |
| `hunt_stop_progress` | None | Own (via participant) | Insert + select | All |
| `points_ledger` | None | Own (read-only) | None | All |
| `achievements` | Active non-hidden | Active non-hidden | None | All |
| `user_achievements` | None | Own (incl. hidden once earned) | Own | All |
| `notifications` | None | Own (non-expired) | Mark as read | All |
| `reports` | None | Create own | View own status | All |
| `user_blocks` | None | Own list | Create + Delete | All |
| `moderation_cases` | **None** | **None** | **None** | **All** |
| `audit_logs` | **None** | **None** | **None** | **All** |
| AI tables | **None** | **None** | **None** | **All** |

---

## Critical Security Triggers

### Role self-promotion prevention
```sql
-- Trigger: trg_prevent_role_self_promotion (on profiles)
-- Users cannot change their own role or account_status via authenticated client.
-- Only service_role (admin RPCs) may elevate roles.
```

### Ledger immutability
```sql
-- Triggers: trg_no_ledger_update, trg_no_ledger_delete (on points_ledger)
-- Any UPDATE or DELETE on points_ledger raises an exception.
-- Corrections are made via reversal transactions.
```

### Audit log immutability
```sql
-- Triggers: trg_no_audit_update, trg_no_audit_delete (on audit_logs)
-- Audit records cannot be modified or removed.
```

---

## Testing Policies

Use the Supabase dashboard's **Authentication → Policies** tester or run:

```sql
-- Simulate a specific user's access
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "<user-uuid>", "role": "authenticated"}';

-- Should return only the user's own rows
SELECT * FROM quest_participations;

-- Should return nothing (geofences are server-only)
SELECT * FROM quest_geofences;

-- Should fail (ledger is read-only for users)
INSERT INTO points_ledger (user_id, amount, transaction_type, source_type, idempotency_key)
VALUES ('<user-id>', 999, 'admin_adjustment', 'manual', 'test_key');
```

---

## Common RLS Mistakes to Avoid

1. **Never use `SECURITY DEFINER` functions without restricting `search_path`** —
   always `SET search_path = public`.
2. **Never expose private `quest_geofences` or `hunt_stop_geofences` rows** to clients —
   these tables must remain `service_role`-only.
3. **Never allow clients to write `awarded_points`** on `quest_participations` or
   `hunt_participants` — these fields are server-only.
4. **Never expose `reporter_user_id`** to the entity being reported — reporters
   are protected by the `reports_own_select` policy.
5. **Never copy `email` from `auth.users` into `profiles`** — email stays in Supabase Auth.
