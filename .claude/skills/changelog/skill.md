---
name: changelog
description: Generate a new Vortex `CHANGELOG.md` entry from merged PRs since a given starting tag. Use this skill whenever the user invokes `/changelog`, asks to draft release notes, or wants to summarise PRs merged on a Vortex release branch (v2.0, v2.1, v2.2, etc.) into Added / Changed / Fixed bullets following Keep-a-Changelog 1.1.0. The skill auto-detects the source branch, fetches PR titles/bodies via `gh`, dedupes against the existing CHANGELOG, applies the project's exclusion rules (internal CI/infra, telemetry/OTel/Mixpanel, docs-only, low-impact dependency bumps), produces a draft for the user to review, and only writes after the user gives the go-ahead.
---

# Vortex `/changelog`

A skill that drafts the next entry of `C:\src\Vortex\CHANGELOG.md` from merge commits on the current release branch and presents the result for review before editing the file.

## When to use

Use this skill when the user:

- Invokes `/changelog` (with or without args)
- Asks to "draft a changelog entry", "generate release notes", or "summarise PRs since v2.0.0-beta.X"
- Is preparing a Vortex pre-release (alpha/beta) or patch release and needs the entry written

Do **not** use this skill to _promote_ an existing pre-release entry to stable (e.g. renaming `2.0.0-beta.3` → `2.0.0`). That workflow stays manual.

## Inputs

The user may pass `version` and/or `date` as arguments. Anything missing is prompted for. The starting tag/commit is **always** prompted for — there's no safe auto-detection across the many possible source branches (v2.0, v2.1, v2.2 patches, new branch first-betas).

| Input                 | How to obtain                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `version`             | Arg, else prompt the user (e.g. `2.0.0-beta.4`, `2.1.0-alpha.1`, `2.0.1`)                       |
| `date`                | Arg, else default to today and confirm with user before continuing                              |
| `starting tag/commit` | Always prompt (e.g. `v2.0.0-beta.3`, or a commit SHA when a new release branch was just forked) |
| `source branch`       | Auto-detect: `git rev-parse --abbrev-ref HEAD`                                                  |

If the user invoked `/changelog 2.0.0-beta.4 2026-05-20`, treat the first arg as version and the second as date. If the order is ambiguous (e.g. only one arg), ask which one they meant rather than guessing.

## Workflow

### 1. Read style exemplars

Read the topmost three entries of `C:\src\Vortex\CHANGELOG.md` (e.g. `2.0.0`, `2.0.0-beta.2`, `2.0.0-beta.1`) to internalise:

- The heading format: `## [VERSION] - YYYY-MM-DD`
- Section order: `### Added` → `### Changed` → `### Fixed`
- Bullet wording — short, user-facing, past-tense fragments, backticks for symbols/paths/API names
- The italic milestone-intro pattern used on `*-beta.1` / `*-alpha.1` headings
- The reference-style link list at the bottom of the file

This anchors the rest of the workflow in the project's house style.

### 2. Gather merged PRs

Fetch the latest state of the source branch, then list merge commits in range:

```bash
git fetch origin <branch> --tags
git log <starting-tag>..origin/<branch> --merges --oneline
```

For each merge commit, parse the PR number from the message (`Merge pull request #NNNNN from ...`) and pull the title + body:

```bash
gh pr view <num> --json title,body
```

Ignore direct (non-PR) commits in the range — the existing CHANGELOG never references them and the user has confirmed that's the desired behaviour.

### 3. Dedupe against existing entries

Cherry-picks mean a PR can show up in multiple branches. Before adding any PR to the draft, search the existing `CHANGELOG.md` for the `#NUMBER` reference. If found, drop the PR from the draft and record it under "Dedup-skipped" in the summary so the user knows.

### 4. Auto-exclude silently

These categories never reach the draft. The user has explicitly confirmed each rule:

