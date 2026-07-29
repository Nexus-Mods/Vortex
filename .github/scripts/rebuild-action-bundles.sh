#!/usr/bin/env bash
set -euo pipefail

# Commits any rebuilt .github/actions/*/dist output and opens (or updates) a PR
# against BASE. Expects the bundles to have already been rebuilt in the working
# tree.
#
# Required environment variables:
#   GH_TOKEN - Token able to push branches and open PRs
#   BASE     - Branch the PR targets (e.g. master)
#
# Optional:
#   DRY_RUN  - Set to "true" to skip push and PR creation

DRY_RUN="${DRY_RUN:-false}"

if git diff --quiet -- ':(glob).github/actions/*/dist/**'; then
  echo "Every committed bundle is already current - nothing to do."
  exit 0
fi

echo "Bundles differing from their committed output:"
git diff --name-only -- ':(glob).github/actions/*/dist/**'

# Slashes in the base branch would create a deep ref path; flatten them so the
# branch stays inside a single segment (e.g. release/v2.4 -> release-v2.4).
SAFE_BASE="${BASE//\//-}"
BRANCH="chore/rebuild-action-bundles-${SAFE_BASE}"

# One long-lived branch per base, force-pushed, so repeated runs update a single
# PR instead of opening a new one each time.
git checkout -B "$BRANCH"
git add -- ':(glob).github/actions/*/dist/**'
git commit -m "chore: rebuild bundled action dist"

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY_RUN - skipping push and PR creation."
  exit 0
fi

git push --force origin "$BRANCH"

if [ -n "$(gh pr list --head "$BRANCH" --base "$BASE" --state open --json number --jq '.[].number')" ]; then
  echo "Existing PR updated by the force-push."
  exit 0
fi

gh pr create \
  --head "$BRANCH" \
  --base "$BASE" \
  --title "chore: rebuild bundled action dist" \
  --body "$(
    cat <<'EOF'
The committed `dist/` of one or more actions under `.github/actions/` no longer
matches a rebuild from source, so GitHub would keep running the older bundle.

This PR contains only regenerated build output - review the diff of the
corresponding `src/` in the change that triggered it, not the bundle itself.
EOF
  )"
