# `/triage-telemetry` Reference

Shared triage policy and severity tiers live in [`../_shared/triage.md`](../_shared/triage.md); the telemetry schema and landscape queries live in [`../_shared/clickstack.md`](../_shared/clickstack.md); active-user baselines live in [`../_shared/mixpanel.md`](../_shared/mixpanel.md). This file contains the drill-down queries and instructions specific to telemetry-first triage.

---

## Breaking Down an Error Group

### 1. Split a title by cause and shape

Breaks a single `error.title` down by message prefix and phase/kind attributes, showing event volume vs. distinct installs and sessions:

```sql
SELECT
  substring(StatusMessage, 1, 80) AS cause,
  SpanAttributes['loot.phase'] AS phase,
  count() AS ev,
  uniq(ResourceAttributes['service.state.id']) AS installs,
  uniq(
    ResourceAttributes['process.pid'],
    ResourceAttributes['os.version'],
    toDate(Timestamp)
  ) AS sessions,
  round(ev / installs, 1) AS ev_per_install,
  topK(3)(SpanAttributes['context.gamemode']) AS games,
  countIf(SpanAttributes['error.isCommunityExtension'] = 'true') AS community
FROM vortex.otel_traces
WHERE Timestamp > '<release datetime>'
  AND SpanName = 'error.report'
  AND ResourceAttributes['service.version'] = '<version>'
  AND SpanAttributes['error.title'] LIKE '<title>%'
GROUP BY cause, phase
ORDER BY installs DESC
LIMIT 30
```

- Replace `loot.phase` with whichever contextual attribute the error group carries (use the attribute discovery query below to check).
- Messages containing file paths or mod names will fragment into many rows—truncate the substring before the variable segment or mask paths with `replaceRegexpAll`.

### 2. Check if a failure is deterministic per install

Determines how many multi-session installs hit the error in **every** session (`hit = total`) versus intermittently:

```sql
SELECT
  countIf(hit = total) AS always,
  count() AS installs
FROM (
  SELECT
    ResourceAttributes['service.state.id'] AS sid,
    uniq(ResourceAttributes['process.pid']) AS total,
    uniqIf(
      ResourceAttributes['process.pid'],
      SpanAttributes['error.title'] LIKE '<title>%'
    ) AS hit
  FROM vortex.otel_traces
  WHERE Timestamp > '<release datetime>'
    AND ResourceAttributes['service.version'] = '<version>'
  GROUP BY sid
  HAVING hit > 0 AND total > 1
)
```

### 3. Discover which `SpanAttributes` an error group carries

```sql
SELECT
  arrayJoin(mapKeys(SpanAttributes)) AS k,
  count() AS c
FROM vortex.otel_traces
WHERE Timestamp > now() - INTERVAL 1 DAY
  AND SpanName = 'error.report'
  AND SpanAttributes['error.title'] LIKE '<title>%'
GROUP BY k
ORDER BY c DESC
```

### 4. Fetch sample stack traces for code investigation

```sql
SELECT
  StatusMessage,
  toString(Events.Attributes) AS st
FROM vortex.otel_traces
WHERE Timestamp > '<release datetime>'
  AND SpanName = 'error.report'
  AND ResourceAttributes['service.version'] = '<version>'
  AND SpanAttributes['error.title'] LIKE '<title>%'
LIMIT 3
```

---

## Native Crashes

```sql
SELECT
  SpanAttributes['crash.type'] AS type,
  SpanAttributes['crash.sourceProcess'] AS process,
  SpanAttributes['crash.native.module'] AS module,
  SpanAttributes['crash.native.exceptionCode'] AS code,
  count() AS ev,
  uniq(
    ResourceAttributes['process.pid'],
    ResourceAttributes['os.version'],
    toDate(Timestamp)
  ) AS sessions
FROM vortex.otel_traces
WHERE Timestamp > '<release datetime>'
  AND SpanName = 'crash.report'
  AND ResourceAttributes['service.version'] = '<version>'
GROUP BY type, process, module, code
ORDER BY sessions DESC
LIMIT 30
```

- See [Crash Stream in `clickstack.md`](../_shared/clickstack.md#crash-stream-otel_traces-where-spanname--crashreport) for consent, session-counting, and minidump grouping rules.
- Compare `module` + `code` against the prior 28 days before calling a crash new. Ignore raw memory offsets in `KERNELBASE.dll` and `ntdll.dll`, which shift with every Windows update.

---

## Matching to Linear

- **Search broadly:** Call `list_issues` with `query: "<distinctive words from title or message>"`, `includeArchived: true`, and no state filter. Try 2–3 different phrasings (the user-facing error title, the exception message, and the throwing function name).
- **Verify the underlying cause:** Read candidate issue descriptions to confirm they share the same message or stack frame—similar error titles often stem from different root causes.
- **Check resolved fingerprints:** Query `resolved_fingerprints` (via the `error_events` view) for `status`, `pr_url`, and `release_version`. Because fingerprints are per-build, a fingerprint resolved on an older build combined with the same error message appearing on a newer build indicates a **regression**.

---

## Agent Prompt

Fill in the `<…>` placeholders and launch one read-only subagent per subsystem area group (up to 4 in parallel).

```text
You are investigating Vortex error telemetry (repo at <repo root>).
READ-ONLY: do NOT modify any Linear issue or file, and do not commit.
Load Linear tools via ToolSearch (list_issues, get_issue) if you need to read related issues. Use the `gh` CLI for GitHub; never comment on or change GitHub issues.

Read `.claude/skills/_shared/triage.md` (specifically the "Severity Tiers" section) for the exact definitions and edge-case rules for S1–S5, and `.claude/skills/_shared/github.md` for which GitHub reports are usable.

Items (area: <area>), each with message, sample stack, reach, and shape, or a GitHub report:
<per item: title, message, stack sample, installs, events/install, new or inherited, games, linked Linear issue if any, GitHub report numbers with the context they add>

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
   - Community-extension problem
   - Telemetry noise
3. Check whether it is already fixed on any branch (cite commit SHA + branches), and whether any linked Linear issue's described cause actually matches.
4. Assign a severity tier (S1 Corrupted State, S2 Blocked, S3 Degraded, S4 Cosmetic, or S5 Internal) based on the worst outcome for a user who hits it. Say "S1 unconfirmed" when state corruption is possible but unproven.

Return a compact table with these columns:
Item | Class | Cause (one line) | Fixed? | Tier + user outcome | Suggested fix | Evidence (file:line or commit SHA)

Follow the table with 2–4 lines of cross-cutting notes. Keep output terse with no preamble.
```
