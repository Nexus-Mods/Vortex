#!/usr/bin/env bash
set -euo pipefail

# Commits the Electron/Node.js upgrade produced by scripts/upgrade-electron.mjs
# and opens a PR against BASE. Expects the upgrade to already be applied in the
# working tree. Closes open upgrade PRs for older Electron versions.
#
# Required environment variables:
#   GH_TOKEN      - Token able to push branches and open PRs
#   BASE          - Branch the PR targets (e.g. master)
#   ELECTRON_OLD  - Electron version before the upgrade
#   ELECTRON_NEW  - Electron version after the upgrade
#   NODE_OLD      - Node.js version before the upgrade
#   NODE_NEW      - Node.js version after the upgrade
#   NODE_ABI_OLD  - node-abi version before the upgrade
#   NODE_ABI_NEW  - node-abi version after the upgrade
#
# Optional:
#   DRY_RUN  - Set to "true" to skip push and PR creation

DRY_RUN="${DRY_RUN:-false}"
PREFIX="chore/upgrade-electron-"
BRANCH="${PREFIX}${ELECTRON_NEW}"

# A closed, unmerged PR leaves its branch behind; don't propose it again.
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Branch $BRANCH already exists - already proposed, nothing to do."
  exit 0
fi

git checkout -b "$BRANCH"
git add -- package.json pnpm-workspace.yaml pnpm-lock.yaml

if [ "$ELECTRON_OLD" = "$ELECTRON_NEW" ]; then
  TITLE="Sync Node.js with Electron ${ELECTRON_NEW}"
else
  TITLE="Upgrade electron from ${ELECTRON_OLD} to ${ELECTRON_NEW}"
fi

BODY="- electron: \`${ELECTRON_OLD}\` -> \`${ELECTRON_NEW}\` ([compare](https://releases.electronjs.org/release/compare/v${ELECTRON_OLD}/v${ELECTRON_NEW}))"
if [ "$NODE_OLD" != "$NODE_NEW" ]; then
  BODY="${BODY}"$'\n'"- Node.js: \`${NODE_OLD}\` -> \`${NODE_NEW}\` (matches the version bundled with Electron)"
fi
if [ "$NODE_ABI_OLD" != "$NODE_ABI_NEW" ]; then
  BODY="${BODY}"$'\n'"- node-abi: \`${NODE_ABI_OLD}\` -> \`${NODE_ABI_NEW}\` (required to resolve the Electron ABI)"
fi

git commit -m "$TITLE" -m "$BODY"

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY_RUN - skipping push and PR creation."
  exit 0
fi

git push origin "$BRANCH"

# Close upgrade PRs superseded by this one.
gh pr list --base "$BASE" --state open --json number,headRefName \
  --jq ".[] | select(.headRefName | startswith(\"${PREFIX}\")) | select(.headRefName != \"${BRANCH}\") | .number" |
  while read -r number; do
    gh pr close "$number" --delete-branch --comment "Superseded by ${BRANCH}."
  done

gh pr create \
  --head "$BRANCH" \
  --base "$BASE" \
  --title "$TITLE" \
  --body "$BODY"
