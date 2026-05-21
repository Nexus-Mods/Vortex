---
name: changelog
description: Generate a new Vortex `CHANGELOG.md` entry from merged PRs since a given starting tag. Use this skill whenever the user invokes `/changelog`, asks to draft release notes, or wants to summarise PRs merged on a Vortex release branch (v2.0, v2.1, v2.2, etc.) into Added / Changed / Fixed bullets following Keep-a-Changelog 1.1.0. The skill auto-detects the source branch, fetches PR titles/bodies via `gh`, dedupes against the existing CHANGELOG, applies the project's exclusion rules (internal CI/infra, telemetry/OTel/Mixpanel, docs-only, low-impact dependency bumps), produces a draft for the user to review, and only writes after the user gives the go-ahead.
---

# Vortex `/changelog`

A skill that drafts the next entry of `./CHANGELOG.md` from merge commits on the current release branch and presents the result for review before editing the file.

## When to use

Use this skill when the user:

- Invokes `/changelog` (with or without args)
- Asks to "draft a changelog entry", "generate release notes", or "summarise PRs since v2.0.0-beta.X"
- Is preparing a Vortex pre-release (alpha/beta) or patch release and needs the entry written

Do **not** use this skill to _promote_ an existing pre-release entry to stable (e.g. renaming `2.0.0-beta.3` → `2.0.0`). That workflow stays manual.

## Prerequisites

This skill requires:

1. **GitHub CLI (`gh`)** — must be installed and authenticated with read access to the Nexus-Mods/Vortex repository
    - Test with: `gh auth status`
    - If not authenticated, run: `gh auth login`

2. **Git remote named `origin`** — the skill assumes the primary remote is called `origin`
    - Check with: `git remote -v`
    - If your remote has a different name, either rename it (`git remote rename <old> origin`) or the skill will fail when fetching

3. **Git Bash or WSL (Windows users)** — the git commands use Unix-style syntax

If any of these are missing, surface a clear error to the user before attempting to fetch PRs.

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

Read the topmost three entries of `./CHANGELOG.md` (e.g. `2.0.0`, `2.0.0-beta.2`, `2.0.0-beta.1`) to internalise:

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

**Do not add date floors or other range restrictions beyond the user-supplied starting tag.** The starting tag is the authoritative floor. Vortex's branches diverge at the alpha stage, so the v2.0.1..release/v2.1 range correctly contains master-direct PRs that predate v2.0.0 stable but were never back-ported to release/v2.0 — those are genuine v2.1 content and must reach the draft. Pass A (PR# dedup) and Pass B (cherry-pick wrapper detection) are the only filtering passes; do not invent a "post-stable cutoff" or similar shortcut to shrink the candidate list. If the list looks too large, work through it — don't truncate it.

### 3. Dedupe and detect cross-branch PRs

The same user-facing change can show up under multiple PR numbers — once when it's authored on a release branch (e.g. `release/v2.0`), and again when it's forward-ported to `master` via a wrapper PR. Vortex's branching convention is: bug fixes are authored on `release/v2.X`, then mirrored to `master` (and thence to `release/v2.(X+1)`) via wrapper PRs.

This means a cherry-pick PR that lands in the v2.1 range is _not_ new 2.1 work — it's v2.0 work that has already been released (or is pending the next v2.0.x release). Either way, it does **not** belong in the v2.1 draft. The 2.0.x release line owns its own changelog entries.

Run three passes against every merge PR in range — anything that matches drops out of the draft and into the corresponding summary section.

**Pass A — direct PR-number match against `CHANGELOG.md`.** For each merge PR `#X`, search `CHANGELOG.md` for `#X`. If found, classify as **Dedup-skipped** (already documented). Move on.

**Pass B — cherry-pick wrapper detection.** When a merge commit's branch matches `cherry-pick/pr-NNNNN-to-*` (or any `cherry-pick/*` variant that contains a PR number), the merge PR is just a forward-port wrapper. The _user-facing_ PR is `#NNNNN`. **Always exclude the cherry-pick from the draft**, even if the origin is not yet documented:

