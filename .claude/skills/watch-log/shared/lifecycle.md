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
seconds`. External changes: `found external changes {automated, user}` (`[INFO]`) +
  `external changes diagnostic {surfaced: [{typeId, filePath, source, changeType}]}`
  (`[DEBG]`), only when `user > 0`; the dialog blocks, no `Starting deployment` until
  answered. Bulk `changeType: "srcdeleted"` = staging sources gone.
- **Profile switch:** `profile change {from, to}` (grep `profile change {`) → `removing
  info of missing mod from profile {profile, game, modId}` (burst = mod table / profile
  desync) → `will deploy pending profile "<id>"` (cross-game, incoming profile not its
  game's last active, game has undeployed changes) → `starting refresh profile export` →
  `will deploy previously active profile "<id>"` (same-game only) → `will deploy next
  active profile "<id>"` (not when returning to a game's last active profile) → `switched
  to profile {gameId, current}` (`switched to no profile` on deactivate). Thread on `from`
  / `to` / `current`. A skipped deploy logs neither `will` nor `did deploy`; `will` without
  `did` = the deploy failed and the switch was cancelled: `Failed to set profile`
  (`[ERRO]`/`[WARN]`). `active profile switch didn't get confirmed?` (`[WARN]`) =
  confirmation timed out, the switch stands. Cross-game only: `running checks {event:
"gamemode-activated", count}` → `all checks completed`, and `manual mod changed
  {stagingFolder, addedMods, removedMods}` (`[WARN]`, staging folders changed behind
  Vortex; a dialog asks whether to apply).
