# API Changelog

All notable changes to the vortex-api will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A JSON Schema for `info.json`, published as `@nexusmods/vortex-api/schemas/info.schema.json`, and an [`info.json` reference](./docs/INFO-JSON.md) covering every field, including `contributes`. Add `"$schema": "https://unpkg.com/@nexusmods/vortex-api/schemas/info.schema.json"` to your `info.json` for editor completion
- `GameUid`, the id of a game in the Nexus Mods game catalogue, with its brander
- `IMainPageOptions`: `menuIcon` property, a Material Symbol by name (such as `"settings"`) or an SVG path as `{ path }`, for the page's icon in the menu. A misspelled symbol name fails the typecheck
- Game info entries from `registerGameInfoProvider` accept `type: "path"`, shown as a link that opens the file or folder. The built-in `game-path` entry uses it
- `IPartialReducerSpec<T>`, for a reducer that shares its state slice with other reducers at the same path: it supplies defaults only for the fields it owns, and is marked `partial: true`
- `StatePath`, `StateSlice<TState, P>` and `ReducerSpecFor<P>`, the types `registerReducer` uses to match a spec to the state at its path
- `util.actionsToReducerSpec` and `util.actionsToPartialReducerSpec`, which build a reducer spec from your action creators with each handler's payload typed from its action, so a spec needs no `as any` keys - see the [reducer section of the migration guide](./docs/MIGRATION.md#vortex-2x-typed-registerreducer)
- `util.setField`, which sets one field of a slice and keeps the same state when the value is unchanged

### Removed

- `IGame.overrides` is removed, along with the `setGameDisabled` and `clearGameDisabled` actions and `session.gameMode.disabled`. Nothing used it, so it goes without the usual two-release window. A registration that still sets `overrides` registers and is managed like any other, and two games discovered at the same path can both be managed - see the [migration guide](./docs/MIGRATION.md#vortex-2x-igameoverrides)
- `util.steam` and `util.epicGamesLauncher`, deprecated in 2.8, are removed as of 2.11; call `GameStoreHelper` directly. An extension that still uses either gets `undefined` and throws a `TypeError` - see the [game store section of the migration guide](./docs/MIGRATION.md#vortex-2x-utilsteam-and-utilepicgameslauncher)
- `@mdi/js` is no longer a production dependency of Vortex, so an extension that `require`d it at runtime instead of bundling its own copy will fail to load. Bundle it, or use `menuIcon` and Material Symbols

### Deprecated

- `IMainPageOptions.mdi` is deprecated in favour of `menuIcon: { path }`. It still works, as a `menuIcon` path
- The `react-markdown` 6 props that 9 dropped (`transformLinkUri`, `transformImageUri`, `linkTarget`, and the ones 6 had already deprecated, such as `renderers` and `source`) log a deprecation warning. `transformLinkUri` and `transformImageUri` still run, and `plugins` runs as `remarkPlugins`, as it did in 6; the rest are ignored - see the [react-markdown section of the migration guide](./docs/MIGRATION.md#vortex-2x-react-markdown-9)
- A filesystem path in a game info entry with `type: "url"` is deprecated in favour of `type: "path"`. It still opens as a path, in the game info popover and the game details dialog, and logs a warning naming the provider

### Changed

- React peer dependency upgraded to 18.3.1; `@types/react` and `@types/react-dom` peer dependencies are now 18. Extension source may need type-level fixes on next rebuild (explicit `children` props, removed type aliases) - see the [React 18 section of the migration guide](./docs/MIGRATION.md#vortex-2x-react-18)
- `react-markdown` supplied at runtime is now 9.1.0 instead of 6.0.3. Every way of importing 6 still works. Links only open if they go to a web page or an email address, images from network shares don't load, and remark or rehype plugins made for 6 are dropped when they throw. Custom components no longer get 6's `inline`, `level`, `ordered`, `index`, `checked` or `isHeader` props - see the [react-markdown section of the migration guide](./docs/MIGRATION.md#vortex-2x-react-markdown-9)
- `IExtensionContext` registration surfaces and `IMainPage` now use `React.FC` instead of the removed `React.StatelessComponent` (source-compatible)
- `registerReducer` checks its spec against the state at its path. A path the state interfaces don't declare, or a spec whose type doesn't match the slice, now fails the typecheck. Runtime behaviour is unchanged, and already-built extensions keep working. Declare your slice by augmenting the state interfaces - see the [reducer section of the migration guide](./docs/MIGRATION.md#vortex-2x-typed-registerreducer)
- `actions.showURL` takes all four arguments (`url`, `instructions`, `subscriber`, `skippable`); pass `undefined` for the ones you don't use. Previously only `url` was required. Runtime behaviour is unchanged
- In the Mods page's beta view, a `registerTableAttribute("mods", …)` column that leaves `isDefaultVisible` unset starts hidden, and one that leaves `isToggleable` unset can be shown or hidden by the user, so `setAttributeVisible` no longer shows or hides it there. To keep the classic view's behaviour, set whichever flag you left unset: `isToggleable: false` on a column the classic view doesn't let the user hide, so it stays unhideable and `setAttributeVisible` shows or hides it, or `isDefaultVisible: true` on one they can, so it starts shown. `isDefaultVisible: true` alone on a column that leaves `isToggleable` unset starts it shown, but the user can still hide it and `setAttributeVisible` doesn't reach it. The classic view is unchanged

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
