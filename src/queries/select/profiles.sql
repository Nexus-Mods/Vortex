-- @type select

-- @name recently_managed_games
-- @description Gets the 3 most recently managed games (excluding current)
-- @param current_game_id VARCHAR
SELECT
    p.profile_id,
    trim(p.gameId, '"') AS game_id,
    trim(p.name, '"') AS profile_name,
    p.lastActivated AS last_activated
FROM db.profiles_pivot p
WHERE trim(p.gameId, '"') != $current_game_id
  AND p.lastActivated IS NOT NULL
  AND CAST(p.lastActivated AS BIGINT) > 0
ORDER BY CAST(p.lastActivated AS BIGINT) DESC
LIMIT 3;
