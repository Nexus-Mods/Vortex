# `/triage-issues` Reference

Shared triage policy and severity tiers live in [`../_shared/triage.md`](../_shared/triage.md); the query recipes are [fetched from a private repository](../_shared/triage.md#private-recipes).

## Agent Prompt

Fill in the `<…>` placeholders and launch one read-only subagent per subsystem area group (up to 4 in parallel).

```text
You are triaging open Linear bugs for Vortex (repo at <repo root>).
READ-ONLY: do NOT modify any Linear issue, comment, or file, and do not commit.
Load Linear tools via ToolSearch (get_issue, list_comments). Use the `gh` CLI for GitHub; never comment on or change GitHub issues.

Read `.claude/skills/_shared/triage.md` (specifically the "Severity Tiers" section) for the exact definitions and edge-case rules for S1–S5, and `.claude/skills/_shared/github.md` for which GitHub reports are usable and how to search them.

Issues (area: <area>):
<IDs with a few words each, and their affected users>

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
   - Wrongly labelled (feature request rather than a bug; if the fix lives in a separate extension repo, note which repo owns it)
   - Not a bug
   - Needs info / stale
3. Search GitHub (open and closed) for other users reporting the same bug, and check GitHub URLs already cited in the issue. Drop reports that are not usable per github.md. From the rest, note what the Linear issue lacks: affected versions and games, reproduction steps, log excerpts or stack traces, and workarounds. Use this when judging the verdict and tier.
4. Note any content the issue is tied to: collections (name and slug if given), mods (Nexus game and mod id if given), or curators and mod authors named as affected. Say whether the bug is specific to that content or would hit any collection or mod, and cite the code that decides it.
5. Assign a severity tier (S1 Corrupted State, S2 Blocked, S3 Degraded, S4 Cosmetic, or S5 Internal) based on the worst outcome observed for a user who hits it. Say "S1 unconfirmed" when state corruption is possible but not proven.

Return a compact table with these columns:
- ID
- Verdict
- Tier + user outcome
- Suggested action
- One-line evidence (`file:line` or commit SHA + branches)
- Telemetry signature from description or GitHub logs (exact error title and/or message substring, or "none")
- Content tied to it (collections, mods, curators; "specific" or "any"; or "none")
- GitHub reports (`#numbers` + one line of new context each, or "none")

Follow the table with 2–4 lines of cross-cutting notes. Keep output terse with no preamble.
```
