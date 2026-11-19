# Warehouse Recipes (nao)

Content-reach queries for [`/triage-issues`](../triage-issues/SKILL.md) and [`/triage-telemetry`](../triage-telemetry/SKILL.md). Policy for scoring the results lives in [`triage.md`](triage.md#content-share-content-reach).

The tables and the queries are in the private recipe file `nao.md`. [Fetch it](triage.md#private-recipes) before running any warehouse query; this file only names the recipes the skills refer to.

- **Setup:** `nao` is a personal MCP connector; see [Prerequisites in `triage.md`](triage.md#prerequisites) if `mcp__nao__execute_sql` is missing.

> [!IMPORTANT]
> A collection download share is a relative weight for the content, never a headcount of affected players. Use the [collection installers](mixpanel.md#collection-installers) count when you need player numbers.

## Content share of named collections

Gives both the individual collection's share (`collection_share_pct` / `collection_share_of_game_pct`) and its curator's combined share across all their live collections (`curator_share_pct` / `curator_share_of_game_pct`), plus `curator_tier` and `game_share_pct`, for the collections named by the issue, telemetry, or the community team.

- Identify a collection by its slug or id; collection names are not unique, even within one game.
- Use **`curator_share_pct`** (summed across **distinct** creators so one creator with two matched collections counts once) when the bug blocks a creator workflow or affects a curator's main collection(s); use **`collection_share_pct`** when the bug is isolated to a single optional add-on collection ([policy](triage.md#content-share-content-reach)).

## Content share of a named curator

Use when an issue names a curator rather than a collection. A name lookup can miss renames, so treat a match as **reported (pending link)** (held at `C2 Moderate` until a specific collection is linked in telemetry or reproduced).

## A mod's share and dependents

Gives the share of reporting Vortex users with a mod enabled, platform-wide and within its game, plus how many other mods require it and how many live collections include it.

- When an issue affects several mods, take the **largest** share rather than summing them (summing double-counts users who have more than one enabled).
- Report the dependent-mod and collection counts alongside the share.

## Game share of reporting Vortex users

Gives a game's 30-day share of all reporting Vortex users (keyed by numeric `NexusGameId`), used for the [single-game player-impact floor](triage.md#single-game-rate-rules) when players launch the game outside Vortex (e.g. directly through Steam).

## Slugs for collection ids

Turns the collection ids that Mixpanel reports into the slugs the [manifest script](collection-manifest.md) takes.
