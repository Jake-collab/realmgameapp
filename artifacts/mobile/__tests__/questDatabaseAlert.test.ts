const {
  COMPATIBILITY_ALERT_TITLE,
  reportQuestDatabaseCandidateFailure,
} = require("../../../.github/scripts/report-quest-database-candidate-failure.js");

describe("Supabase CLI candidate compatibility alert", () => {
  it("creates once, then updates the same open issue with the latest failure links", async () => {
    const issues = [];
    let nextIssueNumber = 41;
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => ({
            data: {
              items: issues.filter(
                (issue) => issue.title === COMPATIBILITY_ALERT_TITLE && issue.state === "open",
              ),
            },
          })),
        },
        issues: {
          create: jest.fn(async ({ title, body }) => {
            const issue = { number: nextIssueNumber++, title, body, state: "open" };
            issues.push(issue);
            return { data: issue };
          }),
          update: jest.fn(async ({ issue_number, body }) => {
            const issue = issues.find((candidate) => candidate.number === issue_number);
            issue.body = body;
            return { data: issue };
          }),
        },
      },
    };
    const core = { info: jest.fn() };
    const context = {
      serverUrl: "https://github.com",
      repo: { owner: "questworld", repo: "matterrealm" },
      runId: "1002",
    };

    const first = await reportQuestDatabaseCandidateFailure({
      github,
      context: { ...context, runId: "1001" },
      core,
      candidate: "2.116.0",
    });
    const repeated = await reportQuestDatabaseCandidateFailure({
      github,
      context,
      core,
      candidate: "2.117.0",
    });

    expect(first.action).toBe("created");
    expect(repeated.action).toBe("updated");
    expect(github.rest.issues.create).toHaveBeenCalledTimes(1);
    expect(github.rest.issues.update).toHaveBeenCalledTimes(1);
    expect(issues).toHaveLength(1);
    expect(repeated.issueNumber).toBe(first.issueNumber);
    expect(issues[0].body).toContain(
      "https://github.com/questworld/matterrealm/actions/runs/1002",
    );
    expect(issues[0].body).toContain(
      "https://github.com/questworld/matterrealm/blob/main/artifacts/mobile/docs/QUEST_LIVE_TESTING.md#updating-the-supabase-cli-pin",
    );
    expect(issues[0].body).toContain("`2.117.0`");
    expect(issues[0].body).not.toContain("actions/runs/1001");
  });
});