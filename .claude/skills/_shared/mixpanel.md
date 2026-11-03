# Mixpanel Recipes

Active-user baselines for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Policy for using them lives in [`triage.md`](triage.md).

- **Project:** `Nexus Mods` (Production)
- **Tool:** `Run-Query` with `report_type: "insights"`
- **Core event & property:** `app_launched`, filtered or broken down by `app_version`
- **Note:** Today's DAU is a partial day—always compare against the last full weekday.

## Overall DAU / WAU / MAU (last 8 days)

```json
{
    "name": "Vortex DAU/WAU/MAU overall",
    "metrics": [
        { "eventName": "app_launched", "measurement": { "type": "basic", "math": "dau" } },
        { "eventName": "app_launched", "measurement": { "type": "basic", "math": "wau" } },
        { "eventName": "app_launched", "measurement": { "type": "basic", "math": "mau" } }
    ],
    "chartType": "line",
    "unit": "day",
    "dateRange": { "type": "relative", "range": { "unit": "day", "value": 8 } }
}
```

## Query Variations

- **Version-specific DAU:** Add a version filter to the query above:
    ```json
    "filters": [
      { "type": "string", "propertyName": "app_version", "operator": "equals", "value": "<version>" }
    ]
    ```
- **Cumulative users since release:** Use `math: "unique"`, `chartType: "bar"`, and an absolute date range (`from` and `to` sit directly on `dateRange`; a nested `range` object is rejected):
    ```json
    "dateRange": { "type": "absolute", "from": "<release date>", "to": "<today>" }
    ```
- **Per-game DAU (for game-specific bugs):** Query event `app_game_launched` with the `app_version` filter, `math: "dau"`, broken down by `game_id` (numeric Nexus `GameId`):

    | `game_id` | Game              | `game_id` | Game      |
    | --------- | ----------------- | --------- | --------- |
    | `1704`    | Skyrim SE         | `120`     | Fallout 3 |
    | `1151`    | Fallout 4         | `100`     | Morrowind |
    | `130`     | Fallout New Vegas | `101`     | Oblivion  |
    | `4187`    | Starfield         | `3333`    | BG3       |
    | `110`     | Skyrim            | `952`     | Cyberpunk |
