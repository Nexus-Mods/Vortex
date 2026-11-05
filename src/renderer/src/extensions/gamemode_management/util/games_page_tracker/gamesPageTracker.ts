import type { GameId } from "@vortex/shared";

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IGameSection } from "../../components/GameCard";

/** What started a Detected section scan: the header's refresh, or the panel's retry. */
export type ScanTrigger = "refresh" | "retry";

/**
 * How a scan ended. The two failures name the step that failed: discovery is the local
 * search, detection the request that matches what it found.
 */
export type ScanOutcome = "success" | "discovery_failed" | "detection_failed" | "cancelled";

/** Which layout the game was shown in: tiles (GameCard) or list rows (GameRow). */
export type TileLayout = "grid" | "list";

/**
 * Where on a game an action was run from: its lead button (on a tile's art, or a list
 * row's own buttons), or its menu (a tile's overflow, or a list row's details popover).
 */
export type TileActionPlacement = "primary" | "menu";

/**
 * The tile's lead button, named for what it shows: the label depends on the section, and
 * the game already in play opens its mods instead.
 */
export type TilePrimaryAction = "open" | "open_mods" | "add_game" | "manual_add";

/** What the lead button does in each section, the same whichever layout shows it. */
export const PRIMARY_ACTION_BY_SECTION: Record<IGameSection, TilePrimaryAction> = {
  added: "open",
  detected: "add_game",
  supported: "manual_add",
};

/**
 * Build a Games page analytics event, dropping `undefined` values so an optional prop is
 * left off rather than sent as null. profile_id / user_type ride along as super properties,
 * never here; so does game_id, except on an event about a game other than the one in play.
 */
const gamesPageEvent = (
  eventName: string,
  properties: Record<string, unknown> = {},
): MixpanelEvent => ({
  eventName,
  properties: Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ),
});

/**
 * Games page analytics (LAZ-1204). Components say what happened and the tracker owns the
 * event names and property shapes. Consent and queueing are the analytics extension's
 * concern, so nothing here checks either.
 */
export const createGamesPageTracker = (api: IExtensionApi) => {
  const track = (eventName: string, properties: Record<string, unknown> = {}) => {
    api.events.emit("analytics-track-mixpanel-event", gamesPageEvent(eventName, properties));
  };

  return {
    // One per scan the reader started, however it ended, so a per-user count is how often
    // people re-scan. A detection started at startup or login isn't theirs and isn't
    // reported. The counts are only set on success: `detected_count` is how many games
    // the section lists after it, and `new_detected_count` how many of those it didn't
    // list before, left off when there was no earlier successful detection to compare with.
    trackScanCompleted: (props: {
      trigger: ScanTrigger;
      outcome: ScanOutcome;
      duration_ms: number;
      detected_count?: number;
      new_detected_count?: number;
    }) => track("app_games_scan_completed", props),

    trackSortChanged: (props: { section: IGameSection; sort: string }) =>
      track("app_games_sort_changed", props),

    // `action` is a TilePrimaryAction for the lead button. For a menu row it's hide, show
    // or game_details for the tile's own rows, and the registered title for an action an
    // extension added, untranslated so one action doesn't split across languages.
    // `game_id` overrides the active-game super property: the tile's game is rarely the
    // one in play.
    trackTileAction: (props: {
      section: IGameSection;
      layout: TileLayout;
      placement: TileActionPlacement;
      action: string;
      game_id: GameId | null;
      game_store: string | null;
    }) => track("app_game_tile_action_clicked", props),
  };
};
