# Triage Policy

Shared triage policy and workflow rules for [`/triage-issues`](../triage-issues/SKILL.md) (starts from Linear) and [`/triage-telemetry`](../triage-telemetry/SKILL.md) (starts from ClickStack).

Telemetry schemas and query recipes live in [`mixpanel.md`](mixpanel.md) (active-user baselines) and [`clickstack.md`](clickstack.md) (ClickHouse schema and landscape queries). GitHub report rules and recipes live in [`github.md`](github.md).

---

## Priority Policy

An issue's priority determines where its fix ships. Priority is derived from two inputs:

1. **Severity** — what happens to a user who hits the bug.
2. **Daily rate** — the share of the affected audience hitting it per day.

| Priority     | Where the fix ships  |
| ------------ | -------------------- |
| Urgent       | Stable hotfix + beta |
| High         | Beta                 |
| Medium / Low | `master` (next beta) |

### Priority Matrix

| Severity           | Daily rate ≥ 0.5% | 0.1% – 0.5% | < 0.1% or unknown |
| ------------------ | ----------------- | ----------- | ----------------- |
| S1 Corrupted State | Urgent            | High        | High              |
| S2 Blocked         | High              | High        | Medium            |
| S3 Degraded        | High              | Medium      | Low               |
| S4 Cosmetic        | Low               | Low         | Low               |
| S5 Internal        | Low               | Low         | Low               |

**Overrides** (raise priority above the matrix):

- **Majority of users affected** → **Urgent** at any severity.
- **Bug in a feature introduced in the current beta** → at least **High**.

Within each priority level, order issues by **severity** first, then by **80/20 reach** (`R1 Widespread` before `R2 Isolated`). For every **Urgent** or **High** candidate, explicitly state why it lands there (either its severity + rate column in the matrix, or the override that applies).

---

## Severity Tiers

Severity measures what the bug does to a user who hits it, independent of how many users are affected. Each tier corresponds to a label in the `Vortex Triage Severity` group in Linear (apply one per issue).

### S1 Corrupted State

Vortex writes wrong state to disk or loses state without the user asking.

- **Test:** After a restart, is persisted state different from what the user configured? This covers load order, enabled plugins, installed mods and files, collection install state (ignored/optional flags), profiles, and settings.
- **Not S1:** Wrong state held only in memory that clears on restart, or a file briefly written wrong and corrected before anything reads it.
- **Examples:**
    - `LAZ-1458` — empty `plugins.txt` disables all plugins and rewrites the load order.
    - `LAZ-1261` — failed downloads are saved as ignored.
    - `LAZ-1260` — mod is marked as installed while its files are missing.
    - `LAZ-960` — addon overwrites another collection's mod.

### S2 Blocked

A core workflow cannot be completed, and there is no workaround a normal user would reasonably find.

- **Test:** Is the user stuck? For example, they cannot launch the game, install or update mods/collections, deploy, sort plugins, or open a main page.
- **Not S2:** Anything bypassed by a restart, retry, or obvious alternative (those are **S3**).
- **Examples:**
    - `LAZ-1435` — LOOT never starts on that machine.
    - `LAZ-1460` — Mods page fails to render.
    - `LAZ-1338` — Cyberpunk won't launch through Vortex.

### S3 Degraded

The workflow completes, but poorly: it requires a retry or restart, runs slowly, or shows a wrong or misleading message.

