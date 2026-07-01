# Vortex Mixpanel Events

All events are defined in `src/renderer/src/extensions/analytics/mixpanel/MixpanelEvents.ts` and
dispatched through the `analytics-track-mixpanel-event` API event, handled in
`src/renderer/src/extensions/analytics/index.ts`. Events are only sent when the user is **logged in**
and has **opted into analytics** (`isUserSet()` in `MixpanelAnalytics.ts`).

Every event carries these super properties: `user_type`, `platform_type` (`"app"`),
`app_name` (`"Vortex"`), `app_version`.

## Lifecycle / funnel

Getting content into a game runs through four stages. Mixpanel tracks the first two; the last two
are largely invisible to it.

```
download ──────────→ install ─────────────────→ [enable] ──→ deploy
(network transfer)   (extract to staging +       (user/auto)   (link into
                      register in mod list)                     game folder)
   ▲                        ▲                        ✗              ✗
mods_download_*      mods_installation_*        no event        no event
collections_download_*  collections_installation_*
```

- **Download** — fetching the archive from Nexus Mods to local disk (`IPCDownloadAdapter.ts`).
  Purely the network transfer; nothing extracted yet. `file_size` / `duration_ms` measure this.
- **Install** — extracting the downloaded archive into the mod's **staging folder**
  (`path.join(stagingFolder, mod.installationPath)`, `InstallManager.ts:2274`), running the
  installer logic, and registering the mod (`state: "installing"` → `"installed"`). Files live in
  staging only — **not** in the game directory. `finishInstallCB("success")` fires
  `mods_installation_completed`; `duration_ms` covers only this operation.
- **Enable** _(untracked)_ — a freshly installed mod isn't necessarily active. The success
  notification offers an **"Enable All"** action (`InstallContext.ts:435`); only enabled mods get
  deployed. Collections auto-enable their mods; a manually-installed single mod may sit
  installed-but-disabled.
- **Deploy** _(untracked)_ — links/copies staged files into the game folder. Scheduled _after_
  installs settle via `scheduleDeployOnPhaseSettled` (`InstallManager.ts:3365`), runs in
  **batches per phase** (not per mod), and blocks new installs while running (`isDeploying`,
  `InstallManager.ts:2390`). **No `mods_deployed` / `deployment_*` event exists.**

> **Implication for analysis:** `mods_installation_completed` means the mod is extracted, staged,
> and known to Vortex — **not** that it's live in the game. The final mile (enable + deploy) cannot
> be measured in Mixpanel today.

### Known measurement gaps

- **No deployment event** — the final "link into game folder" step is untracked (see funnel above).
- **Download reliability** — a `started` → `completed` pair fires `started` only once (guarded by a
  `startedEventEmitted` flag, `IPCDownloadAdapter.ts:738`). Pauses/resumes and app-restart recoveries
  are silently absorbed; automatic network/5xx retries happen in the main process and are never
  reported to the renderer. So a start→complete pair reflects _user intent to download_, not a
  single clean uninterrupted attempt.

### Two granularities of "installation"

|                                  | What "installation" wraps                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`mods_installation_*`**        | Installing **one single archive** (one mod file). Fired once per mod. Explicitly **skipped** for a collection's own bundle/manifest archive (`!isCollection` guard). |
| **`collections_installation_*`** | Installing **the whole collection** — its entire batch of required mods as one unit. `mod_count` = number of required mods.                                          |

Installing a 20-mod collection produces **one** `collections_installation_started` / `_completed`
pair _plus up to_ 20 individual `mods_installation_*` pairs.

## App events

| Event          | Fired when                                                                                      | Properties                           |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| `app_launched` | Analytics starts up — on login, or on app launch if already opted-in (`analytics/index.ts:90`). | `$os`, `$os_version`, `architecture` |

## Collection events

