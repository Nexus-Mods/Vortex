# Frontend Guide (renderer)

Conventions for the React/TypeScript renderer (`src/renderer`). Read this when
writing or changing UI. Match the surrounding code first; this captures the
defaults when there's no local precedent.

## Stack

- **React 16.14** — function components + hooks only. Do NOT use React 18+ APIs
  (`useId`, `useSyncExternalStore`, `useTransition`, `createRoot`, automatic
  batching guarantees). ESLint warns on new class components — don't add them.
- **TypeScript** (type-checked ESLint). `import type { ... }` for types
  (`consistent-type-imports` is an error).
- **Tailwind v4** for styling, **react-redux** for state, **react-i18next** for
  copy, Electron renderer process.

## Commands (run from the affected package, usually `src/renderer`)

- `pnpm run build` · `pnpm run test` · `pnpm run lint` · `pnpm run format` after changes.
- Type-only check: `pnpm run typecheck` (or `tsc -p tsconfig.json --noEmit`).
- Run one test: `pnpm run test -- <path>` (colocated `*.test.tsx`).
- **Public extension API:** if you change exported types in `types/api.ts`
  (e.g. `IMainPageOptions`), run `pnpm run api` and commit the regenerated
  `etc/vortex.api.md`. Add a one-line TSDoc `/** ... */` so it isn't
  `(undocumented)` in the report.

## Files & structure

- Shared UI: `src/renderer/src/ui/components/<snake_case>/<PascalCase>.tsx`.
- Feature UI: `src/renderer/src/extensions/<ext>/...` (`components/`, `views/`,
  `hooks/`, `utils/`, `selectors.ts`).
- Colocate `<Name>.test.tsx` and, for shared components, `<Name>.demo.tsx`.
- One component per file, named exports for components; helpers/selectors live in
  `utils/`/`hooks/`, not inline in a view, once reused.

## Types

- Define a type/interface in the file that consumes it. Only lift it to a shared
  module (`types.ts`, a `utils/`/`hooks/` file) once more than one file needs it —
  don't create a shared type file pre-emptively.
- Name interfaces with an `I` prefix (`IMainPage`, `IHealthCheckEntry`,
  `ITabButtonProps`). Union/alias types stay plain PascalCase (`Severity`,
  `FileRequirementCategory`). Keep new names consistent with the neighbours.

## Components & props

- Function components with a typed props interface.
- Prop order is auto-enforced (`perfectionist/sort-jsx-props`): **shorthand
  first, then alphabetical, callbacks (`on*`) last**. Don't hand-order — run
  `eslint --fix` / `format`.
- Prefer composition and small leaf components over large ones.
- Self-closing tags for empty elements (lint-enforced).

## Imports

- `oxfmt` owns import grouping/ordering (external → `@/` alias → relative,
  alphabetical). Don't fight it — run `pnpm run format`.
- Unused vars/args are errors unless prefixed `_`.

## Styling

- Utility classes via `className`. Build conditional/among-many class strings with
  `joinClasses([...classes], { "class": condition })` — it's lint-aware, so
  Tailwind classes inside it get ordered/validated too.
- Class order is auto-enforced (`better-tailwindcss`); let `--fix`/format sort it.
- Use design tokens, not raw colors: `bg-surface-*`, `text-neutral-*`,
  `bg-danger-strong`, `bg-warning-moderate`, `bg-info-moderate`, `text-*`, etc.
- Shared components also expose semantic `nxm-`-prefixed classes
  (`nxm-tab-button`, …) — keep that pattern for reusable primitives.

## State (Redux)

- `useSelector` with a **stable selector reference** (module-level fn, not an
  inline closure that returns a fresh value each call).
- Subscribe to the **narrowest slice** you need. Health-check-style features
  dispatch frequently; a broad subscription re-renders on unrelated writes.
- **Never return a freshly-created object/array/React element from a selector** —
  referential inequality forces a re-render every dispatch. Return primitives or
  stable refs; map to objects/nodes in the component.
- Push a hot subscription into a small leaf component so only it re-renders
  (see `HealthCheckMenuBadge`, `LastUpdated`).

## i18n (important)

- Localize with `useTranslation(["ns", "common"])`; keys look like
  `section::key` / `common:::key`.
- **Never derive identity, logic, state, keys, or comparisons from a translated
  string** — it changes per language and silently breaks. Use a stable
  id/enum for identity and translate only for display. (This is exactly how the
  tab selection bug happened: identity was a slug of the label.)

## Icons

- MDI paths from `@mdi/js`, mapped in `views/components/iconMap.ts` via
  `getIconPath(name)`; pages can pass an `mdi` path directly.
- Custom SVGs must use the **24×24 viewBox** the `Icon` component renders. To port
  a Material Symbols icon (`0 -960 960 960`): scale ×0.025, offset absolute Y by
  +960. Keep it a single filled path (`fill="currentColor"`).

## Pages / extensions

- Register with `context.registerMainPage(icon, title, Component, options)`.
- `newLayout: true` opts into the redesigned chrome — the page renders its own
  `<Page>` / `<PageHeader>` / `<PageScroll>`.
- Optional menu extras are self-contained components (e.g. `menuBadge`) that
  subscribe to their own state.

## Accessibility

- Use correct roles/attributes (`role="tab"`/`tabpanel`, `aria-controls`,
  `aria-selected`) and support keyboard navigation for custom interactive UI.

## Testing

- `vitest` + `@testing-library/react` (v12), colocated with the component.
- Query by role/label/text (what a user sees), not test ids.

## Comments

- Prefer self-documenting names over comments. Comment the non-obvious **why**
  (a subscription tradeoff, a workaround), not the **what**. Remove narration.
