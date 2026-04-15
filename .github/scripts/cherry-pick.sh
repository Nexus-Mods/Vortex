#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
#   PR_NUMBER   - The PR number to cherry-pick
#   PR_TITLE    - The title for the new PR
#   MERGE_SHA   - The merge commit SHA to cherry-pick
#   LABELS      - Space-separated list of PR labels
#
# Optional:
#   DRY_RUN     - Set to "true" to skip push and PR creation

DRY_RUN="${DRY_RUN:-false}"

TARGETS=()
for label in $LABELS; do
  if [[ "$label" == pick:* ]]; then
    TARGETS+=("${label#pick:}")
  fi
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "No pick: labels found, skipping."
  exit 0
fi

for TARGET in "${TARGETS[@]}"; do
  echo "--- Cherry-picking to $TARGET ---"
  BRANCH="cherry-pick/pr-${PR_NUMBER}-to-${TARGET}"

  if ! git rev-parse --verify "origin/$TARGET" > /dev/null 2>&1; then
    echo "WARNING: Target branch '$TARGET' does not exist, skipping."
    continue
  fi

  git checkout -b "$BRANCH" "origin/$TARGET"

  # Use -m 1 for merge commits to cherry-pick just the PR's changes
  PARENT_COUNT=$(git cat-file -p "$MERGE_SHA" | grep -c '^parent ')
  CHERRY_PICK_ARGS=("$MERGE_SHA" --no-edit)
  if [ "$PARENT_COUNT" -gt 1 ]; then
    CHERRY_PICK_ARGS+=(-m 1)
  fi

  HAS_CONFLICTS=false
  if git cherry-pick "${CHERRY_PICK_ARGS[@]}"; then
    echo "Cherry-pick succeeded cleanly."
  else
    echo "Cherry-pick had conflicts, committing with conflict markers."
    HAS_CONFLICTS=true
    git add -A
    git commit --no-edit -m "cherry-pick of #${PR_NUMBER} (conflicts)" || true
  fi

  if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] Would push branch '$BRANCH' and create PR to '$TARGET'"
    echo "[DRY RUN] Has conflicts: $HAS_CONFLICTS"
    git log --oneline -1
  else
    git push --force origin "$BRANCH"

    EXISTING_PR=$(gh pr list --head "$BRANCH" --base "$TARGET" --json number --jq '.[0].number')

    if [ -n "$EXISTING_PR" ]; then
      echo "PR #${EXISTING_PR} already exists for $BRANCH -> $TARGET, skipping creation."
      PR_URL="https://github.com/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/pull/${EXISTING_PR}"
    else
      DRAFT_FLAG=""
      BODY="Cherry-pick of #${PR_NUMBER} into \`${TARGET}\`."

      if [ "$HAS_CONFLICTS" = "true" ]; then
        DRAFT_FLAG="--draft"
        BODY="${BODY}

> [!WARNING]
> This cherry-pick had merge conflicts that need manual resolution."
      fi

      PR_URL=$(gh pr create \
        --base "$TARGET" \
        --head "$BRANCH" \
        --title "$PR_TITLE" \
        $DRAFT_FLAG \
        --body "$BODY")
      echo "$PR_URL"
    fi

    if [ "$HAS_CONFLICTS" = "false" ]; then
      echo "No conflicts detected, enabling auto-merge (will land once branch protections are satisfied)..."
      gh pr merge "$PR_URL" --auto --merge --delete-branch
    fi
  fi

  git checkout --detach
  git branch -D "$BRANCH"
  echo ""
done
