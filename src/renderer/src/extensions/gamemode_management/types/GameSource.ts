/**
 * Which Games page list a user added a game from, recorded when the tile's add
 * action runs and reported on the app_game_manage event. Undefined when the add
 * started somewhere else (command line, extension install flows).
 */
export type GameSource = "detected_list" | "all_games";
