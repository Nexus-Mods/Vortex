-- @type select

-- @name all_store_games
-- @description All game installations detected by store scanners
SELECT store_type, store_id, install_path, name, store_metadata
FROM store_games
ORDER BY store_type, name
