# Shared chunk — workflow lifecycle markers

Load when a mode threads an entity through its lifecycle: trace (§E),
collection-install (§F). Anchors plus the IDs that thread one entity top-to-bottom.

- **Download:** `start download mod {urlStr}` → `starting download {encodedUrl, dest,
collationId}` → `download resolved` → (MAIN) `queuing download {downloadId}` →
  `download starting {downloadId}` → `download completed {downloadId}`. Thread on
  **downloadId**, **collationId** (groups a collection's downloads), or the nxm url
  (`nxm://<game>/mods/<modId>/files/<fileId>`). Failure: `[ERRO]` / `download failed`.
- **Install (per mod):** `start mod install {id}` → `mod id for newly installed mod
{archivePath, modId}` → `installing to {modId, destinationPath}` → `extracting mod
archive` → `invoking installer {installer}` → `finish mod install {id, outcome}` →
  `Installation completed successfully {installId, modId, duration}` → `Mod installed,
scheduling debounced health check`. Thread on **modId** (= `id`, e.g.
  `Atomic Lust-31853-2-7b-…`) / **archivePath** / **installId**. Dependencies:
  `start/done installing dependencies {modId}`; recommendations similarly.
- **Collection:** `starting install of collection {totalMods, missing}` (InstallDriver)
  → member installs (each an install sequence above) + `add collection rule {…}` →
  `did install dependencies {gameId, modId}` → `postprocess collection`
  (postprocessCollection). All `[RENDERER]`, no `[collections]` prefix. For the
  install-completion invariants (every member terminal, no requeue loop, phases advance,
  error paths settle) and their bug signatures, see §F (`modes/collection-install.md`).
- **Deploy:** `deployment progress {text, percent}` steps through `Loading deployment
manifest` → `Running pre-deployment events` → `Checking for external changes` →
  `Starting deployment` → `Sorting mods` → `Running post-deployment events`, then final
  `deployment {added, removed, "source changed", modified}`. Purge:
  `[mod-dependency-manager] starting purge activity` → `finished purge activity in N
seconds`.
