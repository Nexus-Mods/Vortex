# Collection Manifest Recipe

Inspects what a collection archive defines, for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Use it when a bug only affects collections with a specific makeup (such as mod rules or optional mods). Policy for scoring the result lives in [`triage.md`](triage.md#daily-rate-player-impact).

A collection's mod rules and optional flags live inside the `collection.json` file in its archive—neither telemetry nor the warehouse stores them directly, so the helper script downloads the archive and extracts the manifest.

- **Script:** [`scripts/collection-manifest.mjs`](scripts/collection-manifest.mjs)
- **Prerequisites:** `NEXUS_API_KEY` set in the environment, and repo dependencies installed (uses the bundled 7-Zip binary).
- **Cost:** One archive download per collection (archives are typically well under 1 MB).

```bash
node .claude/skills/_shared/scripts/collection-manifest.mjs <slug> <slug>@<revision>
```

If `@<revision>` is omitted, the script fetches the latest revision. It prints one JSON object per line (formatted below for readability):

```json
{
    "slug": "<slug>",
    "name": "<name>",
    "revision": 12,
    "mods": 350,
    "optionalMods": 0,
    "modRules": 12,
    "externalModRules": 0,
    "ruleTypes": { "after": 12 }
}
```

- **`externalModRules > 0` (add-on detection):** Counts `modRules` whose `source` or `reference` targets a mod that is **not** in this collection's own `mods` array—i.e. rules that order or conflict against mods from a parent collection installed in the same profile. Use this alongside the collection's name/description to tell whether a collection is an add-on extending another collection.

## Narrowing a Trigger Count

A [trigger count](mixpanel.md#sizing-a-bug-by-its-trigger) shows how many users met a bug's condition, not how many were in collections the bug could actually affect. To narrow it down:

1. Break the trigger count down by `collection_id` in Mixpanel and take the top collections that cover most of the volume.
2. Look up their slugs in the warehouse ([recipe](nao.md#slugs-for-collection-ids)).
3. Run `collection-manifest.mjs` on those slugs (pass `<slug>@<revision>` when an issue targets a specific revision, since rule counts can change between revisions).
4. Keep only the users in collections that have the required makeup (e.g. `modRules > 0` for a bug that drops mod rules).

**Reporting:**

- State what share of the total trigger count the checked collections cover.
- Even after narrowing, the result remains **exposure** (capped at `P2 Moderate`): it rules out users the bug could not harm, but does not prove the remaining users hit the failure.
