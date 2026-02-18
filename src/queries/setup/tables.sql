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
  ['profile_id', 'name', 'gameId', 'lastActivated', 'modState', 'features', 'pendingRemove'],
  column_types := ['VARCHAR', 'JSON VARCHAR', 'JSON VARCHAR', 'JSON BIGINT', 'JSON VARCHAR', 'JSON VARCHAR', 'JSON BOOLEAN']
);
