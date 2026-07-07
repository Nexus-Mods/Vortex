-- @type select

-- @name active_profile_nexus_files
-- @description Lists gameId/modId/fileId for every installed Nexus mod file of the currently active profile's game
SELECT
    coalesce(ma.downloadGame, ma.game_id) AS game_id,
    ma.modId  AS mod_id,
    ma.fileId AS file_id,
    ma.vortex_mod_id
FROM db.profile_settings_pivot ps
JOIN db.profiles_pivot pr ON pr.profile_id = ps.activeProfileId
JOIN db.mod_attributes_pivot ma ON ma.game_id = pr.gameId
JOIN db.mod_state_pivot ms ON ms.game_id = ma.game_id
  AND ms.vortex_mod_id = ma.vortex_mod_id
WHERE ps.section = 'profiles'
  AND ma.source = 'nexus'
  AND ms.state  = 'installed'
ORDER BY game_id, mod_id, file_id;
