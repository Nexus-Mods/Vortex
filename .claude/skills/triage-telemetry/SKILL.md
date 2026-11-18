---
name: triage-telemetry
description: Triage Vortex error and crash telemetry in ClickStack (ClickHouse) for a release. Ranks error causes against Mixpanel active-user baselines, classifies items (Vortex bug, environmental, extension-specific, or dev-build / isolated loop), matches bugs to Linear issues, pulls user context from GitHub reports, sweeps GitHub for bugs not yet in Linear, investigates untracked bugs in the codebase, and proposes new issues or priority updates under the shared Vortex triage policy. Read-only until the user approves.
when_to_use: When the user asks to triage telemetry, errors, or crashes for a Vortex release (e.g. release day, a beta, "what's new in 2.x", "anything bad since the release"), or to find problems not yet tracked in Linear. Not for re-prioritising existing Linear issues — use /triage-issues for that.
user-invocable: true
---

# `/triage-telemetry`

Triage what Vortex users are hitting in the wild, starting from ClickStack telemetry.

Read these references before running:

1. [`../_shared/triage.md`](../_shared/triage.md) — priority matrix, severity tiers (`S1`–`S5`), player impact (`P1`–`P3`) and content reach (`C1`–`C3`), shared workflow steps, and Linear recording format.
2. [`../_shared/clickstack.md`](../_shared/clickstack.md) — telemetry rules and the ClickHouse recipes to fetch.
3. [`../_shared/mixpanel.md`](../_shared/mixpanel.md) — active-user baselines, collection installers, and trigger counts.
4. [`../_shared/nao.md`](../_shared/nao.md) — warehouse queries for content reach.
5. [`../_shared/collection-manifest.md`](../_shared/collection-manifest.md) — inspecting what a collection defines (mod rules, optional mods).
6. [`../_shared/github.md`](../_shared/github.md) — usable GitHub report rules and search recipes.
7. [`reference.md`](reference.md) — error-group drill-down queries, native crash queries, Linear matching tips, and the subagent prompt.

