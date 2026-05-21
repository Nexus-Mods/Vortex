# Cherry-Pick Workflow

Automatically cherry-picks merged PRs from release branches (e.g. `v2.0`) to other branches (e.g. `master`) via GitHub Actions.

## How it works

1. A PR is merged into a release branch (any branch matching `v2*`)
2. The workflow checks for labels matching the pattern `pick:<target-branch>`
3. For each matching label, it cherry-picks the merge commit onto a new branch and opens a PR targeting that branch
4. If the cherry-pick has conflicts, a **draft** PR is created with a warning so the conflicts can be resolved manually

## Usage

Add a `pick:<branch>` label to your PR **before merging**. Examples:

- `pick:master` — cherry-pick into `master`
- `pick:v3.0` — cherry-pick into `v3.0`

Multiple labels can be used on a single PR to cherry-pick into several branches.

## Behavior

| Scenario                       | Result                                           |
| ------------------------------ | ------------------------------------------------ |
| Clean cherry-pick              | Branch pushed, PR created                        |
| Cherry-pick with conflicts     | Branch pushed, **draft** PR created with warning |
| Target branch doesn't exist    | Skipped with a warning                           |
| Branch already exists remotely | Force-pushed, existing PR reused                 |
| No `pick:` labels              | Workflow exits early                             |

## Cherry-pick branches

Created branches follow the naming convention:

```
cherry-pick/pr-{number}-to-{target}
```

For example, PR #22246 with label `pick:master` creates branch `cherry-pick/pr-22246-to-master`.

## Merge commits

The workflow detects whether the merge commit has multiple parents (i.e. a merge commit rather than a squash/rebase). For merge commits it uses `git cherry-pick -m 1` to pick only the PR's changes relative to the base branch.

## Files

- Workflow: `.github/workflows/cherry-pick.yml`
- Script: `.github/scripts/cherry-pick.sh`

## Local testing

The script can be run locally with `DRY_RUN=true` to verify the cherry-pick without pushing or creating PRs:

```bash
DRY_RUN=true \
PR_NUMBER=12345 \
PR_TITLE="your PR title" \
MERGE_SHA=abc123 \
LABELS="pick:master" \
bash .github/scripts/cherry-pick.sh
```

Note: this will temporarily check out branches in your working tree. Stash or commit local changes first.