| Rule                              | What it covers                                                                           | How to detect                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Internal CI/infra**             | Fingerprint workflow PRs, sync-from-master, the changelog merge itself, test-only tweaks | Branch prefixes like `task/fingerprint-*`, `task/fp-*`, `sync/*`, `chore/*-changelog`, `chore/*-test*`; PRs that only touch CI configs (`.github/`), test files, or the changelog itself                                                                                                        |
| **Telemetry / OTel / Mixpanel**   | Primary purpose is telemetry/observability wiring                                        | PR title or body mentions telemetry, OpenTelemetry, OTel, Mixpanel, analytics, or `app_launched` as the main subject. If telemetry is _incidental_ (e.g. a bug fix that happens to be discovered via error fingerprints), the PR is **not** excluded — describe it in user-facing terms instead |
| **Docs-only**                     | README, AGENTS.md, comments                                                              | PR body indicates documentation changes only; diff doesn't touch shippable source                                                                                                                                                                                                               |
| **Dep bumps without user impact** | Routine dependency upgrades with no user-visible behaviour change                        | Title patterns like "bump X to Y" with no associated bug fix or feature; check PR body for any "fixes" / "closes" links to user-facing issues                                                                                                                                                   |

When in doubt about exclusion, include the PR and flag it under "Items I had to guess on" rather than silently dropping it.

### 5. Categorise into Added / Changed / Fixed

Use three signals together — no single one is conclusive:

1. **Branch prefix** (strongest):
    - `fix/*`, `fix-*` → **Fixed**
    - `feat/*`, `feature/*` → **Added**
    - `task/*` → **Added** if introducing new capability; **Changed** if improving an existing one
    - `chore/*` → usually **Changed**, or excluded if internal-only

2. **PR title verb**:
    - "fixed", "fix", "prevent", "guard", "restore" → Fixed
    - "added", "introduced", "support for" → Added
    - "updated", "changed", "improved", "bumped", "refactored", "switched" → Changed

3. **LLM judgement on the body** (tiebreaker):
    - If the body describes a crash, regression, or user-reported bug → Fixed
    - If it describes a new affordance or capability → Added
    - If it describes an enhancement to existing behaviour → Changed

Do **not** consult GitHub labels — the user has explicitly said to skip them.

If a single PR genuinely spans categories (e.g. a refactor that also fixes a bug), follow the precedent set in `2.0.0-beta.2` and list the PR under multiple sections with different wording — once under Changed for the refactor, once under Fixed for the bug. Note this in the summary.

### 6. Write bullets (hybrid wording)

- **Verbatim** when the PR title already reads as a user-facing sentence-fragment (e.g. "restored auto-download for patch updates in autoupdater")
- **Reframe** when the title is developer-flavoured (e.g. "guard undefined currentProfile in install fallback path" → "Mod install crash with undefined `gameId` when the current profile was stale or absent")
- Use backticks for symbols, file paths, function names, env vars, and short config keys
- Past tense for fixes ("Crash when ...", "Auto-download not triggering for ..."); imperative or past for added/changed items
- Keep each bullet to one line wherever possible; if a PR genuinely covers multiple bug fixes (like `#22520` in beta.2), use a sub-list or a single long bullet with semicolons

Each bullet ends with the PR link in this exact format:

```
([#NNNNN](https://github.com/Nexus-Mods/Vortex/pull/NNNNN))
```

### 7. Order and assemble

