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
