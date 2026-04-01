-- @type setup

-- @name store_games
-- @description Game installations detected by store scanners
CREATE TABLE IF NOT EXISTS store_games (
  store_type VARCHAR NOT NULL,
  store_id VARCHAR NOT NULL,
  install_path VARCHAR NOT NULL,
  name VARCHAR,
  store_metadata VARCHAR,
  PRIMARY KEY (store_type, store_id)
);
