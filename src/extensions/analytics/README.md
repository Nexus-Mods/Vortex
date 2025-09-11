```mermaid

flowchart LR
    Start --> Stop


```

Mods

mods_download_started
mods_download_completed
mods_download_failed
mods_download_cancelled

mods_installation_started
mods_installation_completed
mods_installation_failed
mods_installation_cancelled

Collections

collections_download_started { collection_id, revision_id, game_id, mod_count } // server side
collections_download_completed { collection_id, revision_id, game_id, file_size, duration_ms }
collections_download_failed { collection_id, revision_id, game_id, error_code, error_message };
collections_download_cancelled { collection_id, revision_id, game_id }

collections_installation_started { collection_id, game_id, revision_id, mod_count }
collections_installation_completed { collection_id, revision_id, game_id, mod_count, duration_ms }
collections_installation_failed { collection_id, revision_id, error_code, error_message, game_id, }
collections_installation_cancelled { collection_id, revision_id, game_id }