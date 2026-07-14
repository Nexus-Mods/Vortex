-- @type setup

-- @name mods_pivot
-- @description Creates the mods pivot table
CALL level_pivot_create_table(
  'db', 'mods_pivot',
  'persistent###mods###{mod_id}###{attr}',
  ['mod_id', 'name', 'version', 'state'],
  column_types := ['VARCHAR', 'JSON VARCHAR', 'JSON VARCHAR', 'JSON VARCHAR']
);

-- @name profiles_pivot
-- @description Creates the profiles pivot table
CALL level_pivot_create_table(
  'db', 'profiles_pivot',
  'persistent###profiles###{profile_id}###{attr}',
  ['profile_id', 'name', 'gameId', 'lastActivated'],
  column_types := ['VARCHAR', 'JSON VARCHAR', 'JSON VARCHAR', 'JSON BIGINT']
);

-- @name profile_settings_pivot
-- @description Creates the profile-settings pivot table (activeProfileId lives at settings###profiles###activeProfileId)
CALL level_pivot_create_table(
  'db', 'profile_settings_pivot',
  'settings###{section}###{attr}',
  ['section', 'activeProfileId'],
  column_types := ['VARCHAR', 'JSON VARCHAR']
);

-- @name mod_attributes_pivot
-- @description Creates the mod-attributes pivot table (mod attributes live under persistent###mods###<game>###<mod>###attributes###*)
CALL level_pivot_create_table(
  'db', 'mod_attributes_pivot',
  'persistent###mods###{game_id}###{vortex_mod_id}###attributes###{attr}',
  ['game_id', 'vortex_mod_id', 'source', 'modId', 'fileId', 'downloadGame'],
  column_types := ['VARCHAR', 'VARCHAR', 'JSON VARCHAR', 'JSON BIGINT', 'JSON BIGINT', 'JSON VARCHAR']
);

-- @name mod_state_pivot
-- @description Creates the mod-state pivot table (state is a top-level mod field, not an attribute)
CALL level_pivot_create_table(
  'db', 'mod_state_pivot',
  'persistent###mods###{game_id}###{vortex_mod_id}###{attr}',
  ['game_id', 'vortex_mod_id', 'state'],
  column_types := ['VARCHAR', 'VARCHAR', 'JSON VARCHAR']
);
