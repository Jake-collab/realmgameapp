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
every checked-in migration, runs the Quest and Social RPC/RLS suites, and
deletes its Docker volumes after the test. No Supabase project, database
credentials, or CI secrets are required.

The release gate is pinned to **Supabase CLI `2.116.0`**. The local harness uses
the same version by default and refuses to run with a different installed CLI,
so a local pass exercises the same CLI contract as CI. The release gate never
uses `latest`.

The harness captures structured local credentials directly from
`supabase start`, with the CLI's aggregate health check disabled, and then
waits for the real Auth health endpoint. This is intentional: constrained
Docker runtimes can reject container-exec health probes even after PostgreSQL
is accepting connections. Failed startup, malformed or missing local
credentials, or an Auth endpoint that does not become healthy still fails the
run.

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

To run the same isolated Quest and Social check locally (requires Docker and
the Supabase CLI):

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
- Rejected private media is unreadable through Storage to anonymous and
  ordinary authenticated clients across every canonical bucket, while the
  trusted retention worker can still remove the object and preserve evidence.

Do not point these variables at a production database. The service-role key is
only used to create and clean up disposable fixtures.

## Release gate

`.github/workflows/quest-database.yml` runs on Quest-related pull requests and
on every `main` push. The protected `main` branch is the release branch and
must require this exact status check before enabling automatic releases:

- Workflow: `Quest database contracts`
- Required job/check: `Quest RPC and RLS contracts`
- Workflow job id: `quest-database`

Configure the repository's `main` branch protection rule or ruleset to require
the `Quest RPC and RLS contracts` check. Do not select the advisory
`Candidate Supabase CLI compatibility` or
`Report candidate Supabase CLI incompatibility` jobs instead; those jobs do
not run on pull requests and are not release gates.

The repository release-readiness command queries both classic branch
protection and the effective rules for `main`. Run it from a maintainer session
before publishing:

```bash
gh auth status
pnpm release-readiness
```

The authenticated GitHub identity needs repository **Administration: read**
access because GitHub does not expose classic branch protection to a workflow's
built-in `GITHUB_TOKEN`. Authenticate with `gh`, or provide a short-lived
fine-grained `GH_TOKEN` through the release environment's secret manager. Never
store that token in this repository. The check treats an unprotected branch, a
renamed check, an advisory candidate, or an API authorization failure as a
release blocker. Its failure message lists the exact check to restore and the
protection configuration that needs review.

### Verifying the required check

After adding or changing the Social RPC race coverage, open a pull request
targeting protected `main` and wait for the `Quest database contracts`
workflow to finish. Confirm the `quest-database` job log contains:

```text
Running Social RPC contracts, including repeated opposite-direction races, against the disposable database.
```

Then confirm the pull request shows the successful
`Quest RPC and RLS contracts` check as required by the `main` branch rule. A
migration, RPC, reward-idempotency, cross-owner, proof-immutability,
objective-integrity, or social race failure must produce a failed required
check and block the merge or release.
