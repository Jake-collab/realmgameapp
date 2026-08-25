const fs = require("node:fs");
const path = require("node:path");

const {
  COMPATIBILITY_ALERT_TITLE,
  reportQuestDatabaseCandidateFailure,
} = require("../../../.github/scripts/report-quest-database-candidate-failure.js");

const workflowSource = fs.readFileSync(
  path.resolve(__dirname, "../../../.github/workflows/quest-database.yml"),
  "utf8",
);
const workflowDirectory = path.resolve(__dirname, "../../../.github/workflows");
const repositoryDirectory = path.resolve(workflowDirectory, "../..");
const reporterSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../.github/scripts/report-quest-database-candidate-failure.js",
  ),
  "utf8",
);

function getReportingJobSource() {
  const match = workflowSource.match(
    /^  report-quest-database-candidate-failure:[\s\S]*$/m,
  );
  if (!match) {
    throw new Error(
      "Compatibility alert contract is missing: restore the report-quest-database-candidate-failure job in .github/workflows/quest-database.yml.",
    );
  }
  return match[0];
}

function assertCompatibilityContract(condition, message) {
  if (!condition) {
    throw new Error(`Compatibility alert contract failed: ${message}`);
  }
}

function getWorkflowJobs(source, fileName) {
  const jobsSection = source.match(/^jobs:\s*\n([\s\S]*)$/m)?.[1] ?? "";
  const jobs = [];
  const jobMatches = [
    ...jobsSection.matchAll(/^  ([A-Za-z0-9_-]+):\s*\n/gm),
  ];

  for (const [index, match] of jobMatches.entries()) {
    const start = match.index;
    const end = jobMatches[index + 1]?.index ?? jobsSection.length;
    jobs.push({
      fileName,
      name: match[1],
      source: jobsSection.slice(start, end),
    });
  }

  return jobs;
}

function isFailureReporter(job) {
  return (
    /failure|report/i.test(job.name) ||
    /GITHUB_STEP_SUMMARY|core\.summary|actions\/github-script|\.github\/scripts\/.*(?:failure|report)/i.test(
      job.source,
    )
  );
}

function reportsIssues(job) {
  return (
    /issues:\s+write|gh\s+issue|issues\.(?:create|update)/i.test(job.source) ||
    (/\.github\/scripts\/.*(?:failure|report)/i.test(job.source) &&
      reporterSource.includes("github.rest.issues."))
  );
}

function reportsSummary(job) {
  return /GITHUB_STEP_SUMMARY|core\.summary|summary/i.test(job.source);
}

