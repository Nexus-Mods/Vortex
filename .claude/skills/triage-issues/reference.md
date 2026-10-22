# `/triage-issues` Reference

Shared triage policy and severity tiers live in [`../_shared/triage.md`](../_shared/triage.md); query recipes live in [`../_shared/mixpanel.md`](../_shared/mixpanel.md) and [`../_shared/clickstack.md`](../_shared/clickstack.md).

## Agent Prompt

Fill in the `<…>` placeholders and launch one read-only subagent per subsystem area group (up to 4 in parallel).

```text
You are triaging open Linear bugs for Vortex (repo at <repo root>).
READ-ONLY: do NOT modify any Linear issue, comment, or file, and do not commit.
Load Linear tools via ToolSearch (get_issue, list_comments).

Read `.claude/skills/_shared/triage.md` (specifically the "Severity Tiers" section) for the exact definitions and edge-case rules for S1–S5.

Issues (area: <area>):
<IDs with a few words each, and their reach>

Context:
- Stable: <stable tag> (<release branch>)
- Beta: <beta tag> (<release branch>)
- Today: <date>
- Inspect local refs (`git branch -a`, `git tag`), `origin/master`, and both release branches.
- Known facts from telemetry or earlier triage, plus suspected duplicates to check:
  <notes>

For EACH issue:
1. Read the issue description and comments.
2. Check the codebase and git history (`git log --all --oneline -i --grep=<ISSUE-ID>` and grep relevant code) to determine its status:
   - Still present
   - Fixed (cite commit SHA + which branches contain it)
   - Duplicate of another issue
   - Wrongly labelled (feature request, or belongs to an external extension repo)
   - Not a bug
   - Needs info / stale
3. Assign a severity tier (S1 Corrupted State, S2 Blocked, S3 Degraded, S4 Cosmetic, or S5 Internal) based on the worst outcome observed for a user who hits it. Say "S1 unconfirmed" when state corruption is possible but not proven.

Return a compact table with these columns:
ID | Verdict | Tier + user outcome | Suggested action | One-line evidence (file:line or commit SHA + branches) | Telemetry signature from description (exact error title and/or message substring, or "none")

Follow the table with 2–4 lines of cross-cutting notes. Keep output terse with no preamble.
```