- Within each section, sort bullets by **highest PR number first**
- Section order: `### Added` → `### Changed` → `### Fixed`
- **Omit any section that has zero bullets** (don't render an empty heading)
- The heading line is `## [VERSION] - YYYY-MM-DD` (matches existing entries)

### 8. Milestone intro (auto-detect)

If **both** of these are true, prepend an italic intro paragraph between the heading and the first section:

1. `version` matches `X.Y.0-beta.1` or `X.Y.0-alpha.1`
2. The existing `CHANGELOG.md` has no entries for that `X.Y` series

Use the established phrasing pattern:

```markdown
_First beta of the X.Y release._
```

**Do not assume alphas exist** — do not reference "alpha release notes below" or previous pre-releases unless they actually exist in the CHANGELOG. Keep the intro simple.

For alphas, use: `_Internal alpha release for testing — not for public distribution._` (only use this if the user confirms the release is internal-only).

### 9. Present the draft

Print **everything** in chat as markdown, in this order:

1. **The proposed entry** (the heading, optional intro, and the bulleted sections), formatted exactly as it would appear in the file
2. **Decisions summary** — four sub-sections, each as a markdown sub-list:
    - **Items I had to guess on** — PRs where category or wording was uncertain, with a one-line rationale per item
    - **Auto-excluded PRs** — `#NNNNN — rule that excluded it`
    - **Dedup-skipped PRs** — PRs already listed in earlier entries
    - **Per-PR categorisation table** — every included PR with its section, so the user can spot mis-categorised items at a glance

Then ask the user to confirm in plain chat: "Ready to write to CHANGELOG.md, or want changes first?" Do not use AskUserQuestion for this confirmation — a freeform reply is faster.

### 10. Write the file

After the user confirms:

1. Insert the new entry **directly above** the topmost existing version heading in `C:\src\Vortex\CHANGELOG.md`. Preserve the blank lines around the headings as seen in existing entries.
2. Add a matching reference-style link to the bottom-of-file link list:

    ```
    [VERSION]: https://github.com/Nexus-Mods/Vortex/releases/tag/VERSION
    ```

    - No leading `v` on the URL fragment (matches existing entries)
    - Insert in newest-first position alongside the existing list (top of the link list for the new pre-release/version)

3. Stop. Do **not** stage with `git add`, do **not** commit, do **not** push. The user will review the file and commit themselves.

## Examples of well-formed bullets

These are taken from existing entries and illustrate the target style:

**Fixed (good rewrite from developer-flavoured title):**

> Mod install crash with undefined `gameId` when the current profile was stale or absent ([#22684](https://github.com/Nexus-Mods/Vortex/pull/22684))

**Fixed (multiple bugs in one PR, semicolons OK):**

> Several race conditions when switching collection revisions: patched mods not reinstalled, install driver starting before old mods were cleaned up, optional mods losing enabled state, update notification shown on latest revision, and install activity running indefinitely ([#22520](https://github.com/Nexus-Mods/Vortex/pull/22520))

**Changed (verbatim-ish, internal refactor with user-visible effect):**

> BG3: refactored divine wrapper with cleaner error classification, cancellation on game switch, and silent skipping of corrupt third-party paks instead of "re-install LSLib" notifications ([#22679](https://github.com/Nexus-Mods/Vortex/pull/22679))

**Added (concise, capability-first):**

> Per-profile plugin rules with "Reset Plugin Rules" button and curator/consumer controls to skip or exclude plugin rules when installing collections ([#22620](https://github.com/Nexus-Mods/Vortex/pull/22620))

## Edge cases

- **No PRs in range** — surface this clearly and stop. Don't generate an empty entry.
- **PR body is empty** — fall back to the title and any Linear issue link the body might contain (don't open the link, just note "Linear-only context" in the summary and use the title verbatim).
- **PR not visible to `gh`** (private, deleted, network error) — skip and flag under "Items I had to guess on" with the merge commit subject as fallback context.
- **Branch isn't a release branch** (e.g. user is on `master`) — ask the user to confirm before proceeding. Most often they want to switch to the actual release branch first.
- **Two PRs reference the same Linear issue** — don't dedupe these. Each PR is a separate change.

## Style anchors (read if uncertain)

- The current `CHANGELOG.md` is the canonical style reference. When in doubt, mimic the most recent 2-3 entries.
- `AGENTS.md` in the repo root documents the reference-link convention under `## Changelog`.
- Keep a Changelog 1.1.0: <https://keepachangelog.com/en/1.1.0/>