- **Test:** Does the user lose time or trust, yet still finish the task?
- **Includes:** Misleading warnings or errors that push users into wrong actions (e.g. hunting for "missing masters" that aren't actually missing).
- **Examples:**
    - `LAZ-1459` — false missing-masters warnings.
    - `LAZ-1461` — confusing LOOT error when a game folder was deleted.
    - `LAZ-1462` — slow plugin details after deployment.
    - `LAZ-1464` — disk-full errors presented as reportable Vortex bugs.
    - `LAZ-1169` — collection downloads that require a restart to continue.

### S4 Cosmetic

Purely visual or wording polish; workflows and behaviour are unaffected.

- **Test:** Does the user notice it without losing time, trust, or functionality?
- **Includes:** Wrong icons, layout or styling glitches, typos, and minor wording mismatches.
- **Examples:** `LAZ-1414` (wrong icon).

### S5 Internal

Invisible to the user; affects only telemetry, logging, or internal diagnostics.

- **Test:** Would a user notice any difference if this were fixed? (No.)
- **Includes:** Telemetry noise (errors reported to ClickStack that never surface in the UI), benign shutdown races, and missing or noisy log lines.
- **Examples:**
    - `LAZ-1465` — LOOT worker killed at Windows logoff is reported to telemetry, while the user sees nothing.
    - `LAZ-1257` — missing log lines.

### Severity Edge Cases

- **Worst observed outcome wins:** A bug that is usually S3 but occasionally corrupts state is **S1**.
- **Judge the outcome, not the trigger:** Running out of disk space is environmental, but if Vortex responds by corrupting state, it is **S1**. If Vortex leaves state intact and shows a crash/bug report dialog instead of a clear explanation, it is **S3**.
- **Unconfirmed S1 stays S1:** Mark it as _unconfirmed_ in both the proposal and the triage comment, explain what would confirm or rule it out, and revisit once known.
- **User confirmation required for S1:** Because S1 is a judgement call, always list all S1 candidates for the user to confirm.

---

## Open to Community Contributions

Propose the **`Open to Community Contributions`** label on a **Medium** or **Low** issue (typically Low; never Urgent or High) when **all three** conditions hold:

1. It is not an immediate priority for Nexus Mods.
2. The fix lives entirely in the public Vortex repository (no backend/API changes, CI/signing secrets, or telemetry access required).
3. An external contributor can reproduce the issue from the description alone.

List which issues qualify for this label in the triage proposal.

---

## Sizing Reach and Daily Rate

### Daily Rate (Matrix Column)

Daily rate determines which column of the priority matrix applies. **Event volume is not reach**—a flood of 10,000 error reports from 13 installs is still just 13 users.

- **Formula:**
  $$\text{Daily Rate} = \frac{\text{Affected installs on the busiest full day since release}}{\text{Affected audience DAU on that same day}}$$
  Always use the peak single-day rate rather than a cumulative total, which grows over time and cannot be compared across releases.
- **Affected audience:**
    - By default, use the version's DAU ([`mixpanel.md`](mixpanel.md)).
    - For a game-specific bug, use **that game's DAU on that version** (`app_game_launched` filtered by `app_version` and broken down by `game_id`; see [`mixpanel.md`](mixpanel.md#query-variations)). For example, `LAZ-1338` hits ~2.6% of 2.9.0 Cyberpunk players vs. ~0.1% of all 2.9.0 users—use **2.6%**.
- **Outcome filtering:** Count only installs that experienced the severity tier's actual outcome. For S1, exclude ambiguous cases (such as vanilla setups with only base-game plugins) and note how many were excluded.
- **Accounting for telemetry opt-in (~50% of users):**
    - **Mixpanel and `error.report`** are both opt-in only, so the opt-in rate cancels out in `error.report installs ÷ Mixpanel DAU`. To estimate real-world user headcount from `error.report` install counts, multiply by 2 (e.g. 720 installs ≈ 1,400 users).
    - **`crash.report`** is sent regardless of consent (full payload with consent; a strict no-PII allow-list without). Neither mode carries an install ID, and it covers 100% of users, so divide crash sessions by `Mixpanel DAU × 2`.
- **Worked example (`LAZ-1458`, S1):** 383 affected installs on 2026-10-20 ÷ 547,140 DAU on 2.9.0 = **0.07%** → lands in the `< 0.1%` column → **High** (not Urgent).
- **No telemetry available:** Use the `< 0.1% or unknown` column and state that explicitly.

### The 80/20 Rule (Ordering Within a Tier)

A handful of causes drive most user pain. The 80/20 cut is an **ordering signal within a priority and severity tier** (`R1 Widespread` before `R2 Isolated`). It never alters the matrix priority or how thoroughly an issue is investigated.

The unit of measurement is a single **cause** (`error.title` + normalised message), never a broad error title or subsystem area. Broad titles like _"Failed to install dependency"_ bundle network drops, full disks, and genuine bugs together; grouping by title is fine for initial navigation, but not for ranking.

1. **Find the release threshold:** Run the [cause landscape query](clickstack.md#cause-landscape-with-8020-cut-used-for-priority-ordering) across the _entire version_ (separately for stable and beta—never scoped to just the batch being triaged). Find the fewest causes that together account for ~80% of summed cause-installs. The **threshold** is the install count of the smallest cause in that top 80% (e.g. on 2.9.0 day one: 31 of 329 causes covered 80%, with a threshold of 665 installs).
2. **Score each issue:** Count distinct installs across _only_ the specific causes that issue covers. Causes combine into one score only when the code investigation shows they share a root cause, so that one fix removes all of them (e.g. LOOT init failure and worker start failure). Otherwise score each cause on its own and give the issue the largest. Never borrow reach from unrelated causes under the same broad error title.
3. **Assign a reach label** from the `Vortex Triage Reach` group against the stable cut (or the beta cut for a beta-only bug):

| Label           | Meaning                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `R1 Widespread` | Combined installs across the issue's causes meet or exceed the 80/20 threshold.  |
| `R2 Isolated`   | Combined installs across the issue's causes fall below the 80/20 threshold.      |
| `R3 Unknown`    | No telemetry signal—distinguishes "unmeasured" from "measured and small" (`R2`). |

In your triage summary, always report: _"N of M causes cover 80% of affected installs on `<version>` (threshold: T installs)"_, and list which issues are `R1 Widespread`.

### Reporting Reach

Report every issue's reach using two measures against two baselines, and distinguish new bugs from inherited ones:

- **Measures:**
    - **Realistic:** `affected installs ÷ Mixpanel users` over the same time window.
    - **Upper bound:** `affected installs ÷ ClickHouse installs` on that version.
- **Baselines:**
    - **Version-specific:** Cumulative users since release, plus version DAU.
    - **Overall:** DAU / WAU / MAU across all versions.
- **Inherited vs. new:**
    - **Inherited:** Also present on the previous stable release; its rate already applies across the userbase.
    - **New in this version:** Grows as adoption increases; report both today's share of overall WAU and the projected share at full adoption.

---

## Shared Workflow Steps

### Release State

Inspect git tags and release branches to establish which versions are in play:

```bash
git tag --sort=-v:refname | head -20
git branch -a --list '*release/*'
git log --oneline --no-merges <stable-tag>..<beta-tag>   # features introduced in beta
```

- **Stable:** newest non-prerelease tag.
- **Beta:** newest `-beta.N` tag.
- **Master:** `master`.

Ask the user if any version is ambiguous. Note which features were introduced in the current beta so bugs in them get the **High** priority override.

### Parallel Code Investigation

Group items requiring code investigation by subsystem area (e.g. plugins/LOOT/load order, collections, extensions, downloads/persistence/UI) and launch one `general-purpose` subagent per group **in parallel, in the background** (maximum 4 agents), using the skill's `reference.md` prompt. Subagents are strictly **read-only**—they must never edit files, commit, or modify Linear issues.

### Presenting and Recording a Triage

#### 1. Proposal Structure

Nothing in Linear changes until the user approves. Present the proposal in this order:

1. **Executive summary:**
    - Whether anything clears the **stable hotfix** bar (`Urgent`).
    - All **S1 candidates** for the user to confirm.
    - The 80/20 headline: _"N of M causes cover 80% of affected installs on `<version>` (threshold: T installs)"_ and which items are `R1 Widespread`.
    - Any notable new regressions in the release.
2. **Baseline table:** Version-specific and overall active-user baselines from Mixpanel.
3. **Prioritised items table:** Ordered by proposed priority, then severity, with `R1 Widespread` before `R2 Isolated` within each tier. Columns:
    - Severity tier (`S1`–`S5`)
    - Daily rate & matrix column
    - Reach on both baselines (split into inherited vs. new)
    - Reach label (`R1`–`R3`)
    - Verdict or Linear match (`tracked` ID, `regressed`, or `untracked`)
    - `Current → Proposed` priority and reasoning
    - `Open to Community Contributions` (where applicable)
    - GitHub reports (issue numbers)
4. **Skill-specific sections:**
    - `/triage-issues`: Close / duplicate / relabel list and cross-cutting notes.
    - `/triage-telemetry`: 1-line summary per environmental, community-extension, and noise item, followed by full draft issues for untracked/regressed bugs. List the GitHub reports skipped as unusable by number only.
5. **Draft triage comments:** Show the full two-paragraph draft comment for every **Urgent** issue, **High** issue, **S1 candidate**, and any issue `/triage-telemetry` proposes to create or change. Remaining lower-priority issues follow the same pattern without being drafted one by one in the proposal.

#### 2. Recording in Linear After Approval

Once the user approves, update every open `Bug` issue in Linear with both labels and a comment:

1. **Labels** (via `save_issue` with `addLabels`, plus `removeLabels` to swap an outdated severity or reach label on re-triage):
    - **One `Vortex Triage Severity` label:** `S1 Corrupted State`, `S2 Blocked`, `S3 Degraded`, `S4 Cosmetic`, or `S5 Internal`. This label is what marks an issue as triaged.
    - **One `Vortex Triage Reach` label:** `R1 Widespread`, `R2 Isolated`, or `R3 Unknown`.
    - **`Open to Community Contributions`** when eligible.
    - _Exception:_ Issues closed (fixed, duplicate, stale) or relabelled away from `Bug` get a comment explaining why, **without** a severity label.
2. **GitHub reports:** Append the URLs of matched GitHub reports to the issue's description, with the reproduction steps or log context they add. GitHub itself stays untouched.
3. **Triage comment:** Two short paragraphs in plain prose for teammates—no raw SQL output, timestamps, or install-ID hashes. Technical details, stack traces, and SQL queries belong in the issue's **description**, never in the comment. Post even if severity and priority didn't change; on re-triage, add a new comment rather than editing the old one.
    - **Paragraph 1 — Severity:** Tier; what happens to the user; why it isn't the tier above when non-obvious (e.g. S3 vs. S1: _"nothing is written to disk; a restart clears it"_); what would confirm or rule out an unconfirmed S1; and on re-triage, the previous tier and what changed.
    - **Paragraph 2 — Priority:** Priority and where the fix ships; reach in user terms (approximate users on which version + daily rate against the affected audience, or _"no telemetry for this"_); whether it's new in this version or inherited; whether it sits in the 80/20 head; any override applied; and what would change the call.

> **Example Triage Comment**
>
> **Severity: S2 Blocked.** On the machines it hits, LOOT never starts, so the load order can't be sorted at all in any session. Restarting Vortex doesn't help, which is why it isn't S3. It doesn't alter the load order or any files on disk, so it isn't S1.
>
> **Priority: High**, so the fix goes into the 2.10 beta. On 2.9.0 about 7,000 installs hit it (around 0.9% of 2.9.0 users). It's new in 2.9, and it's one of the 30 problems that together account for 80% of the 2.9.0 users hitting errors. A blocked workflow becomes a stable hotfix at 0.5% of daily users; it peaks below that. If the beta diagnostics show it's broader, we'll revisit.
