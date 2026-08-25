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
so a local pass exercises the same CLI contract as CI. The release gate never
uses `latest`.

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

1. Use the **Candidate Supabase CLI compatibility** job from
   `.github/workflows/quest-database.yml`. It runs every Monday against
   `latest`, or run the workflow manually with an exact candidate such as
   `2.116.0` in the `supabase_cli_version` input.
2. Confirm the job's fresh disposable database applies every checked-in
   migration and that the complete Quest RPC/RLS integration suite passes.
   The job prints the concrete version resolved from `latest`; a failed
   migration or test produces a failed candidate check.
3. For a local candidate check, set `SUPABASE_CLI_VERSION` to an exact
   candidate and run `pnpm test:quest-database` from `artifacts/mobile`.
   `SUPABASE_CLI_VERSION=latest` is also supported when the locally installed
   CLI is the candidate you want to exercise.
4. Only after the candidate check passes, change both the release workflow pin
   and the harness default to that exact version, update this documented
   version, and rerun the pinned check. Do not promote `latest` as the release
   pin.

The candidate job is advisory rather than a release gate. It intentionally
does not modify the pinned `quest-database` job, so a new CLI can be evaluated
early and promoted in a separate reviewed change.

If the scheduled candidate check fails, the workflow creates or updates one
open GitHub issue titled **[CI Alert] Supabase CLI candidate compatibility
failure**. The issue is owned by the Quest database and release maintainers,
links to the failed workflow run, and links back to this promotion guide.
Repeated failures update that same issue instead of creating a new issue for
each weekly run. Investigate the latest run, keep the pinned release CLI
unchanged, and close the issue only after a candidate passes the disposable
database and Quest contract checks (or the candidate has been intentionally
replaced).

The grouping behavior is covered by
`__tests__/questDatabaseAlert.test.ts`, which simulates a first failure and a
repeated failure. It verifies that the second failure updates the original open
issue, preserves one alert, and refreshes both the failed-run and promotion
guide links.

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
