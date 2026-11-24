# Mixpanel Recipes

Active-user baselines and trigger counts for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Policy for using them lives in [`triage.md`](triage.md).

The project, events, properties and query bodies are in the private recipe file `mixpanel.md`. [Fetch it](triage.md#private-recipes) before running any Mixpanel query; this file only names the recipes the skills refer to.

- **Partial days:** Today's DAU is a partial day—always compare against the last full weekday.

## Overall and Version Baselines

Overall DAU / WAU / MAU across all versions, DAU for one version, and cumulative users on a version since its release.

## Query Variations

Variations on the baseline query, including **per-game DAU** for the [single-game rate](triage.md#daily-rate-player-impact). Games are keyed by their numeric `NexusGameId`.

## Collection Installers

Counts how many users start a collection install per day, overall or per collection. Use this as context for bugs that only occur during collection installation—their [daily rate](triage.md#daily-rate-player-impact) is still scored against overall version DAU.

## Sizing a Bug by Its Trigger

When a bug raises no telemetry error, count the users who met its triggering condition and compare that count against the version's DAU.

- **Policy:** A trigger count measures **exposure, not confirmed harm**, and caps at `P2 Moderate`; see [`triage.md`](triage.md#daily-rate-player-impact).
