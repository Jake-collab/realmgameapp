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

The release gate is pinned to **Supabase CLI `2.115.0`**. The local harness uses
the same version by default and refuses to run with a different installed CLI,
so a local pass exercises the same CLI contract as CI.

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

## Updating the Supabase CLI pin

Do not replace the pin with `latest`. To deliberately update it:

1. Set `SUPABASE_CLI_VERSION` to the candidate version and run
   `pnpm test:quest-database` from `artifacts/mobile` (or install that exact
   CLI so the harness validates it).
2. Confirm a fresh local database applies every checked-in migration.
3. Confirm the complete Quest RPC/RLS integration suite passes.
4. Change both the workflow pin and the harness default to the candidate, then
   update this documented version in the same change and rerun the check.

The update is only ready when migrations and the Quest suite pass with the
candidate. This keeps a CLI or container change from being mistaken for a
Quest behavior regression.

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