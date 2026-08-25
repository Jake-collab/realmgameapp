# Quest live database testing

`__tests__/questRpc.integration.test.ts` is the Supabase integration suite for
Quest trust boundaries. It is skipped by the normal Jest command unless all
three variables below are present:

```sh
QUEST_TEST_SUPABASE_URL=
QUEST_TEST_SUPABASE_ANON_KEY=
QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY=
```

The release check uses a disposable local Supabase database. CI removes any
previous test volume, starts the database from `supabase/config.toml`, applies
every checked-in migration, and deletes its Docker volumes after the test. No Supabase project, database
credentials, or CI secrets are required.

For a manually managed disposable Supabase project, apply the complete
migration set first, including `039_quest_integrity.sql`. The suite creates two
temporary users and fixture Quests, then removes them in `afterAll`.

Run it with:

```sh
cd artifacts/mobile
QUEST_TEST_SUPABASE_URL=... \
QUEST_TEST_SUPABASE_ANON_KEY=... \
QUEST_TEST_SUPABASE_SERVICE_ROLE_KEY=... \
pnpm test -- --runInBand __tests__/questRpc.integration.test.ts
```

To run the same isolated check locally (requires Docker and the Supabase CLI):

```sh
pnpm test:quest-database
```

The suite verifies:

- `complete_quest` uses `reward_snapshot_points`, and retries create one ledger row.
- A second user cannot complete or attach proof to another user's participation.
- A player cannot directly mutate a completion reward or forge a reward snapshot.
- A participant cannot attach an objective from another Quest.
- Step progress, abandonment, expiration, and proof draft/submission writes persist.
- Submitted proof is immutable under the authenticated RLS policy.

Do not point these variables at a production database. The service-role key is
only used to create and clean up disposable fixtures.

## Release gate

`.github/workflows/quest-database.yml` runs on Quest-related pull requests and
on every `main` push. Configure the `Quest RPC and RLS contracts` job as a
required status check in the repository's protected `main` branch before
enabling automatic releases. A migration, RPC, reward-idempotency,
cross-owner, proof-immutability, or objective-integrity failure then produces a
failed check and cannot be merged into the release branch.