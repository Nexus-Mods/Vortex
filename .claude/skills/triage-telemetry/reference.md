# `/triage-telemetry` Reference

Shared triage policy and severity tiers live in [`../_shared/triage.md`](../_shared/triage.md). The drill-down queries named here are in the private recipe file `clickstack.md`; [fetch it](../_shared/triage.md#private-recipes) before running them.

---

## Breaking Down an Error Group

Run these drill-downs, in order, on every error group above the investigation floor:

1. **Split a title by cause and shape:** Break the title down by message and by whichever phase or kind attribute the group carries, showing event volume against distinct installs and sessions. Messages that contain file paths or mod names fragment into many rows—mask the variable part before grouping.
2. **Check whether the failure is deterministic per install:** Count how many multi-session installs hit the error in **every** session versus intermittently.
3. **Discover the attributes an error group carries:** Use this to find the attribute to split by in step 1.
4. **Fetch sample stack traces:** Pass them to the code investigation.

---

## Native Crashes

Rank native crashes by sessions, grouped by faulting module and exception code.

- Crash pings carry no install ID and cover the full install base (anonymous code when diagnostic opt-in is off), so count sessions and compare them against the doubled Mixpanel baseline ([`triage.md`](../_shared/triage.md#counting-and-consent-adjustments)).
- Compare a module and code against the prior 28 days before calling a crash new. Never group by raw memory offset, which shifts with every Windows update.

---

## Matching to Linear

- **Search broadly:** Call `list_issues` with `query: "<distinctive words from title or message>"`, `includeArchived: true`, and no state filter. Try 2–3 different phrasings (the user-facing error title, the exception message, and the throwing function name).
- **Verify the underlying cause:** Read candidate issue descriptions to confirm they share the same message or stack frame—similar error titles often stem from different root causes.
- **Check resolved fingerprints:** Look the cause up among the fingerprints a merged fix resolved (recipe in the private `clickstack.md`). Because fingerprints are per-build, a fingerprint resolved on an older build combined with the same error message appearing on a newer build indicates a **regression**.

---

## Agent Prompt

Fill in the `<…>` placeholders and launch one read-only subagent per subsystem area group (up to 4 in parallel).

```text
You are investigating Vortex error telemetry (repo at <repo root>).
READ-ONLY: do NOT modify any Linear issue or file, and do not commit.
Load Linear tools via ToolSearch (list_issues, get_issue) if you need to read related issues. Use the `gh` CLI for GitHub; never comment on or change GitHub issues.

Read `.claude/skills/_shared/triage.md` (specifically the "Severity Tiers" section) for the exact definitions and edge-case rules for S1–S5, and `.claude/skills/_shared/github.md` for which GitHub reports are usable.

Items (area: <area>), each with message, sample stack, affected users, and shape, or a GitHub report:
<per item: title, message, stack sample, installs, events/install, new or inherited, games, collections or mods the cause names, linked Linear issue if any, GitHub report numbers with the context they add>

Context:
- Stable: <stable tag> (<release branch>)
- Beta: <beta tag> (<release branch>)
- Today: <date>
- Inspect `origin/master` and both release branches.

For EACH item:
1. Map the stack trace and message to the exact code that throws or reports it. For a GitHub report, use its logs and reproduction steps; if it has neither, try to trace the described behaviour to code yourself, and mark it "not reproducible" if you can't.
2. Identify the root cause and classify it as one of:
   - Vortex bug
   - Environmental condition mistakenly reported as a bug
   - Extension-specific problem (note whether core API regression, Nexus-maintained extension, or third-party extension)
   - Dev build or isolated retry loop
3. Check whether it is already fixed on any branch (cite commit SHA + branches), and whether any linked Linear issue's described cause actually matches.
4. Say whether the bug is tied to particular content. If telemetry names collections or mods on it, decide from the code whether they cause it (specific), or it would hit any collection or mod and they are just where it was seen (any).
5. Assign a severity tier (S1 Corrupted State, S2 Blocked, S3 Degraded, S4 Cosmetic, or S5 Internal) based on the worst outcome for a user who hits it. Say "S1 unconfirmed" when state corruption is possible but unproven.

Return a compact table with these columns:
- Item
- Class
- Cause (one line)
- Fixed?
- Tier + user outcome
- Content tied to it ("specific" + which, "any", or "none")
- Suggested fix
- Evidence (`file:line` or commit SHA)

Follow the table with 2–4 lines of cross-cutting notes. Keep output terse with no preamble.
```