The queries behind `clickstack.md`, `mixpanel.md` and `nao.md` are kept in a private repository; [fetch them](../_shared/triage.md#private-recipes) before running any query.

## Arguments (`$ARGUMENTS`)

- **Empty:** Triages the current stable and current beta releases since their release dates.
- **Version(s):** One or more explicit versions (e.g. `2.9.0 2.10.0-beta.1`).
- **Time window:** A custom lookback window (e.g. `last 7 days`).

---

## Workflow

Before starting, check the [prerequisites in `triage.md`](../_shared/triage.md#prerequisites) (in particular, confirm the `nao` connector is available).

### 1. Establish Scope

Resolve `stable`, `previous stable`, `beta`, and new beta features per [Release State in `triage.md`](../_shared/triage.md#release-state). Use the earliest telemetry row for each version as a proxy for its release timestamp. The default window per version is since its release (capped at the last 7 days for older releases).

### 2. Gather Active-User Baselines

Fetch overall DAU/WAU/MAU and per-version unique users + DAU using the [Mixpanel recipes](../_shared/mixpanel.md).

> [!NOTE]
> Beta releases have a small, self-selected audience. Always report beta error shares against the beta's own user baseline—do not compare raw beta install counts directly against stable.

### 3. Survey the Landscape

For each version in scope, run:

1. **Cause landscape** ([`clickstack.md`](../_shared/clickstack.md#cause-landscape)) — ranks distinct causes by affected installs.
2. **Title landscape** ([`clickstack.md`](../_shared/clickstack.md#title-landscape-coarserfor-navigation-only-never-for-priority)) — selects which error groups to drill into:
    - Investigate every title in the **top 90% of cumulative affected installs** (`cum_pct <= 90`, or affecting ≥ 0.05% of the version's DAU).
    - Investigate **any title that looks like `S1 Corrupted State`**, regardless of install share.
    - Titles in the remaining long tail only need their summary counts listed.
3. **Native crashes** ([`reference.md`](reference.md#native-crashes)).

### 4. Break Down and Classify Each Error Group

For every group above the investigation floor ([queries in `reference.md`](reference.md#breaking-down-an-error-group)), examine:

- **Underlying causes:** Split the title by exception message and phase/kind attributes so unrelated causes under one broad title become separate items.
- **Shape:** Compare events per install and sessions per install. High event volume on a few installs is a retry loop on a handful of machines (a real problem for those users, but low reach); firing in every session (`hit = total`) is a deterministic per-install failure.
- **Context:** Top affected games, whether `error.isCommunityExtension` is true, and which [collections or mods the cause touches](../_shared/clickstack.md#collections-and-mods-a-cause-touches).
- **New vs. inherited:** Compare session rate against the previous stable release (verifying whether the error had a different title before calling it new). For beta-only items, check whether it affects a feature introduced in the beta.

Classify each distinct cause into one of four buckets:

1. **Vortex bug** — a defect in Vortex itself.
2. **Environmental** — disk full, network drop, antivirus interference, or a deleted path. _However_, if Vortex presents an environmental condition to users as a reportable bug dialog instead of a clear explanation, that misclassification is itself a **Vortex bug** (`S3 Degraded`).
3. **Extension-specific (`error.isCommunityExtension`)** — determine whether the failure is caused by a core Vortex change or API regression, a bug in a game extension we maintain, or an issue in a third-party extension that should be fixed upstream or guarded against in Vortex.
4. **Dev builds & isolated retry loops** — errors emitted from local development builds, or high event volume caused by a retry loop on a handful of installs (note the loop so the affected install count isn't inflated by event volume; if the underlying error is a reproducible Vortex bug, still score it on its distinct install count).

### 5. Match Vortex Bugs to Linear and GitHub

Follow [Matching to Linear in `reference.md`](reference.md#matching-to-linear) to classify each Vortex bug as:

- **Tracked:** Matches an open issue. If it already carries a `Vortex Triage Severity` label, only propose changes when its tier, player impact or content reach score, daily rate, or new-vs-inherited picture differs materially from its last triage comment.
- **Regressed:** Matches a `Done` issue or a resolved fingerprint from an older build, but still fires on a version that should contain the fix.
- **Untracked:** No matching Linear issue exists.

Then [search GitHub](../_shared/github.md#search-by-error-text-or-symptom) for each Vortex bug's error title and message. Usable reports add what telemetry cannot show: what the user was doing, reproduction steps, and surrounding log context. Pass them to the code investigation.

### 6. Sweep GitHub for Untracked Bugs

[List GitHub issues](../_shared/github.md#list-reports-in-a-window) updated within the triage window, skipping any already matched in Step 5. For each [usable](../_shared/github.md#usable-reports) Vortex bug report:

1. [Check whether Linear already tracks it](../_shared/github.md#check-whether-linear-already-tracks-it). If it does, attach the report as context to that issue's item.
2. Otherwise, look for a telemetry cause it explains (error text from its logs, game, version). If one matches, size it from that cause; if none does, score it `P3 Limited/Unknown` (_unmeasured — needs manual review_).
3. Add it as an **untracked** item. Reports whose usability rests on you tracing them to code go to Step 7.

### 7. Investigate Code for Untracked or Unexplained Bugs

For all Vortex-bug items that are **untracked**, **regressed**, or **tracked without a known root cause**, follow [Parallel Code Investigation in `triage.md`](../_shared/triage.md#parallel-code-investigation) using the prompt in [`reference.md`](reference.md#agent-prompt). Drop any GitHub-sourced item that has neither logs nor reproduction steps and that the subagent could not trace to code.

### 8. Decide Priorities and Draft Issues

Score each Vortex bug's severity tier (`S1`–`S5`), player impact (`P1`–`P3`) from its daily rate, content reach (`C1`–`C3`) from the [content or mod share](../_shared/nao.md) of any content its cause names, and proposed priority per the [shared policy](../_shared/triage.md#priority-policy).

For **untracked** and **regressed** items, draft a new Linear issue:

- **Title:** Plain, user-centred description of what goes wrong.
- **Description:** Root cause, code pointers (`file:line`), affected users across both baselines, the exact ClickHouse query used, and the URLs of the GitHub reports it covers.
- **Metadata:** Status `Backlog` (`state: "Backlog"`), proposed tier, player impact and content reach scores, priority, and labels `Vortex` + `Bug` (plus `Open to Community Contributions` when eligible). Ask the user which Linear team to use if it isn't obvious.

### 9. Present Proposal, Then Apply on Approval

Follow [Presenting and Recording a Triage in `triage.md`](../_shared/triage.md#presenting-and-recording-a-triage). Wait for explicit user approval before creating or updating any issues in Linear.
