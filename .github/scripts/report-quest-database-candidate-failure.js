const COMPATIBILITY_ALERT_TITLE =
  "[CI Alert] Supabase CLI candidate compatibility failure";

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
    const { data: existing } = await github.rest.search.issuesAndPullRequests({
      q: searchQuery,
      per_page: searchPageSize,
      page,
    });
    matchingIssues.push(...existing.items);

    if (existing.items.length < searchPageSize) break;
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
    await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: alert.number,
      body,
    });

    const supersededIssueNumbers = [];
    for (const duplicate of alerts.slice(1)) {
      await github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: duplicate.number,
        state: "closed",
        state_reason: "not planned",
      });
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
  reportQuestDatabaseCandidateFailure,
};