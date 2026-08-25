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
          update: jest.fn(async (params) => {
            const { issue_number, body } = params;
            const issue = issues.find((candidate) => candidate.number === issue_number);
            if (body !== undefined) issue.body = body;
            if (params.state !== undefined) issue.state = params.state;
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

  it("updates the newest open issue and closes legacy duplicates", async () => {
    const issues = [
      {
        number: 41,
        title: COMPATIBILITY_ALERT_TITLE,
        body: "older alert",
        state: "open",
        created_at: "2026-08-20T07:00:00Z",
      },
      {
        number: 52,
        title: COMPATIBILITY_ALERT_TITLE,
        body: "newer alert",
        state: "open",
        created_at: "2026-08-24T07:00:00Z",
      },
    ];
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => ({
            data: { items: issues.filter((issue) => issue.state === "open") },
          })),
        },
        issues: {
          create: jest.fn(),
          update: jest.fn(async (params) => {
            const issue = issues.find(
              (candidate) => candidate.number === params.issue_number,
            );
            if (params.body !== undefined) issue.body = params.body;
            if (params.state !== undefined) issue.state = params.state;
            return { data: issue };
          }),
        },
      },
    };
    const core = { info: jest.fn() };
    const context = {
      serverUrl: "https://github.com",
      repo: { owner: "questworld", repo: "matterrealm" },
      runId: "1003",
    };

    const result = await reportQuestDatabaseCandidateFailure({
      github,
      context,
      core,
      candidate: "2.118.0",
    });

    expect(result.action).toBe("updated");
    expect(result.issueNumber).toBe(52);
    expect(result.supersededIssueNumbers).toEqual([41]);
    expect(github.rest.issues.create).not.toHaveBeenCalled();
    expect(github.rest.issues.update).toHaveBeenCalledTimes(2);
    expect(github.rest.issues.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        issue_number: 41,
        state: "closed",
        state_reason: "not planned",
      }),
    );
    expect(issues.find((issue) => issue.number === 52).body).toContain(
      "`2.118.0`",
    );
    expect(issues.filter((issue) => issue.state === "open")).toHaveLength(1);
  });

  it("searches every page before consolidating duplicates", async () => {
    const issues = [
      {
        number: 41,
        title: COMPATIBILITY_ALERT_TITLE,
        body: "older alert",
        state: "open",
        created_at: "2026-08-20T07:00:00Z",
      },
      ...Array.from({ length: 99 }, (_, index) => ({
        number: 100 + index,
        title: "Unrelated issue",
        body: "not a compatibility alert",
        state: "open",
      })),
      {
        number: 200,
        title: COMPATIBILITY_ALERT_TITLE,
        body: "newer alert",
        state: "open",
        created_at: "2026-08-24T07:00:00Z",
      },
    ];
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async ({ page }) => ({
            data: {
              items: issues
                .filter((issue) => issue.state === "open")
                .slice((page - 1) * 100, page * 100),
            },
          })),
        },
        issues: {
          create: jest.fn(),
          update: jest.fn(async (params) => {
            const issue = issues.find(
              (candidate) => candidate.number === params.issue_number,
            );
            if (params.body !== undefined) issue.body = params.body;
            if (params.state !== undefined) issue.state = params.state;
            return { data: issue };
          }),
        },
      },
    };
    const core = { info: jest.fn() };
    const context = {
      serverUrl: "https://github.com",
      repo: { owner: "questworld", repo: "matterrealm" },
      runId: "1004",
    };

    const result = await reportQuestDatabaseCandidateFailure({
      github,
      context,
      core,
      candidate: "2.119.0",
    });

    expect(result.action).toBe("updated");
    expect(result.issueNumber).toBe(200);
    expect(result.supersededIssueNumbers).toEqual([41]);
    expect(github.rest.search.issuesAndPullRequests).toHaveBeenCalledTimes(2);
    expect(github.rest.search.issuesAndPullRequests).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, per_page: 100 }),
    );
    expect(github.rest.search.issuesAndPullRequests).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, per_page: 100 }),
    );
    expect(github.rest.issues.create).not.toHaveBeenCalled();
    expect(github.rest.issues.update).toHaveBeenCalledTimes(2);
    expect(issues.find((issue) => issue.number === 41).state).toBe("closed");
    expect(issues.find((issue) => issue.number === 200).state).toBe("open");
  });
});
