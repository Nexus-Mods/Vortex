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
- **Never-finished downloads** — a download that never terminates (app killed / hung socket) emits
  no terminal event, so it can only be inferred as funnel leakage (`started` − terminal), never
  counted directly.
- **Pauses / resumes / retries are invisible** — a `started → completed` pair does not reveal
  whether the download paused, resumed, was auto-resumed after a restart, or retried at the socket
  level. It reflects that the file eventually downloaded, not that it did so in one clean attempt.

## Download Success Rating (KPI)

A day-to-day / month-to-month reliability KPI, computed in Mixpanel from the download events.

| Metric                                 | Formula                                    | Notes                                                                                                                                         |
| -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Download Success Rating** (headline) | `completed / (completed + failed)`         | Excludes user cancels (not a failure) and never-finished (no terminal event). Uses only reliable terminal events — no event pairing required. |
| Intent completion (abandonment proxy)  | `completed / mods_download_started_client` | Gap absorbs fails, cancels, and never-finished.                                                                                               |

**Event pairing / accuracy.** Every download event carries a `download_id` — a unique per-attempt
id (`randomUUID`, stable across pause/resume, fresh on re-download). Funnels should pair
`started → completed`/`failed` on `download_id`, **not** on `mod_id`/`file_id` (which identify the
file, not the attempt, and mis-pair re-downloads). The count-based headline rating needs no pairing;
a `download_id`-keyed funnel can be built to cross-check it and the two should agree.

**`started` fires on first byte, not initiation.** `mods_download_started_client` is emitted the
first time bytes are received, so connect-time failures (DNS/403/dead CDN/timeout before any data)
fire `failed` with **no** matching `started`. Consequences: (1) a `started → completed` funnel's
denominator omits those failures and reads high; (2) `failed` events can exceed `started` events.
The headline `completed / (completed + failed)` rating is unaffected — it counts terminal events and
never depends on `started`. Prefer it over a `started`-anchored funnel for the reliability number.

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

| Event                                | Fired when                                                                                                                                                 | Properties                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `collection_drafted`                 | A collection draft is created — from a profile or quick-collection (`createCollectionFromProfile.ts:178`), or an empty draft (`collections/index.ts:267`). | `collection_name`, `game_name`, `creation_method`                                       |
| `collection_draft_uploaded`          | A **new** draft collection is uploaded for the first time (`collectionExport.ts:328`).                                                                     | `collection_name`, `game_name`                                                          |
| `collection_draft_updated`           | An **existing** draft collection is re-uploaded/updated (`collectionExport.ts:328`).                                                                       | `collection_name`, `game_name`                                                          |
| `collections_download_clicked`       | User clicks to download a collection in the in-app browser (`BrowseNexusPage.tsx:140`). No `download_id` (fired pre-download, not via `#emitAnalytics`).   | `collection_slug`, `game_id`                                                            |
| `collections_download_completed`     | The collection archive **download** (network transfer) finishes (`IPCDownloadAdapter.ts`).                                                                 | `download_id`, `collection_id`, `revision_id`, `game_id`, `file_size`, `duration_ms`    |
| `collections_download_cancelled`     | The collection archive download is cancelled (`IPCDownloadAdapter.ts`).                                                                                    | `download_id`, `collection_id`, `revision_id`, `game_id`                                |
| `collections_download_failed`        | The collection archive download fails (`IPCDownloadAdapter.ts`).                                                                                           | `download_id`, `collection_id`, `revision_id`, `game_id`, `error_code`, `error_message` |
| `collections_installation_started`   | **Installation of the whole collection** begins — its required-mod batch starts installing (`InstallDriver.ts:896`).                                       | `collection_id`, `revision_id`, `game_id`, `mod_count`                                  |
| `collections_installation_completed` | The full collection batch finishes installing (`InstallDriver.ts:712`).                                                                                    | `collection_id`, `revision_id`, `game_id`, `mod_count`, `duration_ms`                   |
| `collections_installation_failed`    | The collection install fails (`InstallDriver.ts:153`).                                                                                                     | `collection_id`, `revision_id`, `game_id`, `error_code`, `error_message`                |
| `collections_installation_cancelled` | _(Class exists; no active firing site found in source.)_                                                                                                   | `collection_id`, `revision_id`, `game_id`                                               |

## Mod events

Download events fire from `IPCDownloadAdapter.ts` (routes individual mod files, skips collection
archives); installation events fire from `InstallContext.ts` per single archive, and are **not**
sent for a collection's bundle/manifest mod. Mods downloaded/installed as part of a collection carry
the parent's `collection_id`, otherwise `null`.

| Event                          | Fired when                                                                                                                                                                                                                                                                                   | Properties                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `mods_download_started_client` | A single mod file download receives its **first byte** (client-side; complements the server-side event) — `IPCDownloadAdapter.ts`. ⚠️ Fires on first byte, **not** at initiation: a download that fails to connect (DNS/403/dead CDN/timeout) emits `failed` with **no** matching `started`. | _(base)_                                              |
| `mods_download_completed`      | The mod file download (network transfer) finishes (`IPCDownloadAdapter.ts`).                                                                                                                                                                                                                 | _(base)_ + `file_size`, `duration_ms`                 |
| `mods_download_cancelled`      | The mod file download is cancelled (`IPCDownloadAdapter.ts`).                                                                                                                                                                                                                                | _(base)_                                              |
| `mods_download_failed`         | The mod file download fails (`IPCDownloadAdapter.ts`).                                                                                                                                                                                                                                       | _(base)_ + `error_code`, `error_message`              |
| `mods_installation_started`    | **Installation of one mod archive** begins — the mod record is created with `state: "installing"` and extraction/installer work starts (`startInstallCB`, `InstallContext.ts:275`).                                                                                                          | `mod_id`, `file_id`, `game_id`, `mod_uid`, `file_uid` |
| `mods_installation_completed`  | The mod reaches `state: "installed"` (extracted to staging + registered) — `success` outcome (`InstallContext.ts:407`). `duration_ms` = install operation only.                                                                                                                              | _(base)_ + `duration_ms`                              |
| `mods_installation_cancelled`  | The install is cancelled — `canceled` outcome (`InstallContext.ts:452`).                                                                                                                                                                                                                     | _(base mod props)_                                    |
| `mods_installation_failed`     | The install fails — default/error outcome; partially-added mod is removed (`InstallContext.ts:481`).                                                                                                                                                                                         | _(base)_ + `error_code`, `error_message`              |

_Base mod props = `mod_id`, `file_id`, `game_id`, `mod_uid`, `file_uid`. **Download** events additionally include `download_id` and `collection_id`; **installation** events do not._

## Health check event

| Event                   | Fired when                                                                                                | Properties                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `health_check_feedback` | User gives 👍/👎 feedback on a missing-requirement health check (`HealthCheckDetailPage.tsx:107 / :117`). | `feedback_type`, `game_id`, `mod_id`, `required_by_mod_id`, `feedback_reasons` (negative only) |

## Notes

- **`collections_installation_cancelled`** has a class defined but no active emission site.
- All events (including the three `collection_draft*` events) are emitted via their `MixpanelEvent`
  classes with `new ...Event(...)`, so the class constructors are the single source of truth for
  each event's name and properties.