function getReusableWorkflowCalls(job) {
  return [
    ...job.source.matchAll(
      /^\s+uses:\s+(\.\/(?:[^\s#]+\.ya?ml))\s*(?:#.*)?$/gim,
    ),
  ].map((match) => match[1]);
}

function getReusableReportingJobs(
  workflowFiles,
  {
    readWorkflow = (filePath) => fs.readFileSync(filePath, "utf8"),
    workflowExists = (filePath) => fs.existsSync(filePath),
  } = {},
) {
  const reportingJobs = [];
  const visited = new Set();

  function visit(fileName, source) {
    const filePath = path.resolve(repositoryDirectory, fileName);
    if (visited.has(filePath)) return;
    visited.add(filePath);

    for (const callerJob of getWorkflowJobs(source, fileName)) {
      for (const reference of getReusableWorkflowCalls(callerJob)) {
        const referencedPath = path.resolve(repositoryDirectory, reference);
        if (
          !referencedPath.startsWith(`${repositoryDirectory}${path.sep}`) ||
          !workflowExists(referencedPath)
        ) {
          continue;
        }

        const referencedFileName = path.relative(
          repositoryDirectory,
          referencedPath,
        );
        const referencedSource = readWorkflow(referencedPath);
        for (const reusableJob of getWorkflowJobs(
          referencedSource,
          referencedFileName,
        )) {
          if (isFailureReporter(reusableJob)) {
            reportingJobs.push({
              ...reusableJob,
              callerFileName: fileName,
              callerJobName: callerJob.name,
              callerSource: callerJob.source,
            });
          }
        }
        if (!visited.has(referencedPath)) {
          visit(referencedFileName, referencedSource);
        }
      }
    }
  }

  for (const workflow of workflowFiles) {
    visit(workflow.fileName, workflow.source);
  }
  return reportingJobs;
}

describe("Supabase CLI candidate compatibility alert", () => {
  it("discovers issue reporters nested in local reusable workflows", () => {
    const reusableWorkflowPath = path.resolve(
      repositoryDirectory,
      ".github/workflows/reusable-report.yml",
    );
    const reusableSource = `on:
  workflow_call:
jobs:
  report-failure:
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create();
            await core.summary.write();
`;
    const callerSource = `jobs:
  call-report:
    uses: ./.github/workflows/reusable-report.yml
    permissions:
      contents: read
      issues: write
`;
    const reportingJobs = getReusableReportingJobs(
      [{ fileName: ".github/workflows/caller.yml", source: callerSource }],
      {
        workflowExists: (filePath) => filePath === reusableWorkflowPath,
        readWorkflow: (filePath) => {
          if (filePath === reusableWorkflowPath) return reusableSource;
          throw new Error(`Unexpected workflow read: ${filePath}`);
        },
      },
    );

    expect(reportingJobs).toHaveLength(1);
    expect(reportingJobs[0]).toMatchObject({
      fileName: ".github/workflows/reusable-report.yml",
      name: "report-failure",
      callerFileName: ".github/workflows/caller.yml",
      callerJobName: "call-report",
    });
    expect(reportsIssues(reportingJobs[0])).toBe(true);
    expect(reportsSummary(reportingJobs[0])).toBe(true);
    expect(
      /\n    permissions:\n(?:      [^\n]+\n)*      issues: write\n/.test(
        reportingJobs[0].callerSource,
      ),
    ).toBe(true);
  });

  it("guards every workflow failure reporter against permission and summary drift", () => {
    const workflowFiles = fs
      .readdirSync(workflowDirectory)
      .filter((fileName) => /\.(?:yml|yaml)$/.test(fileName));
    const jobs = workflowFiles.flatMap((fileName) =>
      getWorkflowJobs(
        fs.readFileSync(path.join(workflowDirectory, fileName), "utf8"),
        fileName,
      ),
    );
    const reportingJobs = jobs.filter(
      (job) =>
        isFailureReporter(job) && (reportsIssues(job) || reportsSummary(job)),
    );
    const reusableReportingJobs = getReusableReportingJobs(
      workflowFiles.map((fileName) => ({
        fileName,
        source: fs.readFileSync(path.join(workflowDirectory, fileName), "utf8"),
      })),
    );

    assertCompatibilityContract(
      reportingJobs.length > 0 || reusableReportingJobs.length > 0,
      "no failure-reporting jobs were discovered; keep this check aligned with new issue or summary reporters.",
    );

    for (const job of [...reportingJobs, ...reusableReportingJobs]) {
      if (reportsIssues(job)) {
        assertCompatibilityContract(
          /\n    permissions:\n(?:      [^\n]+\n)*      issues: write\n/.test(job.source),
          `${job.fileName}:${job.name} reports GitHub issues and must grant issues: write in its job permissions.`,
        );
      }

      if (reportsSummary(job)) {
        assertCompatibilityContract(
          /core\.summary[\s\S]*\.write\(\)|GITHUB_STEP_SUMMARY/.test(
            job.source,
          ),
          `${job.fileName}:${job.name} mentions a failure summary but does not publish it with core.summary.write() or GITHUB_STEP_SUMMARY.`,
        );
      }
    }

    for (const job of reusableReportingJobs) {
      if (reportsIssues(job)) {
        assertCompatibilityContract(
          /\n    permissions:\n(?:      [^\n]+\n)*      issues: write\n/.test(
            job.callerSource,
          ),
          `${job.callerFileName}:${job.callerJobName} calls ${job.fileName} and must pass issues: write to the reusable failure reporter.`,
        );
      }
    }
  });

  it("keeps issue updates and job-summary recovery permissions wired to the reporter", () => {
    const reportingJob = getReportingJobSource();

    assertCompatibilityContract(
      /\n    permissions:\n      contents: read\n      issues: write\n/.test(
        reportingJob,
      ),
      "the reporting job must grant issues: write (keep contents: read alongside it) so it can create, update, and close compatibility alerts.",
    );
    assertCompatibilityContract(
      reportingJob.includes("await core.summary") &&
        reportingJob.includes(".write();"),
      "the reporting job must publish its GitHub Actions summary with core.summary.write() when alert reporting fails.",
    );
    assertCompatibilityContract(
      reportingJob.includes(
        "require(`${process.env.GITHUB_WORKSPACE}/.github/scripts/report-quest-database-candidate-failure.js`)",
      ) &&
        reportingJob.includes("reportQuestDatabaseCandidateFailure({") &&
        reportingJob.includes("github,") &&
        reportingJob.includes("context,") &&
        reportingJob.includes("core,"),
      "the reporting job must load and invoke reportQuestDatabaseCandidateFailure with github, context, and core.",
    );
    assertCompatibilityContract(
      reporterSource.includes(
        "module.exports = {\n  COMPATIBILITY_ALERT_TITLE,\n  MAX_TRANSIENT_RETRIES,\n  reportQuestDatabaseCandidateFailure,",
      ) && typeof reportQuestDatabaseCandidateFailure === "function",
      "the reporter script must export reportQuestDatabaseCandidateFailure for the workflow wiring.",
    );
  });

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

  it("fails visibly instead of consolidating when GitHub caps the search results", async () => {
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => ({
            data: {
              incomplete_results: false,
              total_count: 1_001,
              items: Array.from({ length: 100 }, (_, index) => ({
                number: index + 1,
                title: COMPATIBILITY_ALERT_TITLE,
                state: "open",
              })),
            },
          })),
        },
        issues: {
          create: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    const core = { error: jest.fn(), info: jest.fn() };

    await expect(
      reportQuestDatabaseCandidateFailure({
        github,
        context: {
          serverUrl: "https://github.com",
          repo: { owner: "questworld", repo: "matterrealm" },
          runId: "1005",
        },
        core,
        candidate: "2.120.0",
      }),
    ).rejects.toThrow(
      "GitHub reports 1001 matching results, beyond its 1000-result search limit",
    );

    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot safely consolidate compatibility alerts"),
    );
    expect(github.rest.issues.create).not.toHaveBeenCalled();
    expect(github.rest.issues.update).not.toHaveBeenCalled();
  });

  it("retries a transient search outage, then fails with a bounded rerun instruction", async () => {
    const outage = Object.assign(new Error("GitHub is temporarily unavailable"), {
      status: 503,
    });
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => {
            throw outage;
          }),
        },
        issues: { create: jest.fn(), update: jest.fn() },
      },
    };
    const core = { error: jest.fn(), warning: jest.fn(), info: jest.fn() };

    await expect(
      reportQuestDatabaseCandidateFailure({
        github,
        context: {
          serverUrl: "https://github.com",
          repo: { owner: "questworld", repo: "matterrealm" },
          runId: "1006",
        },
        core,
        candidate: "2.121.0",
      }),
    ).rejects.toThrow(
      "GitHub issue search failed after 3 attempt(s): GitHub is temporarily unavailable. Rerun this workflow",
    );

    expect(github.rest.search.issuesAndPullRequests).toHaveBeenCalledTimes(3);
    expect(core.warning).toHaveBeenCalledTimes(2);
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining("Rerun this workflow"),
    );
    expect(github.rest.issues.create).not.toHaveBeenCalled();
  });

  it("retries a transient mutation without creating a second alert", async () => {
    const issue = {
      number: 61,
      title: COMPATIBILITY_ALERT_TITLE,
      state: "open",
      created_at: "2026-08-25T07:00:00Z",
    };
    let updateAttempts = 0;
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => ({
            data: { items: [issue] },
          })),
        },
        issues: {
          create: jest.fn(),
          update: jest.fn(async () => {
            updateAttempts += 1;
            if (updateAttempts === 1) {
              throw Object.assign(new Error("GitHub timed out"), { status: 504 });
            }
            return { data: issue };
          }),
        },
      },
    };
    const core = { error: jest.fn(), warning: jest.fn(), info: jest.fn() };

    const result = await reportQuestDatabaseCandidateFailure({
      github,
      context: {
        serverUrl: "https://github.com",
        repo: { owner: "questworld", repo: "matterrealm" },
        runId: "1007",
      },
      core,
      candidate: "2.122.0",
    });

    expect(result.action).toBe("updated");
    expect(github.rest.issues.update).toHaveBeenCalledTimes(2);
    expect(github.rest.issues.create).not.toHaveBeenCalled();
    expect(core.warning).toHaveBeenCalledTimes(1);
  });

  it("does not retry issue creation after an ambiguous GitHub response", async () => {
    const github = {
      rest: {
        search: {
          issuesAndPullRequests: jest.fn(async () => ({ data: { items: [] } })),
        },
        issues: {
          create: jest.fn(async () => {
            throw Object.assign(new Error("GitHub connection reset"), { status: 502 });
          }),
          update: jest.fn(),
        },
      },
    };
    const core = { error: jest.fn(), warning: jest.fn(), info: jest.fn() };

    await expect(
      reportQuestDatabaseCandidateFailure({
        github,
        context: {
          serverUrl: "https://github.com",
          repo: { owner: "questworld", repo: "matterrealm" },
          runId: "1008",
        },
        core,
        candidate: "2.123.0",
      }),
    ).rejects.toThrow();

    expect(github.rest.issues.create).toHaveBeenCalledTimes(1);
    expect(core.warning).not.toHaveBeenCalled();
  });
});
