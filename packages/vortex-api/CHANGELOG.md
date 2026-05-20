# API Changelog

All notable changes to the vortex-api will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [v2.0.0]

### Added

- New selectors: `activeProfileId`, `nextProfileId`, `profiles`, `lastActiveProfiles`, `enabledModCountForProfile`, `discovered`, `userInfo`, `isPremium`, `shouldShowPremiumAd`, `isAnalyticsEnabled`, `isTelemetryEnabled`, `mainPage`, `secondaryPage`, `notifications`
- New action creator: `setUseModernLayout`
- New telemetry event classes: `CollectionsDraftedEvent`, `CollectionsDraftUploadedEvent`, `CollectionsDraftUpdateUploadedEvent`
- New interfaces: `IProgressProfile`, `IProgressProfileDeploying`, `IProgressWithProfile` for deploy progress tracking
- New type: `PropsCallbackTyped<T>` as a typed variant of `PropsCallback`
- New function: `withTrackedActivity<T>` for activity tracing
- `runElevated` and `runThreaded` now directly exported (previously re-exports from `vortex-run`)
- `IActionOptions` and `IMainPageOptions`: `isClassicOnly` and `isModernOnly` properties for layout filtering
- `IMainPageOptions`: `mdi` property for icon support
- `ISettingsInterface`: `primaryTool` and `tools` properties
- `IWindow`: `useModernLayout` property
- `ISteamEntry`: `compatDataPath`, `protonPath`, `usesProton` properties for Proton support
- `IState.persistent.healthCheck` and `IState.session.healthCheck` state
- `UserCanceled` now exposes a `skipped` property

### Changed

- Package renamed from `vortex_devel` to `@vortex/renderer`; entry point changed from `index.d.ts` to `api.d.ts`
- `runElevated` has a new signature: `(ipcPath, func, args?) => Promise<string>` using `IElevatedIpc`
- `Icon` converted from class component to `FC<IIconProps>`
- `DNDContainer` converted from class component to `FC<IDNDContainerProps>`
- `MainPage` converted from class to const with `.Body` and `.Header` statics
- `Debouncer` now extends `GenericDebouncer` base class
- `UserCanceled` changed from opaque constructor to a proper class extending `Error`
- All `Archive` getters now return `| undefined`
- `ReduxProp.calculate()` return type widened from `T` to `T | undefined`
- `IGameStore.getGameStorePath` return type widened from `string` to `string | undefined`
- `IGameStoreEntry.gameStoreId` type widened from `string` to `string | undefined`
- `MissingInterpreter.url` and `SetupError.component` return types widened to `string | undefined`
- `IPersistor` method return types changed from `Promise` to `PromiseLike`
- `IDialogContent.parameters` type tightened from `any` to `Record<string, string | number>`
- `PropsCallback` type tightened from `() => any` to `() => { [key: string]: unknown }`
- `log` parameter `level` changed from `LogLevel` to `Level`, `metadata` from `any` to `unknown`
- `terminate` parameter `error` changed from `IError` to `ReportableError`
- Multiple selectors tightened from `any` state to `IState`
- Broad Bluebird to native Promise migration across `fs` namespace

### Deprecated

- `makeRemoteCall` now returns `never` and is marked `@deprecated`. Use `window.api` instead
- `log` function in `vortex-api/util/log` marked `@deprecated`. Import `log` directly from `vortex-api` or use `window.api.log(level, message, metadata)` instead
- `IExtensionContext.onceMain` marked `@deprecated`. We discourage calling code on Main, since extensions are no longer executing on it.

### Removed

- `bundleAttachment` function removed
- `extend` function (extensible component factory) removed
- `Tailwind` export (SVG paths, tab/form/button components, typography) removed

[v2.0.0]: https://github.com/Nexus-Mods/vortex-api/compare/v1.16.4...v2.0.0