- If `#NNNNN` is already in `CHANGELOG.md` → classify as **Dedup-skipped** (shipped and documented in earlier entry).
- If `#NNNNN` is **not** in `CHANGELOG.md` → classify as **Cross-branch — pending source-branch release** (will be documented when the source branch cuts its next release, e.g. `2.0.2`). Flag this group prominently in the summary so the user can confirm none of them were meant to land in this draft.

The exclusion is unconditional because the wrapper PR's branch name is a hard signal that the work originated elsewhere. Do not try to second-guess this with content analysis. If the user explicitly wants to advertise a cross-branch fix in the v2.1 entry as well (rare), they will say so during review and we add it back manually.

This pass typically catches a large chunk of merges on a long-running release branch (often 30–40% of merges in a beta-to-beta range).

**Pass C — content-duplicate phrases.** Some non-`cherry-pick/*` branches still produce content-duplicate PRs. Scan PR bodies for these phrases:

- `"Same as #NNNNN"` / `"Same as https://github.com/.../pull/NNNNN"`
- `"cherry-pick for APP-XXX"` / `"cherry-pick for #NNNNN"`
- `"backport of #NNNNN"`
- `"companion to #NNNNN"`
- `"previous implementation was fine"` followed by an internal-only rework of an already-shipped behaviour

For each referenced PR number, check if it's already in `CHANGELOG.md`. If yes, classify the current PR as **Dedup-skipped (content-duplicate)**. For phrases like "previous implementation was fine" with no PR ref, the PR is a refactor of an existing behaviour — it has no user-visible delta and should be classified as **Auto-excluded — internal refactor**.

After all three passes, the survivors are genuine new v2.1 work and proceed to step 4.

### 4. Auto-exclude silently

These categories never reach the draft. The user has explicitly confirmed each rule:

| Rule                                  | What it covers                                                                                                                                                                  | How to detect                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Internal CI / build / packaging**   | CI workflow gates, build orchestration (nx, pnpm deploy), packaging scripts, signing/release pipeline fixes, fingerprint workflow, sync-from-master, the changelog merge itself | Branch prefixes like `chore/build-*`, `chore/*-ci`, `chore/*-changelog`, `chore/update-*-workflow`, `task/fingerprint-*`, `task/fp-*`, `tas/fp-*`, `sync/*`, `task/sign-*`, `fix-package-*`, `fix/package*`, `fix/create-local-package`, `fix/pnpm-*`; PRs that only touch `.github/`, `package.yml`, `nx.json`, packaging/build scripts, or the changelog itself     |
| **Lint / format / style enforcement** | Lint config or script changes; codebase formatter runs (single-file or whole-codebase); format-enforcement scaffolding (Husky, lint-staged, format-check CI)                    | Branch prefixes like `chore/format-*`, `format-*`, `chore/lint-*`, `*eslint*`, `*oxlint*`, `*prettier*`; PR title or body says "format", "lint", "eslint", "oxlint", "prettier", "Husky", "lint-staged", or "format-check" as the primary subject. Includes adding/removing/renaming lint or formatter rules, configs, ignore lists, or the runners that enforce them |
| **Test-only infra**                   | Playwright/e2e test additions, Jest↔Vitest migrations, removing unused test packages, test-only fixes                                                                           | Branch prefixes like `QA-*/*`, `*/playwright/*`, `*/e2e/*`, `*-remove-enzyme`, `*-vitest*`, `fix/*-test*`, `fix/*test*`; PR body indicates the diff only touches `*.spec.*`, `*.test.*`, `tests/`, `e2e/`, or test-runner configs                                                                                                                                     |
| **Internal cleanup / dev tooling**    | Dead code removal, internal package renames/consolidations with no external API change, dev shell refreshes, internal-only refactors that don't change shipped behaviour        | PR body explicitly describes "no logic changes", "internal only", "no runtime change", "dev shell", "refresh dev environment", "remove unused", "remove dead code". Excludes renames of public/extension-facing API packages (those go in Changed)                                                                                                                    |
| **Telemetry / OTel / Mixpanel**       | Primary purpose is telemetry/observability wiring                                                                                                                               | PR title or body mentions telemetry, OpenTelemetry, OTel, Mixpanel, analytics, or `app_launched` as the main subject. If telemetry is _incidental_ (e.g. a bug fix that happens to be discovered via error fingerprints), the PR is **not** excluded — describe it in user-facing terms instead                                                                       |
| **Docs-only**                         | README, AGENTS.md, wiki links, comments, setup/packaging guides                                                                                                                 | PR body indicates documentation changes only; diff doesn't touch shippable source. Branch prefixes like `agents-md-*`, `*-wiki-*`, `chore/*-docs`, `*-readme*`                                                                                                                                                                                                        |
| **Dep bumps without user impact**     | Routine dependency upgrades with no user-visible behaviour change                                                                                                               | Branch prefixes like `dependabot/*`. Title patterns like "bump X to Y" with no associated bug fix or feature; check PR body for any "fixes" / "closes" links to user-facing issues. Major framework upgrades (Electron, Node) **stay in the changelog** — they have user-visible impact (perf, compat, security)                                                      |

