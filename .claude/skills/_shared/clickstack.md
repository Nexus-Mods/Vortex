# ClickStack (ClickHouse) Recipes

Error and crash telemetry for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Policy for using it lives in [`triage.md`](triage.md).

The schema and the queries are in the private recipe file `clickstack.md`. [Fetch it](triage.md#private-recipes) before running any telemetry query; this file only names the recipes the skills refer to and the rules that apply to all of them.

## Rules for Every Query

- **Telemetry is not the userbase:** ClickHouse only sees installs that emitted telemetry (primarily errors). Never use its install counts as the "all active users" denominator; baselines come from [`mixpanel.md`](mixpanel.md).
- **Count installs, not events:** Score on distinct installs. Event volume only describes the shape of a failure.
- **Crashes are ranked separately:** Crash reports carry no install ID, so count sessions and keep them apart from the error causes.
- **Match across versions by title and message:** Fingerprints are per-build and do not carry over between versions.

## Recipes

### Cause landscape

Ranks distinct causes on one version by affected installs, grouping identical causes across machines by error title and normalised message. This is the unit every score is counted in.

### Title landscape (coarser—for navigation only, never for priority)

Ranks error titles by affected installs with a running share, to choose which groups to drill into. One title can hide several causes, so never score from it.

### Affected installs per item

Counts distinct installs for several items in one pass on a single version, and compares session rates against an older version to tell new bugs from inherited ones.

### Collections and mods a cause touches

Lists the collections and mods telemetry names on a cause, and checks whether the cause is tied to collection installs at all. Used to measure [content reach](triage.md#content-share-content-reach): a cause spread across many collections in proportion to their popularity is not specific to any of them (`C3`).

### Drill-downs and native crashes

Split a title by cause, test whether a failure repeats in every session, fetch sample stack traces, and rank native crashes. [`/triage-telemetry`'s reference](../triage-telemetry/reference.md) says when to use each.
