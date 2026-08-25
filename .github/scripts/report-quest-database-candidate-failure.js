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

  const { data: existing } = await github.rest.search.issuesAndPullRequests({
    q: `repo:${context.repo.owner}/${context.repo.repo} is:issue is:open in:title "${COMPATIBILITY_ALERT_TITLE}"`,
    per_page: 10,
  });
  const alert = existing.items.find(
    (issue) => issue.title === COMPATIBILITY_ALERT_TITLE,
  );

  if (alert) {
    await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: alert.number,
      body,
    });
    core.info(`Updated compatibility alert #${alert.number}.`);
    return { action: "updated", issueNumber: alert.number, body };
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