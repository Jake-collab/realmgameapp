const COMPATIBILITY_ALERT_TITLE =
  "[CI Alert] Supabase CLI candidate compatibility failure";
const GITHUB_SEARCH_RESULT_LIMIT = 1_000;
const MAX_TRANSIENT_RETRIES = 2;

function isTransientGitHubError(error) {
  const status = error?.status ?? error?.response?.status;
  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    status === undefined
  );
}

async function callWithTransientRetries(operation, description, core) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientGitHubError(error) || attempt >= MAX_TRANSIENT_RETRIES) {
        const detail = error instanceof Error ? error.message : String(error);
        const message =
          `GitHub ${description} failed after ${attempt + 1} attempt(s): ${detail}. ` +
          "Rerun this workflow after the GitHub API recovers.";
        core.error(message);
        throw new Error(message, { cause: error });
      }
      core.warning(
        `GitHub ${description} failed transiently; retrying ` +
          `(${attempt + 1}/${MAX_TRANSIENT_RETRIES}).`,
      );
    }
  }
}

async function reportQuestDatabaseCandidateFailure({
  github,
  context,
  core,
  candidate,
}) {
  const repoUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;
  const runUrl = `${repoUrl}/actions/runs/${context.runId}`;
  const promotionGuide = `${repoUrl}/blob/main/artifacts/mobile/docs/QUEST_LIVE_TESTING.md#updating-the-supabase-cli-pin`;
  const body = [
    "## Supabase CLI candidate compatibility failure",
    "",
    "**Owner:** Quest database and release maintainers",
    `**Candidate:** \`${candidate}\``,
    `**Failed run:** [Open the failed workflow run](${runUrl})`,
    `**Promotion process:** [Review the CLI promotion guide](${promotionGuide})`,
    "",
    "The scheduled candidate check found that this CLI candidate cannot apply the checked-in migrations or pass the Quest contract suite. Keep the pinned release CLI unchanged until the candidate is investigated and the promotion process is completed.",
    "",
    `Last updated by workflow run ${context.runId}.`,
  ].join("\n");

  const searchQuery = `repo:${context.repo.owner}/${context.repo.repo} is:issue is:open in:title "${COMPATIBILITY_ALERT_TITLE}"`;
  const searchPageSize = 100;
  const matchingIssues = [];
  let page = 1;

  while (true) {
    const { data: existing } = await callWithTransientRetries(
      () =>
        github.rest.search.issuesAndPullRequests({
          q: searchQuery,
          per_page: searchPageSize,
          page,
        }),
      "issue search",
      core,
    );

    const totalCount =
      typeof existing.total_count === "number" ? existing.total_count : null;
    if (
      existing.incomplete_results === true ||
      totalCount > GITHUB_SEARCH_RESULT_LIMIT
    ) {
      const reason =
        existing.incomplete_results === true
          ? "GitHub marked the search results as incomplete."
          : `GitHub reports ${totalCount} matching results, beyond its ${GITHUB_SEARCH_RESULT_LIMIT}-result search limit.`;
      const message = `Cannot safely consolidate compatibility alerts: ${reason}`;
      core.error(message);
      throw new Error(message);
    }

    matchingIssues.push(...existing.items);

    if (existing.items.length < searchPageSize) {
      if (totalCount !== null && matchingIssues.length < totalCount) {
        const message = `Cannot safely consolidate compatibility alerts: GitHub returned ${matchingIssues.length} of ${totalCount} matching search results.`;
        core.error(message);
        throw new Error(message);
      }
      break;
    }
    page += 1;
  }

  const alerts = matchingIssues
    .filter(
      (issue) =>
        issue.title === COMPATIBILITY_ALERT_TITLE && !issue.pull_request,
    )
    .sort((left, right) => {
      const leftCreated = left.created_at ? Date.parse(left.created_at) : 0;
      const rightCreated = right.created_at ? Date.parse(right.created_at) : 0;

      return rightCreated - leftCreated || right.number - left.number;
    });
  const alert = alerts[0];

  if (alert) {
    await callWithTransientRetries(
      () =>
        github.rest.issues.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: alert.number,
          body,
        }),
      `update of compatibility alert #${alert.number}`,
      core,
    );

    const supersededIssueNumbers = [];
    for (const duplicate of alerts.slice(1)) {
      await callWithTransientRetries(
        () =>
          github.rest.issues.update({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: duplicate.number,
            state: "closed",
            state_reason: "not planned",
          }),
        `closure of duplicate compatibility alert #${duplicate.number}`,
        core,
      );
      supersededIssueNumbers.push(duplicate.number);
      core.info(
        `Closed duplicate compatibility alert #${duplicate.number}; canonical alert is #${alert.number}.`,
      );
    }

    core.info(
      `Updated compatibility alert #${alert.number}${
        supersededIssueNumbers.length
          ? ` and closed ${supersededIssueNumbers.length} duplicate(s)`
          : ""
      }.`,
    );
    return {
      action: "updated",
      issueNumber: alert.number,
      body,
      supersededIssueNumbers,
    };
  }

  const { data: created } = await github.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: COMPATIBILITY_ALERT_TITLE,
    body,
  });
  core.info(`Created compatibility alert #${created.number}.`);
  return { action: "created", issueNumber: created.number, body };
}

module.exports = {
  COMPATIBILITY_ALERT_TITLE,
  MAX_TRANSIENT_RETRIES,
  reportQuestDatabaseCandidateFailure,
};
