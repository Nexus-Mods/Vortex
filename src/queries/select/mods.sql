-- @type select

-- @name active_mods
-- @description Gets all active mods for a given profile
-- @param profile_id VARCHAR
SELECT m.mod_id, m.name, m.version, m.state
FROM mods_pivot m
WHERE m.state = 'installed';

-- @name mod_by_id
-- @description Gets a single mod by ID
-- @param mod_id VARCHAR
SELECT m.mod_id, m.name, m.version, m.state
FROM mods_pivot m
WHERE m.mod_id = $mod_id;
