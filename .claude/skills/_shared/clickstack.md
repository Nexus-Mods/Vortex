# ClickStack (ClickHouse) Recipes

Schema and landscape queries for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Policy for using them lives in [`triage.md`](triage.md); telemetry-only drill-downs live in [`../triage-telemetry/reference.md`](../triage-telemetry/reference.md).

- **Service:** `Nexus Mods`
- **Database:** `vortex`

## Schema Overview

### Error Stream (`otel_traces` where `SpanName = 'error.report'`)

| Column / Attribute                             | Description                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ResourceAttributes['service.version']`        | App version (e.g. `2.9.0`).                                                        |
| `ResourceAttributes['service.state.id']`       | Persistent install ID (**2.9.0+ only**).                                           |
| `SpanAttributes['error.title']`                | Error title. Strip dynamic suffixes like ` (3 dependencies)` or match with `LIKE`. |
| `StatusMessage`                                | Exception message.                                                                 |
| `toString(Events.Attributes)`                  | Stack trace.                                                                       |
| `SpanAttributes['context.gamemode']`           | Game **display name** (e.g. `Morrowind`).                                          |
| `SpanAttributes['error.isCommunityExtension']` | `'true'` when thrown by a community extension.                                     |
| `SpanAttributes['loot.phase']`                 | LOOT operation phase (when applicable).                                            |

### Crash Stream (`otel_traces` where `SpanName = 'crash.report'`)

- **Attributes:** `crash.type`, `crash.sourceProcess`, `crash.native.module`, `crash.native.exceptionCode` (or `crash.exitCode` for non-native crashes).
- **No install ID:** `crash.report` never carries `service.state.id` in either consent mode, so count **sessions** (`process.pid` + `os.version` + date) instead of installs, and rank crashes separately from `error.report` causes.
- **100% user coverage:** Sent with or without telemetry opt-in, so compare against `Mixpanel users × 2`.
- **Grouping:** Most rows have a blank module (unreadable minidump; `crash.native.unreadableReason` explains why). Always group by `module` + `exceptionCode`, never by memory offset.

### Other Spans & Helper Views

- **Operation spans:** `extension.install`, `mod.install`, `profile.switch`, etc. carry their own `StatusCode` and `StatusMessage`.
- **`error_events` view:** Joins `error.report` with `resolved_fingerprints` (`status`, `pr_url`, `release_version`).
- **`actionable_errors` view:** Filters `error_events` to unresolved, non-noise errors.
- **Fingerprint caveat:** Fingerprints are per-build; when matching across versions, match by title and message rather than fingerprint.

> [!IMPORTANT]
>
> - ClickHouse only sees installs that emitted telemetry (primarily errors). Never use total ClickHouse install counts as the "all active users" denominator.
> - `deployment.environment = test` on all builds and `update_channel = stable` on beta builds are normal quirks—do not filter them out.

---

## Standard ClickHouse Queries

### Affected installs per item on a single version (2.9.0+)

```sql
WITH base AS (
  SELECT
    ResourceAttributes['service.state.id'] AS sid,
    SpanAttributes['error.title'] AS t,
    StatusMessage AS m,
    toString(Events.Attributes) AS st,
    SpanAttributes['context.gamemode'] AS gm
  FROM vortex.otel_traces
  WHERE Timestamp > '<release datetime>'
    AND SpanName = 'error.report'
    AND ResourceAttributes['service.version'] = '<version>'
)
SELECT
  uniqIf(sid, t = 'A plugin could not be parsed') AS item_a,
  uniqIf(sid, m LIKE '%insufficient space%' OR st LIKE '%ENOSPC%') AS item_b,
  uniq(sid) AS any_error
FROM base
```

### Comparing against pre-2.9.0 versions (session-based)

Versions prior to 2.9.0 do not have `service.state.id`; approximate sessions using `(process.pid, os.version, toDate(Timestamp))`. A zero on the older version can mean the error was reported under a different title—verify before calling it new.

```sql
WITH base AS (
  SELECT
    ResourceAttributes['service.version'] AS ver,
    (
      ResourceAttributes['process.pid'],
      ResourceAttributes['os.version'],
      toDate(Timestamp)
    ) AS ses,
    SpanAttributes['error.title'] AS t,
    StatusMessage AS m
  FROM vortex.otel_traces
  WHERE Timestamp > now() - INTERVAL 7 DAY
    AND SpanName = 'error.report'
    AND ResourceAttributes['service.version'] IN ('<previous stable>', '<stable>')
)
SELECT
  ver,
  uniq(ses) AS sessions,
  uniqIf(ses, t = 'Failed to fetch available extensions') AS item_a
FROM base
GROUP BY ver
```

### Cause landscape with 80/20 cut (used for priority ordering)

Normalises the first line of `StatusMessage` (masking quoted strings, file paths, URLs, and numbers) so identical causes across machines group into a single row:

```sql
SELECT
  cause,
  ev,
  installs,
  round(
    100 * sum(installs) OVER (ORDER BY installs DESC ROWS UNBOUNDED PRECEDING)
    / sum(installs) OVER (),
    1
  ) AS cum_pct
FROM (
  SELECT
    concat(
      replaceRegexpOne(SpanAttributes['error.title'], ' \\(\\d+ dependencies\\)$', ''),
      ' | ',
      substring(
        replaceRegexpAll(
          replaceRegexpAll(
            replaceRegexpAll(
              splitByChar('\n', StatusMessage)[1],
              '"[^"]*"|\'[^\']*\'',
              '"…"'
            ),
            '[A-Za-z]:[/\\\\][^,]*|[a-z0-9]+://[^ ,]*',
            '<path>'
          ),
          '\\d+',
          'N'
        ),
        1,
        90
      )
    ) AS cause,
    count() AS ev,
    uniq(ResourceAttributes['service.state.id']) AS installs
  FROM vortex.otel_traces
  WHERE Timestamp > '<release datetime>'
    AND SpanName = 'error.report'
    AND ResourceAttributes['service.version'] = '<version>'
  GROUP BY cause
)
ORDER BY installs DESC
LIMIT 60
```

To get the 80/20 head size and threshold directly, wrap the query above (using unrounded `cum_pct`):

```sql
SELECT
  countIf(cum_pct <= 80) AS causes_to_80,
  count() AS total,
  minIf(installs, cum_pct <= 80) AS threshold
FROM ( /* cause landscape query with unrounded cum_pct */ )
```

### Title landscape (coarser—for navigation only, never for priority)

A single error title can hide multiple distinct causes. Always break a title down by message and phase/kind attributes before making a triage decision.

```sql
SELECT
  g,
  ev,
  installs,
  sessions,
  round(
    100 * sum(installs) OVER (ORDER BY installs DESC ROWS UNBOUNDED PRECEDING)
    / sum(installs) OVER (),
    1
  ) AS cum_pct,
  msg
FROM (
  SELECT
    replaceRegexpOne(SpanAttributes['error.title'], ' \\(\\d+ dependencies\\)$', '') AS g,
    count() AS ev,
    uniq(ResourceAttributes['service.state.id']) AS installs,
    uniq(
      ResourceAttributes['process.pid'],
      ResourceAttributes['os.version'],
      toDate(Timestamp)
    ) AS sessions,
    substring(any(StatusMessage), 1, 120) AS msg
  FROM vortex.otel_traces
  WHERE Timestamp > '<release datetime>'
    AND SpanName = 'error.report'
    AND ResourceAttributes['service.version'] = '<version>'
  GROUP BY g
)
ORDER BY installs DESC
LIMIT 60
```
