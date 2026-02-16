-- @type select

-- @name recently_managed_games
-- @description Gets the 3 most recently managed games (excluding current)
-- @param current_game_id VARCHAR
SELECT
    p.profile_id,
    p.gameId AS game_id,
    p.name AS profile_name,
    p.lastActivated AS last_activated
FROM db.profiles_pivot p
WHERE p.gameId != $current_game_id
  AND p.lastActivated IS NOT NULL
  AND p.lastActivated > 0
ORDER BY p.lastActivated DESC
LIMIT 3;
