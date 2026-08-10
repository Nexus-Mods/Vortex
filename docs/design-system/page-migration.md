# Migrating a page to the new `Page` layout

This is a repeatable recipe for converting a legacy `MainPage`-based page (core or
extension) to the redesigned **`Page`** layout — the flat, Tailwind-based shell with a
pictogram + title + subheading header used by Games, Health Check, Tools, the Design
System, and Settings.

## When this applies

Any page still built on the legacy chrome:

```tsx
<MainPage>
    <MainPage.Header>…</MainPage.Header>
    <MainPage.Body>…</MainPage.Body>
</MainPage>
```

If the page also uses react-bootstrap `Tabs`/`Tab`, migrate those to the new Tabs
components at the same time (see below).

## Step 1 — flip the `newLayout` flag

The page's registration must set `newLayout: true`:

- **Core/built-in pages**: in `src/renderer/src/contexts/builtInPages.ts`, add
  `newLayout: true` to the page's `definePage({...})` entry.
- **Extension pages**: pass `newLayout: true` in the options to `registerMainPage(...)`.

`MainPageContainer` (`src/renderer/src/views/MainPageContainer.tsx`, ~line 161) checks
this flag: when set, it **skips the legacy `.main-page` / header-container /
body-container chrome** and renders the page component directly, passing `active` and
`pageId` props. The component is then responsible for rendering its own `Page`.

## Step 2 — the shared shell

Every migrated page uses the same three-piece shell from
`@/views/components/Page/`:

```tsx
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

<Page active={active} pageId={pageId} scrollable={false}>
    <PageHeader pictogramName="…" subtitle={t("…")} title={t("…")} />

    <PageScroll className="space-y-6 p-6">{/* page content */}</PageScroll>
</Page>;
```

- `Page` — `scrollable={false}` when you compose a fixed `PageHeader` + your own
  `PageScroll` (the usual case); pass `active`/`pageId` straight through from props.
- `PageScroll` — owns the only scrollbar and reports scroll position to the header (so
  the header shows its shadow and shrinks the pictogram). `space-y-6 p-6` is the
  conventional content padding/spacing.

### `PageHeader` options

- `title` — the string heading. Mutually exclusive (`XOr`) with `customTitle`
  (an arbitrary node, e.g. a title with a badge).
- `subtitle` — the subheading below the title (hidden once scrolled).
- `pictogramName` — see Step 4.
- `children` — rendered on the **right side** of the header, for page actions. Examples:
  Health Check puts its "last updated" label + refresh/settings buttons here; Games puts
  its search box + display options here. `children` may also be a render-prop
  `(scrolled: boolean) => ReactNode` when the actions need to react to scroll.

## Step 3 — migrate tabs

Replace react-bootstrap `Tabs`/`Tab` with the new Tabs family from
`@/ui/components/tabs/`:

```tsx
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";

<TabProvider tab={selectedTab} tabListId="my-page" onSetSelectedTab={setSelectedTab}>
    <TabBar>
        <TabButton name="Overview" panelId="overview" />
        <TabButton count={42} name="Files" panelId="files" />
    </TabBar>

    <TabPanel id="overview">…</TabPanel>
    <TabPanel id="files">…</TabPanel>
</TabProvider>;
```

Key facts:

- The provider is **controlled**: you hold the selected tab in state and feed it via
  `tab` + `onSetSelectedTab`.
- Tab identity is an **explicit id**, separate from the label: `TabButton` takes a
  `panelId`, `TabPanel` takes a matching `id`, and selection is `selectedTab === panelId`
  (exact match — no slugging). **The value passed to `onSetSelectedTab` is the `panelId`.**
- `TabButton`'s `name` is purely the **visible (translatable) label** — set `name={t(…)}`
  freely while keeping `panelId` a stable, language-independent identity. This is what
  makes localized labels safe (see the gotcha below).
- `tabType="secondary"` gives the smaller sub-tab style and parenthesises the `count`
  badge; sub-tabs can be nested inside a panel with their own `TabProvider`.
- Keyboard nav (Arrow Left/Right with wrap, Home, End, skipping disabled tabs) is
  built in.

## Step 4 — pictograms

Pictograms are decorative 200×200 SVGs loaded from `assets/pictograms/` by
`Pictogram` (`src/renderer/src/ui/components/pictogram/Pictogram.tsx`), which renders
`assets/pictograms/${name}.svg`. **The `IPictogramName` value and the filename are
coupled — they must match.**

The source pictogram library is the **flamework** repo at
`apps/next/public/assets/images/pictograms/`. To add one:

1. Copy the SVG into Vortex's `assets/pictograms/` (e.g. via
   `gh api repos/Nexus-Mods/flamework/contents/apps/next/public/assets/images/pictograms/<file>.svg --jq '.content' | base64 -d > assets/pictograms/<name>.svg`).
   The build copies the whole `assets/pictograms/` dir (`src/main/copy-assets.mjs`), so
   no build-config change is needed.
2. Ensure the SVG is `width="200" height="200" viewBox="0 0 200 200"` and uses
   `style="fill: currentColor"` on its main shape so it responds to the `theme` prop
   (flamework's pictograms already do).
3. Add the filename (without `.svg`) to `IPictogramName` in `Pictogram.tsx`.

See the "Adding a new pictogram" section in `src/renderer/src/ui/README.md` for the
canonical version of these steps.

If flamework has no close match, reuse the nearest available name. If you want a
semantic name now but only have stand-in artwork, save the stand-in SVG under the
semantic filename (e.g. Settings uses `settings.svg` backed by flamework's `tune`
artwork) — a dedicated mark can later overwrite that one file with no code change.

## Gotcha — persisted / deep-linked tab keys

If the active tab is persisted (redux) or **deep-linked into from elsewhere**, use a
stable, language-independent value as the `panelId` — do **not** derive it from the
translated label.

Concrete case: Settings persists its active tab as the **untranslated** section title
(e.g. `"Vortex"`), and Health Check deep-links via `dispatch(setSettingsPage("Vortex"))`.
Settings uses that untranslated title as the `panelId` (and the `TabPanel` `id`), and the
translated title as the `name` label. `onSetSelectedTab` hands back the `panelId`
verbatim, so it dispatches `setSettingsPage(panelId)` directly. Net effect: the
stored/deep-linked value stays `"Vortex"` and the label is translated — with no
slug round-trip to get wrong.

## Reference implementations

Worked examples to copy from:

- `src/renderer/src/views/pages/Tools/index.tsx` — simple page, header only.
- `src/renderer/src/extensions/gamemode_management/views/GamePicker.tsx` (Games) —
  header `children` actions (search, display options).
- `src/renderer/src/extensions/health_check/views/HealthCheckPage.tsx` — header actions
    - secondary tabs with `count` badges.
- `src/renderer/src/extensions/design_system_dev/views/DesignSystemPage.tsx` — primary
  tabs plus nested secondary tabs.
- `src/renderer/src/views/Settings.tsx` — extension-contributed tabs, priority sort,
  persisted/deep-linked tab keys (the gotcha above).
