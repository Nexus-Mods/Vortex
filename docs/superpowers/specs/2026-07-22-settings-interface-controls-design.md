# Settings Interface — migrate non-toggle controls to design-system components

## Context

Following the Settings page shell migration (new `Page` + Tabs), the next stage is to
migrate the **controls inside each settings section** to the new design-system
components, one section at a time, without losing functionality. The width shifting
between tabs is a symptom of the old react-bootstrap controls (`FormControl`,
`FormGroup`, etc.) sizing differently from the new layout.

This stage covers **only the Interface section** (`settings_interface/SettingsInterface.tsx`)
and **only its non-toggle controls** (toggles are explicitly out of scope for now).

## Scope

In scope (Interface section, non-toggle):

- **Language selector** — currently a react-bootstrap `<FormControl componentClass="select">`
  with `<option data-ext=…>` children. Replace with the design-system **`Picker`**
  (`@/ui/components/picker/Picker`).
- **Buttons** — "Reset suppressed notifications" and "Restart now" use react-bootstrap
  `Button`. Replace with the design-system **`Button`** (`@/ui/components/button/Button`).
- **Section/label chrome around those controls** — `ControlLabel`/`HelpBlock`/`Alert`
  wrapping the in-scope controls, migrated to `Typography` / plain markup as needed so
  the migrated controls sit correctly. (Toggle rows keep their existing markup this
  stage.)

Out of scope (this stage):

- All `Toggle` controls and their `FormGroup` rows (Customisation, Advanced, Automation).
- Other settings sections (Download, Mods, Vortex, …).
- The GPU-acceleration warning `Alert` only insofar as it's tied to a toggle — leave it.

## The functionality that must not be lost

The Language control is the risk area. Current behaviour (`SettingsInterface.tsx:172-193,
336-385`):

1. Options are built from `languages: ILanguage[]`. When a language has
   `ext.length >= 2`, it renders **one option per ext** — several options that share the
   same `value` (`language.key`) but differ by `data-ext` (the ext `name`).
2. On change, `selectLanguage` reads `evt.target.selectedOptions[0].getAttribute("data-ext")`
   to find the ext, and if that ext has a `modId` it triggers an **on-demand extension
   install** (`emitAndAwait("install-extension", ext)`), reloads languages on success,
   and only then dispatches `setLanguage(value)`.
3. The option label is `languageName(language)` plus, for ext-provided languages,
   ` (Extension by <author>)`.

`Picker` is keyed purely by `value` and returns only that value on change — it cannot
carry `data-ext` in the DOM, and same-`key` options would be ambiguous. So we carry the
metadata ourselves.

## Design

### Language: build a flat option model, key by a composite id

Introduce a small local model that flattens the current `languages`-with-exts structure
into one entry per selectable option, mirroring exactly what the old `reduce` produced:

```ts
interface ILanguageOption {
    id: string; // composite, unique: `${language.key}::${ext?.name ?? "local"}`
    key: string; // the language key dispatched to setLanguage
    extName?: string; // ext.name, for the install lookup (was data-ext)
    label: string; // languageName + optional " (Extension by …)" suffix
}
```

- Build `options: ILanguageOption[]` with the same branching as today: if
  `language.ext.length < 2` push one entry (using `ext[0]` if present), else push one
  per ext. This preserves the exact same set of visible options.
- `Picker` `value` = the composite `id`. Compute the current selection's `id` from
  `currentLanguage`: pick the option whose `key === currentLanguage` (prefer a stable
  choice — first match — matching how the native select shows the current value).
- `options` passed to Picker = `optionModel.map(o => ({ label: o.label, value: o.id }))`.

### Language: onChange preserves the install-on-select flow

Replace `selectLanguage(evt)` with `selectLanguage(id: string)`:

- Look up the `ILanguageOption` by `id` (not the DOM).
- Resolve the ext from `extensions.find(e => e.name === option.extName)` exactly as
  before.
- Keep the **same** `PromiseBB` flow: if `ext.modId !== undefined`,
  `emitAndAwait("install-extension", ext)` → on success `onReloadLanguages()` → then
  `onSetLanguage(option.key)`; otherwise dispatch directly. No behavioural change, only
  the source of the metadata (model lookup vs `getAttribute`).

`this.context.api` is still available (class component, unchanged).

### Buttons

- "Reset suppressed notifications" and "Restart now" → design-system `Button`
  (`brand`/`appearance` defaults; keep the existing `onClick` handlers and surrounding
  count text / alert copy).

### Labels & layout

- The Language field's `ControlLabel` (title) and the "you may have to restart" helper
  text become the `Picker`'s surrounding label + a `Typography` hint (Picker itself has
  no label slot, unlike `Select`), laid out with the conventional Tailwind spacing so it
  aligns with the page.
- Leave the toggle `FormGroup`s as-is this stage; only adjust wrappers where needed so
  the migrated Language + Buttons render cleanly.

### What stays the same

- The `SettingsInterface` class component, its redux `connect`, all `mapStateToProps` /
  `mapDispatchToProps`, the `readLocales` effect wrapper, and every toggle. This keeps
  the diff focused and reviewable.

## Isolation / boundaries

- The option-model construction is a pure function of `languages` — easy to unit test
  and reason about in isolation from the class component.
- The install-on-select side effect stays in one handler, unchanged in behaviour.

## Testing / verification

- **Build/typecheck/lint/format** the renderer package (per AGENTS.md).
- **Manual, in-app** (Settings → Interface):
    - Language dropdown lists the same languages as before, including any
      "(Extension by …)" entries, with the current language preselected.
    - Selecting a **bundled** language switches language (after restart where applicable),
      no install triggered.
    - Selecting an **extension-provided** language (with `modId`) triggers the
      install-extension flow, reloads languages, and applies the language on success —
      verify with a translation extension available.
    - "Reset suppressed notifications" resets and the count text updates; "Restart now"
      (shown after toggling the custom titlebar) relaunches.
    - Width no longer shifts on the Interface tab from the old select/button sizing.
- If practical, a small unit test for the option-model builder (same option set +
  composite ids for multi-ext languages).

## Follow-ups (not this stage)

- Toggles → design-system `Switch` (deferred deliberately).
- Remaining settings sections, section by section, reusing this pattern.
- Health Check tab labels → `name` + `label` robustness (from the previous stage).
