# Quest live database testing

`__tests__/questRpc.integration.test.ts` is the isolated Supabase integration
suite for Quest trust boundaries. It is skipped by the normal Jest command
unless all three variables below are present:

```sh
QUEST_TEST_SUPABASE_URL=
QUEST_TEST_SUPABASE_ANON_KEY=
QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY=
```

Use a disposable Supabase project with the complete migration set applied,
including `039_quest_integrity.sql`. The suite creates two temporary users and
fixture Quests, then removes them in `afterAll`.

Run it with:

```sh
cd artifacts/mobile
QUEST_TEST_SUPABASE_URL=... \
QUEST_TEST_SUPABASE_ANON_KEY=... \
QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY=... \
pnpm test -- --runInBand __tests__/questRpc.integration.test.ts
```

The suite verifies:

- `complete_quest` uses `reward_snapshot_points`, and retries create one ledger row.
- A second user cannot complete or directly mutate another user's participation.
- A participant cannot attach an objective from another Quest.
- Step progress, abandonment, expiration, and proof draft/submission writes persist.
- Submitted proof is immutable under the authenticated RLS policy.

Do not point these variables at a production database. The service-role key is
only used to create and clean up disposable fixtures.