**Also watch for "dev-only" disclosures in PR bodies.** Major architectural work sometimes lands behind a feature flag or as scaffolding that doesn't ship in production builds. PR bodies that explicitly say things like "this is dev-only for now", "not included in production builds", "no XYZ code runs in a shipped build", or "behind a feature flag disabled by default" are signals that the change has zero user-visible effect in the release being drafted. Exclude these and flag under "Items I had to guess on" with the dev-only quote, so the user can override if a flag is being flipped in this release. Do not _infer_ dev-only — only act on explicit statements in the PR body.

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

**Strict one PR per bullet. Never bundle multiple PRs into one bullet — under any circumstances.**

The CHANGELOG is a PR-level audit trail, not a feature narrative. Higher-level feature summaries live elsewhere in the release process; do not try to write them here. Even when many PRs collectively deliver a single user-visible capability, write **one bullet per PR**.

This rule overrides every other style consideration in this section:

- Do not group PRs by theme, feature, or capability.
- Do not consolidate two PRs into one bullet even if their titles are near-identical.
- Do not offer thematic-bundling layouts as an alternative during review. The format is fixed.
- Do not append additional PR refs to an existing bullet "for context" — each PR gets its own bullet.

The existing CHANGELOG contains a few multi-PR bullets (e.g. `#23050` + `#23059` + `#23066` in `2.0.1`). Treat these as legacy artefacts, not as precedent. New entries are one bullet per PR.

The "sub-list or long bullet with semicolons" guidance just above applies only when a _single_ PR delivers several independently-described fixes (`#22520` in `2.0.0-beta.2` is the canonical example). One PR, one bullet — that bullet may internally describe multiple fixes if the PR itself did so.

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
2. **Decisions summary** — five sub-sections, each as a markdown sub-list:
    - **Items I had to guess on** — PRs where category or wording was uncertain, with a one-line rationale per item
    - **Auto-excluded PRs** — `#NNNNN — rule that excluded it`
    - **Dedup-skipped PRs** — PRs already listed in earlier entries
    - **Cross-branch PRs (belong to next source-branch release)** — cherry-pick wrappers whose origin is not yet documented anywhere. Prefix this list with a one-sentence reminder that the user should confirm none of these were intended for the current draft, and that they will need to land in the source-branch's next patch release (e.g. `2.0.2`). If empty, render an empty sub-list with the note `_(none)_` — do not omit the section.
    - **Per-PR categorisation table** — every included PR with its section, so the user can spot mis-categorised items at a glance

Then ask the user to confirm in plain chat: "Ready to write to CHANGELOG.md, or want changes first?" Do not use AskUserQuestion for this confirmation — a freeform reply is faster.

### 10. Write the file

After the user confirms:

1. Insert the new entry **directly above** the topmost existing version heading in `./CHANGELOG.md`. Preserve the blank lines around the headings as seen in existing entries.
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
