# Triage Policy

Shared triage policy and workflow rules for [`/triage-issues`](../triage-issues/SKILL.md) (starts from Linear) and [`/triage-telemetry`](../triage-telemetry/SKILL.md) (starts from ClickStack).

Companion references:

- [`mixpanel.md`](mixpanel.md) — active-user baselines, collection installers, and trigger counts
- [`clickstack.md`](clickstack.md) — telemetry rules and the ClickHouse recipes to fetch
- [`nao.md`](nao.md) — warehouse queries for content reach
- [`collection-manifest.md`](collection-manifest.md) — inspecting what a collection defines (mod rules, optional mods)
- [`github.md`](github.md) — usable GitHub report rules and search recipes

---

## Priority Policy

An issue's priority determines where its fix ships. Priority is derived from two independent inputs:

1. **Severity (`S1`–`S5`)** — how badly the bug affects a user who hits it.
2. **Impact** — how much of the platform is affected, using whichever of two scores is higher:
    - **Player impact (`P1`–`P3`)** — the share of all users on the version hitting the bug per day ([daily rate](#daily-rate-player-impact)).
    - **Content reach (`C1`–`C3`)** — the share of collection downloads or mod usage carried by the creators whose content the bug breaks ([content share](#content-share-content-reach)).

| Priority     | Where the fix ships  |
| ------------ | -------------------- |
| Urgent       | Stable hotfix + beta |
| High         | Beta                 |
| Medium / Low | `master` (next beta) |

### Priority Matrix

Use the column of the issue's **higher** impact score. For example, an `S3` bug scored `P3` and `C1` uses the `P1` or `C1` column → **High**; one scored `P2` and `C3` uses the `P2` or `C2` column → **Medium**.

| Severity ↓ / Impact → | `P1` or `C1` | `P2` or `C2` | `P3` and `C3` |
| --------------------- | ------------ | ------------ | ------------- |
| S1 Corrupted State    | Urgent       | High         | High          |
| S2 Blocked            | High         | High         | Medium        |
| S3 Degraded           | High         | Medium       | Low           |
| S4 Cosmetic           | Low          | Low          | Low           |
| S5 Internal           | Low          | Low          | Low           |

**Overrides** (raise priority above the matrix):

- **Majority of all users on the version affected** → **Urgent** at any severity. This override measures the whole platform; a bug that affects most of one game's players is scored through its severity and the [single-game route](#single-game-rate-rules) instead.
- **Bug in a feature introduced in the current beta** → at least **High**.

**Ordering and justification:**

- Within each priority level, order issues by **severity** first, then by **affected users** (most first), then by **content reach** (`C1 Wide` before `C2 Moderate`).
- For every **Urgent** or **High** candidate, explicitly state why it lands there: its severity and the score (player impact or content reach) that selected its column, or the override that applies.

---

## Severity Tiers

Severity measures what the bug does to a user who hits it, regardless of how many users are affected. Each tier corresponds to a label in the `Vortex Triage Severity` group in Linear (apply one per issue).

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

A core workflow cannot be completed, and there is no workaround a typical user would reasonably find.

- **Test:** Is the user stuck? For example, they cannot launch the game, install or update mods/collections, deploy, sort plugins, or open a main page.
- **Not S2:** A failure cleared by a single retry, app restart, or obvious alternative so the workflow can finish normally (those are **S3**). If a user has to restart repeatedly throughout a single workflow (e.g. every few downloads in a collection), treat it as **S2 Blocked**.
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
    - `LAZ-1169` — a stalled download queue that resumes normally after a single app restart.

### S4 Cosmetic

Purely visual or wording polish; workflows and behaviour are unaffected.

- **Test:** Does the user notice it without losing time, trust, or functionality?
- **Includes:** Wrong icons, layout or styling glitches, typos, and minor wording mismatches.
- **Examples:** `LAZ-1414` — wrong icon.

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

---

## Sizing Impact

Impact measures how much of the platform is affected, independent of severity. Every issue gets one label from each of the two Linear impact groups:

- **Player impact (`Vortex Triage Player Impact`):** `P1 Wide`, `P2 Moderate`, or `P3 Limited/Unknown`.
- **Content reach (`Vortex Triage Content Reach`):** `C1 Wide`, `C2 Moderate`, or `C3 Limited/General`.

Both scores are measured across the whole platform first. Each also has a route to **Tier 2 (`P2` / `C2`)** when a bug heavily affects a single sizeable game—neither single-game route can grant Tier 1 (`P1` / `C1`), which stays a measure of platform-wide weight.

### Daily Rate (Player Impact)

Daily rate sets an issue's player impact score (`P1`–`P3`). **Event volume is not users**—a flood of 10,000 error reports from 13 installs is still just 13 users.

$$\text{Daily Rate} = \frac{\text{Affected installs on the busiest full day since release}}{\text{Version DAU on that same day}}$$

Always use the **peak single-day rate** rather than a cumulative total (which grows over time and cannot be compared across releases), and always use the **version's overall DAU** ([`mixpanel.md`](mixpanel.md)) as the denominator.

**Worked example** (illustrative numbers): 400 affected installs on the busiest day ÷ 500,000 version DAU on that day = **0.08%** → `P3 Limited/Unknown`. For an `S1` bug that is not tied to specific content (`C3`), the matrix gives **High**, not Urgent.

| Tier                     | Platform-wide daily rate | Single-game route (caps at `P2`)                                                                                                                                     | Caps & special cases                                                                                                                                                                                              | Examples                                                                                                                                                                     |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`P1 Wide`**            | ≥ 0.5% of version DAU    | _None_ — single-game bugs cannot reach `P1` on their in-game rate alone                                                                                              | Requires confirmed harm (not just trigger exposure). Count distinct installs, never event floods. A bug limited to a lower-concurrency game (< 0.25% of version DAU) cannot reach `P1`.                           | A launch failure in a major game that stops ≥ 0.5% of all users on the version each day.                                                                                     |
| **`P2 Moderate`**        | 0.1% – 0.5%              | ≥ 2.5% of the game's (or game family's) DAU, **and** that game is **≥ 0.25% of version DAU** (or **≥ 0.75% of reporting Vortex users** in `nao`)                     | Any bug sized only by **trigger exposure** (even if ≥ 0.5%) is capped at `P2` until harm is proven.                                                                                                               | `LAZ-1338` (Cyberpunk launch failure: clears `P2` on both its platform-wide rate and its in-game rate). `CMTY-359` (pausing a collection install: held at `P2` as exposure). |
| **`P3 Limited/Unknown`** | < 0.1% (or unmeasured)   | In-game rate below 2.5%, or the game is below the single-game floor (< 0.25% of version DAU and < 0.75% of reporting users); neither changes the platform-wide score | Unmeasured bugs score `P3`—always state whether a `P3` bug is _measured (< 0.1%)_ or _unmeasured_ (and flag telemetry-silent GitHub reports for manual review). Content reach can still select the matrix column. | `LAZ-1458` (empty `plugins.txt` disables plugins: < 0.1% daily rate → `P3`, and `S1` + `P3` → **High**).                                                                     |

#### Single-game rate rules

- **How to measure a game's size and DAU:** Query `app_game_launched` filtered by `app_version` and broken down by `game_id` ([`mixpanel.md`](mixpanel.md#query-variations)) on the same peak day as the affected installs. Because players of many games (e.g. _The Witcher 3_, _Palworld_, _Dragon's Dogma 2_, _RDR2_, _Valheim_) manage mods in Vortex but launch the game directly through Steam rather than clicking Launch in Vortex, a game also clears the single-game floor if it carries **≥ 0.75% of reporting Vortex users** in the warehouse ([`nao.md`](nao.md#game-share-of-reporting-vortex-users)). For a bug affecting a family of games (e.g. the Bethesda games LOOT serves), use their combined DAU.
- **Why the cut-offs are 2.5% and 0.25% DAU (or 0.75% reporting users):** Top-heavy traffic means only ~9 games exceed 1% of `app_launched` DAU, while lowering the game floor to 0.25% of version DAU (or 0.75% of reporting Vortex users) covers the top ~25 actively modded games and still scales proportionally across both beta and stable releases.
- **Lower-concurrency games:** A game below the single-game floor (< 0.25% of version DAU and < 0.75% of reporting users) scores on its platform-wide rate (capped at `P2 Moderate`). Its severity is unaffected: a game that cannot be launched or modded is still `S2 Blocked`, which is at least **Medium**. Always report both the platform-wide rate and the in-game rate so the reviewer has the full picture.
- **Collection installers are not a "game":** Collection installers are a large enough share of daily users that a bug affecting 2.5% of them already clears the platform-wide `P2` bar.

#### Bugs that raise no error (sizing by trigger)

A bug that completes "successfully" never reaches `error.report`. Size it by its trigger in Mixpanel instead:

1. Find the Mixpanel event property that records the triggering condition (e.g. `collections_installation_completed` with `pause_count ≥ 1` for a bug triggered by pausing a collection install) and divide those users by the version's DAU. The [single-game route](#single-game-rate-rules) applies to a trigger count too.
2. When the bug only affects collections with a specific makeup (e.g. mod rules or optional mods), [inspect their manifests](collection-manifest.md#narrowing-a-trigger-count) to exclude users in collections the bug cannot harm.
3. **Exposure is not harm:** A trigger count is an upper bound, so it caps at **`P2 Moderate`**. Mark it as _exposure only_, explain what would narrow it, and state what would confirm harm to allow `P1`.

#### Counting and consent adjustments

- **Count causes, not titles:** The unit is a single **cause** (`error.title` + normalised message, from the [cause landscape query](clickstack.md#cause-landscape)), never a broad error title or subsystem area. Broad titles like _"Failed to install dependency"_ bundle network drops, full disks, and genuine bugs together; grouping by title is fine for initial navigation, but never for scoring.
- **Count only the causes an issue covers:** Count distinct installs across _only_ the specific causes that issue covers. Combine multiple causes only when code investigation confirms they share a root cause that a single fix resolves (e.g. LOOT init failure and worker start failure). Otherwise, count each cause separately and use the largest.
- **Outcome filtering:** Count only installs that experienced the severity tier's actual outcome. For `S1`, exclude ambiguous cases (such as vanilla setups with only base-game plugins) and note how many were excluded.
- **`error.report` vs. Mixpanel (~50% opt-in):** Both require telemetry consent, so the opt-in rate cancels out in `error.report installs ÷ Mixpanel DAU`. To estimate real-world user headcount from `error.report` install counts, multiply by 2.
- **`crash.report` (anonymous session count, no install ID):** Native crash pings carry no install ID and cover the full install base (when diagnostic opt-in is off, only an anonymous no-PII crash code is sent; full crash context requires opt-in). Because Mixpanel only counts opted-in installs, divide crash sessions by `Mixpanel DAU × 2`.

---

### Content Share (Content Reach)

Content share sets an issue's content reach score (`C1`–`C3`). A curator or mod author stands in for every player who installs their content. A bug that blocks a curator barely registers in the daily error rate, and their report arrives as a single voice—content share measures how many players stand behind it.

- **When it applies:** Only when a bug is tied to **specific content** (particular collections or mods, their rules, optional mods, or FOMODs) or to a **creator workflow** (creating, editing, or publishing a collection revision).
- **When it does not apply:** Any bug that is not tied to specific content or a creator workflow—including a general collection bug that happens to be reported against one collection—is **`C3 Limited/General`**. Size it by its player impact instead.

$$\text{Content Share (Collections)} = \frac{\text{30-day downloads of all live collections by the affected curators}}{\text{30-day downloads of all live collections}}$$

$$\text{Mod Share (Mods)} = \frac{\text{Users with any affected mod enabled (30d)}}{\text{All reporting Vortex users (30d)}}$$

Both figures come from the warehouse ([`nao.md`](nao.md)). Always use a **rolling 30-day window** rather than all-time totals, so the score reflects collections and mods that players are actively installing right now. Because collection downloads are heavily concentrated in the top two games (~70% of all platform downloads), collection cut-offs are calibrated to the real curator distribution, while mod cut-offs are higher because foundational framework mods reach far more users than any single curator.

| Tier                     | Collections (content share)                                                                 | Mods (mod share) | Single-game dominance route (caps at `C2`)                                                                                                                                                                               | Caps & confirmation rules                                                                                                                           | Examples                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`C1 Wide`**            | ≥ 2%                                                                                        | ≥ 20%            | _None_ — single-game dominance cannot reach `C1`                                                                                                                                                                         | At least one affected curator or mod must be **telemetry-linked** or **reproduced**.                                                                | A bug that blocks a curator carrying ≥ 2% of collection downloads from publishing a revision.                                                                                                               |
| **`C2 Moderate`**        | 0.25% – 2% (or creator-workflow bug blocking a tiered curator, `Tier 1`–`Tier 4`, in `nao`) | 10% – 20%        | **Collections:** ≥ 20% of the game's collection downloads, and the game is ≥ 0.25% of all collection downloads.<br>**Mods:** ≥ 25% of the game's reporting users, and the game is ≥ 0.75% of all reporting Vortex users. | Any share (even ≥ 2% / ≥ 20%) that is **reported (pending link)** is held at `C2` and marked _provisional_ until linked in telemetry or reproduced. | A collection's rules fail to apply for a curator carrying 0.25%–2% of collection downloads (`S3` + `C2` → **Medium**).                                                                                      |
| **`C3 Limited/General`** | < 0.25% (or none)                                                                           | < 10% (or none)  | Below the single-game dominance floor                                                                                                                                                                                    | Includes all bugs that affect collections or mods generically rather than specific content. Most bugs are `C3`.                                     | A bug specific to an optional add-on collection with < 0.25% share (`C3` + `P3` → **Low**; if it also affects or blocks users of its parent collection, score it on the parent collection's share instead). |

#### Counting and confirmation rules

- **Deduplicate by creator:** When aggregating content share across multiple reports or channels, deduplicate by creator so each creator's 30-day download share is summed once.
- **How a curator or mod is linked:**
    1. **Telemetry-linked:** Telemetry links their collection or mod to the affected cause, and code investigation confirms the bug is triggered by that content's setup ([query](clickstack.md#collections-and-mods-a-cause-touches)). Merely appearing on an error raised while a collection was installing is not enough.
    2. **Reproduced:** The bug reproduces locally against their collection or mod.
    3. **Reported (pending link):** Forwarded by the community team or reported by the creator, but not yet linked to a specific telemetry signature or reproduced locally. While pending a telemetry link or reproduction, content reach is held at **`C2 Moderate`** (marked _provisional_, noting what would confirm it).
- **Curator share vs. single-collection share (parent vs. add-on collections):**
    - Many curators publish modular add-on collections alongside a main collection. The warehouse query ([`nao.md`](nao.md#content-share-of-named-collections)) returns both the **individual collection's share** (`collection_share_pct` / `collection_share_of_game_pct`) and the **curator's combined share** across all their live collections (`curator_share_pct` / `curator_share_of_game_pct`), and the [manifest script](collection-manifest.md) reports `externalModRules` (> 0 when a collection has rules targeting mods from a parent collection outside its own manifest).
    - Use **`curator_share_pct`** when the bug blocks a **creator workflow** (creating, editing, or publishing a revision) or affects the curator's main collection(s).
    - Use **`collection_share_pct`** when a bug is isolated to a **single optional add-on collection** without breaking the parent collection experience. Ask the community team before scoring if the scope is unclear.
- **Extra context for mod bugs:** When scoring by mod share ([query](nao.md#a-mods-share-and-dependents)), also report how many other mods require the affected mod and how many live collections include it.

---

### Cross-Cutting Impact Rules

- **The higher score wins:** A bug at `P3` (< 0.1% daily rate) that blocks content scored `C1` (≥ 2% content share) uses the `P1` or `C1` column. Always state which score selected the column.
- **Issues can share the same users:** When two issues share a trigger or root cause, score each on the full affected-user count individually, note the overlap on both, and never add their counts together in summary totals.
- **Impact and severity are independent:** Impact never lowers severity, and severity never raises impact. A cosmetic bug seen by everyone is still `S4`; a state-corruption bug on one machine is still `P3`.

---

### Reporting Affected Users

Report every issue's affected users using two measures against two baselines, and distinguish new bugs from inherited ones:

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

## Open to Community Contributions

Propose the **`Open to Community Contributions`** label on a **Medium** or **Low** issue (typically Low; never Urgent or High) when **all three** conditions hold:

1. It is scheduled for a future release rather than an immediate hotfix or current-beta blocker.
2. The fix lives entirely in the public Vortex repository (no backend/API changes, CI/signing secrets, or telemetry access required).
3. An external contributor can reproduce the issue from the description alone.

List which issues qualify for this label in the triage proposal.

---

## Shared Workflow Steps

### Prerequisites

Check that these tools and connectors are available before starting. If any is missing, tell the user rather than working around it:

| Needed for                                     | Requires                                                       |
| ---------------------------------------------- | -------------------------------------------------------------- |
| Reading and recording issues                   | Linear MCP connector                                           |
| Error telemetry and the cause landscape        | ClickHouse MCP connector                                       |
| Active-user baselines and trigger counts       | Mixpanel MCP connector                                         |
| Content reach                                  | `nao` MCP connector (`mcp__nao__execute_sql`)                  |
| GitHub reports                                 | `gh` CLI (signed in)                                           |
| [Query recipes](#private-recipes)              | `gh` CLI with read access to `Nexus-Mods/data`                 |
| [Collection manifests](collection-manifest.md) | `NEXUS_API_KEY` in the environment, and dependencies installed |

**Checking for `nao`:** Because `nao` is a personal connector, it is not in the repo's `.mcp.json`. Check for `mcp__nao__execute_sql` first. If it is missing, stop and ask the user to add it with their own URL and token, then start a new session:

```bash
claude mcp add --scope local --transport http nao <nao-url> --header "Authorization: Bearer <token>"
```

Never ask the user to paste their token into the conversation. Proceed without `nao` only if the user tells you to.

#### Private recipes

This repository is public, so it holds the triage policy and workflow only. The schemas and queries behind [`clickstack.md`](clickstack.md), [`mixpanel.md`](mixpanel.md) and [`nao.md`](nao.md) live in the private `Nexus-Mods/data` repository under `docs/vortex-triage/`, in files of the same names. Fetch each one before running its queries:

```bash
gh api repos/Nexus-Mods/data/contents/docs/vortex-triage/<file>.md -H "Accept: application/vnd.github.raw"
```

- A section named in this repository has a section of the same name in the private file.
- If the fetch fails, the user has no access to that repository: stop and tell them. Never rebuild a query from memory of an earlier run.
- Never copy a recipe, or the table and column names in it, into this repository, a GitHub issue or pull request, or anything else public. Queries recorded on a Linear issue are fine.

When any data source is unavailable and the user chooses to proceed, score what it would have measured as unknown (`P3 Limited/Unknown`, or `C3 Limited/General` marked _unmeasured_) and note that in the proposal. Never estimate a score from memory of an earlier run.

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

Ask the user if any version is ambiguous. Note which features were introduced in the current beta so bugs in them receive the **High** priority override.

### Parallel Code Investigation

Group items requiring code investigation by subsystem area (e.g. plugins/LOOT/load order, collections, extensions, downloads/persistence/UI) and launch one `general-purpose` subagent per group **in parallel, in the background** (maximum 4 agents), using the skill's `reference.md` prompt. Subagents are strictly **read-only**—they must never edit files, commit, or modify Linear issues.

### Presenting and Recording a Triage

#### 1. Proposal Structure

Nothing in Linear changes until the user approves. Present the proposal in this order:

1. **Executive summary:**
    - Whether anything clears the **stable hotfix** bar (`Urgent`).
    - All **S1 candidates** for the user to confirm.
    - Any cause that scores `P2 Moderate` or above and has no Linear issue, plus any telemetry-silent GitHub report needing manual impact review.
    - Any notable new regressions in the release.
2. **Baseline table:** Version-specific and overall active-user baselines from Mixpanel.
3. **Prioritised items table:** Ordered by proposed priority, then severity, then affected users (most first), then `C1 Wide` before `C2 Moderate`. Keep the table to these six columns so it stays readable:
    - Issue and a few words on what goes wrong
    - Severity tier (`S1`–`S5`)
    - Player impact (`P1`–`P3`), noting _"exposure only"_ or _"unmeasured"_ where applicable
    - Content reach (`C1`–`C3`), noting _"provisional"_ where applicable
    - `Current → Proposed` priority
    - Verdict or Linear match (`tracked` ID, `regressed`, or `untracked`)

    Put the supporting evidence in a compact list directly beneath the table (one entry per issue, or per group of issues sharing the same cause):
    - **Player impact evidence:** daily rate, in-game rate (for game-specific bugs), or trigger count
    - **Content reach evidence:** content/mod share, curators or mods counted, and whether each is telemetry-linked, reproduced, or reported (pending link)
    - **Matrix driver:** which of the two impact scores (or override) selected the priority column
    - **Scale:** affected users on both baselines (inherited vs. new)
    - **Community & GitHub:** `Open to Community Contributions` eligibility and matching GitHub issue numbers

4. **Skill-specific sections:**
    - `/triage-issues`: Close / duplicate / relabel list and cross-cutting notes.
    - `/triage-telemetry`: 1-line summary per environmental, extension-specific, and dev-build / isolated-loop item, followed by full draft issues for untracked/regressed bugs. List skipped unusable GitHub reports by number only.
5. **Draft triage comments:** Show the full draft comment ([format below](#triage-comment-format)) for every **Urgent** issue, **High** issue, **S1 candidate**, and any issue `/triage-telemetry` proposes to create or change. Remaining lower-priority issues follow the same pattern without being drafted one by one in the proposal.

#### 2. Recording in Linear After Approval

Once the user approves, update every open `Bug` issue in Linear with its status, priority, labels, and a comment:

1. **Status & Priority** (via `save_issue`):
    - **Confirmed bugs (`valid`):** If the issue is currently in `Triage` (`statusType: "triage"`), move it to **`Backlog`** (`state: "Backlog"`), and set its approved `priority`. Leave issues already in `Todo`, `In Progress`, or `In Review` in their current status.
    - **`needs-info`:** Leave in `Triage` (or its current status) while awaiting information.
    - **Closed issues:** Move `fixed-in` to `Done`, `duplicate-of` to `Duplicate` (setting `duplicateOf`), and `not-a-bug` or `stale-close` to `Canceled`.
2. **Labels** (via `save_issue` with `addLabels`, plus `removeLabels` to replace outdated severity or impact labels on re-triage):
    - **One `Vortex Triage Severity` label:** `S1 Corrupted State`, `S2 Blocked`, `S3 Degraded`, `S4 Cosmetic`, or `S5 Internal` (marks the issue as triaged).
    - **One `Vortex Triage Player Impact` label:** `P1 Wide`, `P2 Moderate`, or `P3 Limited/Unknown`.
    - **One `Vortex Triage Content Reach` label:** `C1 Wide`, `C2 Moderate`, or `C3 Limited/General`.
    - **`Open to Community Contributions`** when eligible.
    - _Exception:_ Issues closed (fixed, duplicate, stale) or relabelled away from `Bug` get a comment explaining why, **without** a severity label.
3. **GitHub reports:** Append the URLs of matched GitHub reports to the issue's description, along with the reproduction steps or log context they add. The triage skill itself is read-only on GitHub so automated runs never post unreviewed comments.
4. **Triage comment:** Post a short, human-friendly comment in the [format below](#triage-comment-format)—even if severity and priority didn't change (on re-triage, add a new comment rather than editing the old one). Technical details, stack traces, SQL queries, commit hashes, and install IDs belong in the issue's **description**, never in the comment.

#### Triage Comment Format

Write triage comments for teammates reading the issue in Linear, using plain English rather than internal triage codes:

| Instead of internal jargon…        | Write in the comment…                                     |
| ---------------------------------- | --------------------------------------------------------- |
| `P1`, `P2`, `C1`, `C3`             | Plain numbers and shares (never label codes)              |
| Raw percentage (`0.4%` daily rate) | `"about 1 in <N> users"`                                  |
| Raw telemetry install count        | `"about <N> people on <version>"` (`installs × 2`)        |
| _"exposure only"_ / _"trigger"_    | Explain what users did and why we don't know if it harmed |
| _"ships in `<version>` hotfix"_    | Omit release targets (comments outlive release branches)  |

**Structure** (two heading lines, a blank line, the severity explanation, then short bullets):

- **`Severity: <tier>.`** On a re-triage, append the previous tier: _"(was S2)"_.
- **`Priority: <priority>.`** Append _"(was Medium)"_ when it changes.
- **Severity explanation** (new triages and re-triages): what happens to the user, why it isn't the tier above when that isn't obvious (e.g. S3 vs. S1: _"nothing on disk changes"_), and what would confirm or rule out an unconfirmed S1.
- **`* Players:`** estimated headcount (_"about `<N>` people on `<version>`"_), plus the peak daily rate as _"1 in `<N>`"_ across all users on that version. For game-specific bugs, add the in-game rate (_"1 in `<N>` people playing a Bethesda game"_). When there is no telemetry, write _"unknown"_, explain why, and note that unknown isn't the same as rare.
- **`* Content:`** whether the bug is tied to particular collections or mods—and when it is, their combined share in plain words (_"collections that carry about 1 in `<N>` collection downloads"_) and whether it is confirmed. Name the collections or mods, not the people behind them, and never quote one person's share; curator and author names belong in the description.
- **`* Why <priority>:`** include when the priority isn't obvious from the severity alone (the impact or override that raised it, or that S1 is at least High regardless of user count).
- **Optional bullets** (only when they add value): `* What would change this:`, `* Also:` (GitHub context, related issues, partial fixes), `* Needed:` / `* Next step:` (for needs-info issues), `* Open to community contributions:`.

Close, duplicate, and relabel comments use a one-line heading (_"Fixed in `<version>`."_, _"Duplicate of `<ID>`."_, _"Not a Vortex bug."_) followed by the reason.

##### Example

```text
Severity: S2 Blocked.
Priority: High.

On the machines it hits, LOOT never starts, so the load order can't be sorted in any session. Restarting Vortex doesn't help, which is why it isn't S3. It doesn't change the load order or any files on disk, so it isn't S1.

* Players: about <N> people on <version>. On its worst day, about 1 in <M> users hit it.
* Content: not tied to any particular collection.
* Why High: it blocks sorting for a visible share of users, and it's new in this release.
* What would change this: if the beta diagnostics show it's broader, we'll revisit.
```
