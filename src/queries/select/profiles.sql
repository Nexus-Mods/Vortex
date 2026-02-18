-- @type select

-- @name recently_managed_games
-- @description Gets the 3 most recently managed games (excluding current)
-- @param current_game_id VARCHAR
SELECT
    p.gameId AS game_id
FROM db.profiles_pivot p
WHERE p.gameId != $current_game_id
  AND p.lastActivated IS NOT NULL
  AND p.lastActivated > 0
GROUP BY p.gameId
ORDER BY MAX(p.lastActivated) DESC
LIMIT 3;

-- @name all_profiles
-- @description Full profile data for Redux sync
SELECT profile_id, name, gameId, lastActivated, modState, features, pendingRemove
FROM db.profiles_pivot;

-- @name profiles_for_game
-- @description Profiles for a specific game
-- @param game_id VARCHAR
SELECT profile_id, name, gameId, lastActivated, features, pendingRemove
FROM db.profiles_pivot WHERE gameId = $game_id AND (pendingRemove IS NULL OR pendingRemove = false);

-- @name active_profile
-- @description Single profile with full data
-- @param profile_id VARCHAR
SELECT profile_id, name, gameId, lastActivated, modState, features
FROM db.profiles_pivot WHERE profile_id = $profile_id;
