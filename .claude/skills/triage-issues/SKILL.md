---
name: triage-issues
description: Triage open Vortex bug issues in Linear (both community CMTY reports and internal issues). Checks each issue against the codebase and git history, pulls extra context from matching GitHub reports, sizes its reach from ClickHouse telemetry and Mixpanel baselines, and proposes priorities under the shared Vortex triage policy. Read-only until the user approves.
when_to_use: When the user asks to triage Linear bugs or issues for Vortex, re-prioritise a bug backlog, decide what goes into a stable hotfix or the next beta, or check whether a set of issues is still valid, fixed, or duplicated. Not for discovering untracked problems in telemetry — use /triage-telemetry for that.
user-invocable: true
---

# `/triage-issues`

Triage existing Vortex bug issues in Linear, using telemetry to size each issue's reach.

Read these shared references before running:

- [`../_shared/triage.md`](../_shared/triage.md) — priority matrix, severity tiers (`S1`–`S5`), reach labels (`R1`–`R3`), daily rate math, shared workflow steps, and Linear recording format.
- [`../_shared/mixpanel.md`](../_shared/mixpanel.md) — active-user baseline queries.
- [`../_shared/clickstack.md`](../_shared/clickstack.md) — ClickHouse schema and landscape queries.
- [`../_shared/github.md`](../_shared/github.md) — which GitHub reports are usable, and search recipes.

## Arguments (`$ARGUMENTS`)

- **Empty:** Triages all open, untriaged Vortex bug issues.
- **Label names:** Filters to issues carrying those labels.
- **Issue IDs (e.g. `LAZ-123 CMTY-4`):** Skips Step 1's bulk listing and triages the named issues directly—even if they already carry a severity label (the same applies when the user asks to "re-triage").

---

## Workflow

### 1. Collect Untriaged Issues

Call Linear's `list_issues` with:

- `label: "Vortex"`
- `limit: 250`
- `fields: ["id", "title", "priority", "status", "statusType", "labels", "assignee", "project", "createdAt"]`

Follow `cursor` while `hasNextPage` is true. Keep issues that meet **all** of the following criteria:

- Carry the `Bug` label.
- Have a `statusType` other than `completed`, `canceled`, or `duplicate`.
- Do **not** yet carry a `Vortex Triage Severity` label (`S1`–`S5`). The retired `Vortex Triage Performed` label does not count as triaged.

Report how many issues were skipped as already triaged.

> [!TIP]
> Paginated responses usually exceed the tool output limit and are saved to a local file. Parse that file with a `node -e` one-liner rather than reading the raw file into context.

### 2. Determine Release State

Resolve `stable`, `beta`, `master`, and new beta features per [Release State in `triage.md`](../_shared/triage.md#release-state).

### 3. Check Code, Git History, and GitHub

Follow [Parallel Code Investigation in `triage.md`](../_shared/triage.md#parallel-code-investigation) using the prompt in [`reference.md`](reference.md#agent-prompt). Each subagent also searches GitHub for other users hitting the same bug and pulls in the context they add (versions, games, reproduction steps, logs, workarounds), using only [usable reports](../_shared/github.md#usable-reports). While the background subagents run, proceed to Step 4.

### 4. Measure Reach and Daily Rate

Follow [Sizing Reach and Daily Rate in `triage.md`](../_shared/triage.md#sizing-reach-and-daily-rate):

1. Fetch active-user baselines ([`mixpanel.md`](../_shared/mixpanel.md)) and run the [cause landscape query](../_shared/clickstack.md#cause-landscape-with-8020-cut-used-for-priority-ordering) for stable (and beta) to establish the 80/20 threshold.
2. Map each issue to the specific telemetry causes it covers (matching on the error title, message, or stack trace from the issue description and code check) to score its installs, assign `R1`–`R3`, and calculate its peak daily rate.
3. Flag any widespread causes in telemetry that no existing Linear issue covers—those are candidates for `/triage-telemetry`.

### 5. Decide Triage Outcomes

For each issue, combine the code check, GitHub context, and telemetry to determine:

- **Verdict:** `valid`, `fixed-in`, `duplicate-of`, `needs-info`, `stale-close`, `relabel`, or `not-a-bug`.
- **Severity tier (`S1`–`S5`)**, **reach label (`R1`–`R3`)**, **daily rate**, **priority (`current → proposed`)**, and **`Open to Community Contributions` eligibility** per the [shared policy](../_shared/triage.md#priority-policy).
- **Recommended action.** A `needs-info` issue whose missing details a GitHub report supplies is no longer `needs-info`.

### 6. Present Proposal, Then Apply on Approval

Follow [Presenting and Recording a Triage in `triage.md`](../_shared/triage.md#presenting-and-recording-a-triage), including the close / duplicate / relabel list. Wait for explicit user approval before modifying anything in Linear.