| Event                                | Fired when                                                                                                                                                 | Properties                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `collection_drafted`                 | A collection draft is created — from a profile or quick-collection (`createCollectionFromProfile.ts:178`), or an empty draft (`collections/index.ts:267`). | `collection_name`, `game_name`, `creation_method`                        |
| `collection_draft_uploaded`          | A **new** draft collection is uploaded for the first time (`collectionExport.ts:328`).                                                                     | `collection_name`, `game_name`                                           |
| `collection_draft_updated`           | An **existing** draft collection is re-uploaded/updated (`collectionExport.ts:328`).                                                                       | `collection_name`, `game_name`                                           |
| `collections_download_clicked`       | User clicks to download a collection in the in-app browser (`BrowseNexusPage.tsx:140`).                                                                    | `collection_slug`, `game_id`                                             |
| `collections_download_completed`     | The collection archive **download** (network transfer) finishes (`IPCDownloadAdapter.ts:329`).                                                             | `collection_id`, `revision_id`, `game_id`, `file_size`, `duration_ms`    |
| `collections_download_cancelled`     | The collection archive download is cancelled (`IPCDownloadAdapter.ts:364`).                                                                                | `collection_id`, `revision_id`, `game_id`                                |
| `collections_download_failed`        | The collection archive download fails (`IPCDownloadAdapter.ts:396`).                                                                                       | `collection_id`, `revision_id`, `game_id`, `error_code`, `error_message` |
| `collections_installation_started`   | **Installation of the whole collection** begins — its required-mod batch starts installing (`InstallDriver.ts:896`).                                       | `collection_id`, `revision_id`, `game_id`, `mod_count`                   |
| `collections_installation_completed` | The full collection batch finishes installing (`InstallDriver.ts:712`).                                                                                    | `collection_id`, `revision_id`, `game_id`, `mod_count`, `duration_ms`    |
| `collections_installation_failed`    | The collection install fails (`InstallDriver.ts:153`).                                                                                                     | `collection_id`, `revision_id`, `game_id`, `error_code`, `error_message` |
| `collections_installation_cancelled` | _(Class exists; no active firing site found in source.)_                                                                                                   | `collection_id`, `revision_id`, `game_id`                                |

## Mod events

Download events fire from `IPCDownloadAdapter.ts` (routes individual mod files, skips collection
archives); installation events fire from `InstallContext.ts` per single archive, and are **not**
sent for a collection's bundle/manifest mod. Mods downloaded/installed as part of a collection carry
the parent's `collection_id`, otherwise `null`.

| Event                          | Fired when                                                                                                                                                                          | Properties                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `mods_download_started_client` | A single mod file **download** starts (client-side; complements the server-side event) — `IPCDownloadAdapter.ts:311`.                                                               | `mod_id`, `file_id`, `game_id`, `mod_uid`, `file_uid`, `collection_id` |
| `mods_download_completed`      | The mod file download (network transfer) finishes (`IPCDownloadAdapter.ts:345`).                                                                                                    | _(base)_ + `file_size`, `duration_ms`                                  |
| `mods_download_cancelled`      | The mod file download is cancelled (`IPCDownloadAdapter.ts:378`).                                                                                                                   | _(base mod props)_                                                     |
| `mods_download_failed`         | The mod file download fails (`IPCDownloadAdapter.ts:412`).                                                                                                                          | _(base)_ + `error_code`, `error_message`                               |
| `mods_installation_started`    | **Installation of one mod archive** begins — the mod record is created with `state: "installing"` and extraction/installer work starts (`startInstallCB`, `InstallContext.ts:275`). | `mod_id`, `file_id`, `game_id`, `mod_uid`, `file_uid`                  |
| `mods_installation_completed`  | The mod reaches `state: "installed"` (extracted to staging + registered) — `success` outcome (`InstallContext.ts:407`). `duration_ms` = install operation only.                     | _(base)_ + `duration_ms`                                               |
| `mods_installation_cancelled`  | The install is cancelled — `canceled` outcome (`InstallContext.ts:452`).                                                                                                            | _(base mod props)_                                                     |
| `mods_installation_failed`     | The install fails — default/error outcome; partially-added mod is removed (`InstallContext.ts:481`).                                                                                | _(base)_ + `error_code`, `error_message`                               |

_Base mod props = `mod_id`, `file_id`, `game_id`, `mod_uid`, `file_uid` (download events also include `collection_id`)._

## Health check event

| Event                   | Fired when                                                                                                | Properties                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `health_check_feedback` | User gives 👍/👎 feedback on a missing-requirement health check (`HealthCheckDetailPage.tsx:107 / :117`). | `feedback_type`, `game_id`, `mod_id`, `required_by_mod_id`, `feedback_reasons` (negative only) |

## Notes

- **`collections_installation_cancelled`** has a class defined but no active emission site.
- All events (including the three `collection_draft*` events) are emitted via their `MixpanelEvent`
  classes with `new ...Event(...)`, so the class constructors are the single source of truth for
  each event's name and properties.
