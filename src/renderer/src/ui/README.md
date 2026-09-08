# Design System Components

Components adapted from the web team's "next" project for use in Vortex.

## Directory Structure

```
ui/
├── components/
│   ├── alert/           - Full-width page-level message bar (replaces Bootstrap Alert)
│   ├── bullet/          - Small rotated-square dot used as an inline marker/separator
│   ├── button/          - Button system (brand × appearance matrix)
│   ├── collectiontile/  - Collection card with image, metadata, and actions
│   ├── dropdown/        - Dropdown menu (Headless UI Menu)
│   ├── form/            - Form components
│   │   ├── checkbox/    - Checkbox input
│   │   ├── formfield/   - Form field wrapper with labels and validation
│   │   ├── input/       - Text input with validation
│   │   ├── select/      - Select dropdown with custom styling
│   │   └── switch/      - Tri-state toggle switch (off / on / semi-on)
│   ├── icon/            - Icon rendering (MDI + Nexus custom icons)
│   ├── image/           - Image wrapper with aspect ratios and fallback (+ adult-aware variant)
│   ├── listbox/         - Listbox select (Headless UI Listbox)
│   ├── listing/         - List display component
│   ├── modal/           - Modal dialog (Headless UI Dialog)
│   ├── pictogram/       - Decorative SVG pictograms
│   ├── listing_loader/  - Loading skeleton for lists
│   ├── no_results/      - Empty state component
│   ├── pagination/      - Pagination controls with jump-to-page
│   ├── picker/          - Single-value selector (Headless UI Listbox)
│   ├── pill/            - Compact rounded label for tags and statuses
│   ├── popover/         - Floating panel of interactive content, or a menu of actions (Headless UI Popover)
│   ├── premium_badge/   - Premium diamond badge
│   ├── table/           - Data table (sort, filter, group, column toggle, optional pagination)
│   ├── tabs/            - Tabbed interface with context-based state
│   ├── toolbar/         - Horizontal toolbar; groups collapse overflow into a kebab dropdown
│   ├── tooltip/         - Rich, collision-aware tooltip (Floating UI)
│   └── typography/      - Typography system (heading, title, body)
├── lib/
│   └── icon_paths/      - 34 custom Nexus Mods SVG icon paths
├── utils/
│   ├── join_classes/     - Joins class names with conditional support
│   └── types.ts         - Shared types (XOr, ResponsiveScreenSizes)
└── README.md
```

## Importing Components

### Within Vortex Source

Import directly from the source file:

```tsx
import { Button } from "../../ui/components/button/Button";
import { Icon } from "../../ui/components/icon/Icon";
import { Typography } from "../../ui/components/typography/Typography";
```

### Utilities

```tsx
import { joinClasses } from "../../ui/utils/join_classes/joinClasses";
import type { XOr, ResponsiveScreenSizes } from "../../ui/utils/types";
```

### Icon Paths

```tsx
import { nxmVortex, nxmCollection } from "../../ui/lib/icon_paths/iconPaths";
import { mdiDownload, mdiAccount } from "@mdi/js";
```

## CSS Convention

Components use `nxm-` prefixed CSS class names to avoid conflicts with existing Bootstrap/SASS styles:

```tsx
// Class naming pattern: nxm-{component}-{variant}-{modifier}
<button className="nxm-button nxm-button-primary nxm-button-strong" />
<span className="nxm-tab-button nxm-tab-button-selected" />
```

The `joinClasses` utility handles conditional classes:

```tsx
joinClasses(["nxm-button", className], {
    "nxm-button-disabled": disabled,
    "nxm-button-selected": selected,
});
```

## Components

### Button

Styled as a `brand` × `appearance` matrix: `brand` picks the colour family, `appearance` picks the prominence (solid fill → text-only).

**Defaults:** `brand="primary"`, `appearance="strong"`, `size="md"` — only set these when you need something different.

```tsx
import { Button } from "../../ui/components/button/Button";

// Uses defaults (primary, strong, md) — a solid primary button
<Button>Click Me</Button>

// Only override what differs from the default
<Button size="sm">Small</Button>
<Button brand="neutral" appearance="subdued">Outlined</Button>
<Button brand="neutral" appearance="weak">Quiet</Button>
<Button brand="success">Saved</Button>

// With icons
import { mdiDownload } from "@mdi/js";
<Button leftIconPath={mdiDownload}>Download</Button>

// Icon-only (collapses to a square — always pass an aria-label)
<Button aria-label="Download" leftIconPath={mdiDownload} />

// Loading state
<Button isLoading>Processing...</Button>
```

**Brands:** `primary`, `info`, `neutral`, `success`, `premium`, `danger`
**Appearances:** `strong` (solid fill), `moderate` (subtle surface), `subdued` (outline), `weak` (text only)
**Sizes:** `sm` (24px), `md` (28px, default), `lg` (36px)

A button with no `children`/`customContent` but an icon renders icon-only (square). Every brand supports every appearance; `success`/`premium` derive their full ramps to match. `appearance` defaults to `strong` so a bare `<Button>` is a solid primary button.

> **Migration note:** the old `buttonType`/`filled` props were replaced by `brand`/`appearance`. `secondary`→`neutral`+`subdued`, `tertiary`→`neutral`+`weak`, `filled="strong"`→`appearance="strong"`, `filled="weak"`→`appearance="moderate"`.

### Icon

```tsx
import { Icon } from "../../ui/components/icon/Icon";
import { mdiAccount } from "@mdi/js";
import { nxmVortex } from "../../ui/lib/icon_paths/iconPaths";

<Icon path={mdiAccount} size="md" />
<Icon path={nxmVortex} size="lg" title="Vortex" />
```

**Sizes:** `xs` (12px), `sm` (16px), `md` (20px), `lg` (24px), `xl` (32px), `2xl` (48px), `none` (controlled via className)

### Typography

Colour is expressed as `brand` × `appearance`: `brand` picks the colour family, `appearance` picks the intensity.

**Defaults:** `as="p"`, `brand="neutral"`, `appearance="strong"`, `typographyType` inferred from `as` — only set these when you need something different.

When `typographyType` is omitted it falls back based on `as`: `h1`→`heading-2xl`, `h2`→`heading-xl`, `h3`→`heading-lg`, `h4`→`heading-md`, `h5`→`heading-sm`, `h6`→`heading-xs`, everything else→`body-md`.

```tsx
import { Typography } from "../../ui/components/typography/Typography";

// Defaults to <p> with body-md, neutral brand, strong appearance
<Typography>Some body text</Typography>

// Only override what differs
<Typography as="h1">Page Heading</Typography>
<Typography appearance="subdued">Muted text (neutral)</Typography>
<Typography brand="info" appearance="moderate">Info text</Typography>
<Typography as="span" typographyType="body-sm">Inline small text</Typography>

// inverted is neutral-only (for light surfaces)
<Typography appearance="inverted">On a light background</Typography>

// brand="none" opts out of colour entirely — inherits the parent's colour
<Typography brand="none">Inherits colour</Typography>

// Responsive
<Typography typographyType={{ default: "body-sm", md: "body-md", lg: "body-lg" }}>
  Responsive text
</Typography>
```

**Elements:** `h1`–`h6`, `p`, `span`, `div`, `ul`
**Types:** `heading-2xl` through `heading-xs`, `title-md` through `title-xs`, `body-2xl` through `body-xs`
**Brands:** `neutral` (default), `primary`, `info`, `success`, `premium`, `danger`, `warning`, `neutral-translucent` (white-alpha translucent ramp), `none` (opt out of colour)
**Appearances:** `weak`, `subdued`, `moderate`, `strong` — plus `inverted` on `neutral` and `neutral-translucent` only. Setting `appearance` with `brand="none"` is disallowed (it would be redundant).

### TypographyLink

A `<button>` styled as a link. Colour uses the **same `brand` × `appearance` model as Typography** (it shares `getTypographyColourClass`), so the brands and appearances above apply here too. On hover the colour shifts one step toward `strong` (and `strong` dims to `moderate`), consistently across every brand.

**Defaults:** `brand="neutral"`, `appearance="strong"`, `variant="primary"`, `typographyType="body-md"`.

```tsx
import { TypographyLink } from "../../ui/components/typography/TypographyLink";

// Neutral link, underlined (primary variant)
<TypographyLink onClick={handleClick}>View details</TypographyLink>

// Branded
<TypographyLink brand="primary">Primary link</TypographyLink>
<TypographyLink brand="info" appearance="subdued">Subtle info link</TypographyLink>

// Underline only on hover
<TypographyLink variant="secondary">Secondary</TypographyLink>

// Icons + inherit the surrounding text size (e.g. inside a Trans/sentence)
<TypographyLink rightIconPath={mdiOpenInNew} typographyType="inherit">Open</TypographyLink>
```

**Variants:** `primary` (always underlined), `secondary` (underlines on hover), `none` (no underline)
**typographyType:** same values as Typography, plus `"inherit"` to take the surrounding font size

### Tabs

Context-based tab system with keyboard navigation.

`TabButton` takes a `name` (the visible, possibly localized label) and a stable
`panelId`; `TabPanel` takes the matching `id`. Identity is always the id, never
the label, so tabs keep working when the language changes.

```tsx
import { TabBar } from "../../ui/components/tabs/TabBar";
import { TabButton } from "../../ui/components/tabs/TabButton";
import { TabPanel } from "../../ui/components/tabs/TabPanel";
import { TabProvider } from "../../ui/components/tabs/Tabs.context";

function MyTabs() {
    const [selectedTab, setSelectedTab] = useState("overview");

    return (
        <TabProvider tab={selectedTab} tabListId="my-tabs" onSetSelectedTab={setSelectedTab}>
            <TabBar>
                <TabButton name="Overview" panelId="overview" />
                <TabButton name="Files" panelId="files" count={42} />
                <TabButton name="Settings" panelId="settings" disabled />
            </TabBar>

            <TabPanel id="overview">Overview content</TabPanel>
            <TabPanel id="files">Files content</TabPanel>
            <TabPanel id="settings">Settings content</TabPanel>
        </TabProvider>
    );
}
```

**Keyboard:** Arrow Left/Right (navigate, wraps), Home/End (jump to first/last)
**Tab types:** `primary` (default), `secondary` (count displayed with parentheses)

### Toolbar

Horizontal toolbar made of one or more rounded `ToolbarGroup` "pills". A group is **data-driven**: pass it an array of `IToolbarAction` descriptors and it renders each as an icon `Button`. When the actions don't all fit, the trailing slot becomes a kebab (`⋮`) menu and the overflow actions move into it — the same descriptor renders as a `Button` while visible and as a menu row once collapsed.

**Responsive by default.** The `Toolbar` measures the width available to it and each group renders as many actions as fit, so the rest stay reachable in the kebab as the window narrows. This needs a width that doesn't come from the toolbar's own content, which a block-level or stretched parent gives it for free. As a flex item the toolbar is `flex-shrink: 0` and keeps every control instead, because a toolbar sized by its content can't tell how much room it has — add `flex-1` to opt it into collapsing.

Use `flex-1` specifically, **not** `shrink`. Both let the toolbar narrow, but `shrink` leaves `flex-basis: auto`, so the width still comes from the content: collapsing shrinks the toolbar, the smaller toolbar reports a smaller budget, and the controls never come back out of the kebab when the window widens again. `flex-1` sets a zero basis, so the width comes from the parent and collapsing is reversible. Pair it with `justify-end` where the controls should sit against the trailing edge.

**`maxVisible`** (optional) caps the number of slots regardless of available width, for groups that should stay short. Omit it to let width be the only limit. Whichever is more restrictive wins.

```tsx
import { Toolbar } from "../../ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "../../ui/components/toolbar/ToolbarGroup";
import { mdiFolderOpenOutline, mdiHistory, mdiRefresh } from "@mdi/js";

const actions: IToolbarAction[] = [
    { label: "Open mods folder", iconPath: mdiFolderOpenOutline, onClick: openFolder },
    { label: "History", iconPath: mdiHistory, onClick: showHistory },
    { label: "Refresh", iconPath: mdiRefresh, onClick: refresh, disabled: isBusy },
];

<Toolbar>
    <ToolbarGroup actions={actions} />

    {/* Never use more than 4 slots, however wide the toolbar gets */}
    <ToolbarGroup actions={contextualActions} maxVisible={4} />
</Toolbar>;
```

**`IToolbarAction` fields:** `label` (required — the accessible name, tooltip, menu label, and button text when `showLabel`), `iconPath`, `onClick`, `panel` (see below), `disabled`, `brand` (defaults to `neutral`), `showLabel` (render the label as visible button text instead of icon-only, e.g. a "1 selected" pill), `pinned` (see below).

Actions are keyed internally by `label`, so labels should be unique within a group. The kebab is generated automatically — callers never author it.

**`panel`** makes an action open a floating surface instead of running a callback; it's the alternative to `onClick`, and the two are mutually exclusive. Pass a function of `{ close, dismiss }` returning the panel's contents — the group anchors it to whichever control it rendered, so the panel never has to know where it was opened from: under the button while the action is in the row, beside its row once it has collapsed into the overflow. `DisplayOptions` is built on this.

```tsx
const actions: IToolbarAction[] = [
    { label: "Refresh", iconPath: mdiRefresh, onClick: refresh },
    {
        label: "Display options",
        iconPath: mdiTune,
        panel: ({ close }) => <MyPanelRows onDone={close} />,
    },
];
```

`close` dismisses the panel; `dismiss` also dismisses whatever it was opened from, which only differs once the action has collapsed into the overflow. Reach for it when the panel's control ends the interaction rather than adjusting something — picking a destination should put the menu away too, where toggling a setting should leave it standing.

The overflow menu is a [`PopoverMenu`](#popovermenu) rather than a `Menu` precisely so a panel can open from inside it: a `Menu` closes the moment focus reaches a surface nested within it. It still presents as a menu — menu roles, focus on open, arrow-key navigation, `→` to open a panel from its row, `Escape` to close the innermost surface.

**`pinned`** keeps an action out of the overflow menu, wherever it sits in the list — the unpinned actions then share whatever width is left, still collapsing from the end. The row keeps the order you gave it, so a pin holds its place rather than jumping to the front as its neighbours collapse.

```tsx
const actions: IToolbarAction[] = [
    { label: "Install mod", iconPath: mdiPlusCircleOutline, onClick: install, pinned: true },
    { label: "Open mods folder", iconPath: mdiFolderOpenOutline, onClick: openFolder },
    { label: "History", iconPath: mdiHistory, onClick: showHistory },
];
```

Use it sparingly. Pinning wins over fitting, so a group with no room for its pinned actions shows them anyway and overflows its pill rather than dropping them — and `maxVisible` won't hold them back either.

**Tooltips come for free.** The controls are icon-only, so each visible one renders as a `ToolbarButton` — a `Button` wrapped in a `Tooltip` showing its `label`. The group shares one hover delay, so sweeping along the row swaps tooltips instead of re-waiting on each. Two cases deliberately get no tooltip: an action in the overflow menu (the menu already shows its label as text) and one with `showLabel` (its text is already on screen). The `label` stays the single source for the accessible name — the tooltip describes the control, it doesn't rename it.

### Alert

Full-width bar carrying a short message about the page it sits on, optionally with a control that acts on it. This is the replacement for react-bootstrap's `Alert` — prefer it for new work.

Severity colours the **icon only**; the surface stays neutral in every state, so a stack of alerts reads as one band rather than several competing blocks.

```tsx
import { Alert } from "../../ui/components/alert/Alert";
import { Button } from "../../ui/components/button/Button";

<Alert
    action={
        <Button brand="neutral" size="xs" onClick={relaunch}>
            {t("Restart Vortex")}
        </Button>
    }
    severity="warning"
>
    {t("You need to restart Vortex to apply changes.")}
</Alert>;

{
    /* The action is optional */
}
<Alert severity="success">{t("Action successful")}</Alert>;

{
    /* onDismiss adds a close button that hides the bar and calls back */
}
<Alert severity="info" onDismiss={() => markSeen(id)}>
    {t("We suggest you do this")}
</Alert>;
```

**Severities:** `info` (default), `success`, `warning`, `danger` — each picks its own icon and tints it with the matching `*-strong` token.

**Dismissal:** pass `onDismiss` to get a close button at the far edge of the bar. The alert hides itself on click and then fires the callback, so callers only need the callback for the side effect (persisting the dismissal, say) — not for the hiding. The button is labelled "Dismiss"; override it with `dismissLabel`.

The bar owns a 24px inline gutter and a bottom divider rather than a border and radius, so it's designed to sit edge-to-edge (no `mx-*` needed) above page content. It renders as `role="status"`; pass `role="alert"` explicitly for something genuinely interrupting. The message may wrap while the action keeps its width.

### Form Components

```tsx
import { Input } from "../../ui/components/form/input/Input";
import { Select } from "../../ui/components/form/select/Select";
import { FormFieldWrap } from "../../ui/components/form/formfield/FormField";

// Input with validation
<Input id="email" label="Email" type="email" required errorMessage="Invalid email" />

// Input with character counter
<Input id="bio" label="Bio" type="text" maxLength={200} />

// Select dropdown
<Select id="country" label="Country">
  <option value="">Select...</option>
  <option value="us">United States</option>
</Select>

// Multiple fields with spacing
<FormFieldWrap>
  <Input id="first" label="First Name" type="text" required />
  <Input id="last" label="Last Name" type="text" required />
</FormFieldWrap>
```

### Switch

A tri-state toggle switch (xs) — `off`, `on`, and a programmatic `semi-on` ("mixed") state. Setting `indeterminate` renders `semi-on` and reports `aria-checked="mixed"`. Clicking only ever flips on/off — `semi-on` is set by the consumer (e.g. a master control whose children are partially on).

Built on Headless UI's **`Checkbox`**, not its `Switch`: ARIA only allows `aria-checked` to be true/false on `role="switch"`, and Headless UI controls that attribute, so `mixed` can't be forced onto a `Switch`. A tri-state master control is the checkbox pattern, which is what `Checkbox` implements.

```tsx
import { Switch } from "../../ui/components/form/switch/Switch";

// Controlled on/off — onChange receives the new checked value, not an event
<Switch checked={enabled} onChange={setEnabled} aria-label="Enable" />

// Semi-on (mixed) — e.g. a "select all" with some children on
<Switch
  checked={allOn}
  indeterminate={someOn && !allOn}
  onChange={setAll}
  aria-label="All settings"
/>
```

**Props:** Headless UI `Checkbox` props — `checked`, `onChange(checked: boolean)`, `disabled`, `indeterminate`, `name`/`value`/`form` for form submission, `defaultChecked` for uncontrolled use — plus `className`.

The track and thumb style themselves off the attributes Headless UI sets (`data-checked`, `data-indeterminate`, `data-disabled`, `data-hover`, `data-active`, `data-focus`) rather than any state we derive ourselves. It renders a `<span role="checkbox">`, so pass `name` if the value needs to take part in form submission.

### Dropdown

Menu component built on Headless UI `Menu`.

```tsx
import { Dropdown } from "../../ui/components/dropdown/Dropdown";
import { DropdownItem } from "../../ui/components/dropdown/DropdownItem";
import { DropdownItems } from "../../ui/components/dropdown/DropdownItems";
import { DropdownDivider } from "../../ui/components/dropdown/DropdownDivider";
```

`DropdownButton` renders a `Button` as the `Menu.Button` trigger, so it takes all the same props as `Button`.

A `DropdownItem` takes the same [`brand`](#button) a `Button` does, tinting its icon and leaving the labels an even column of text to read down — except `danger`, which colours the whole row, a destructive action being the one thing in a menu that should be hard to pick by accident. [`PopoverMenu`](#popovermenu) rows brand the same way, from the same helper.

### Popover

A floating panel of arbitrary interactive content built on Headless UI `Popover`. Unlike `Dropdown` (a menu of actions that closes on selection), a Popover holds controls — pickers, switches, buttons — and stays open until an outside click or Escape. `PopoverButton` renders a `Button` as the trigger (so it takes every Button prop); `PopoverPanel` holds the content. For a panel holding a menu of actions rather than controls, see [`PopoverMenu`](#popovermenu).

```tsx
import { Popover } from "../../ui/components/popover/Popover";
import { PopoverButton } from "../../ui/components/popover/PopoverButton";
import { PopoverPanel } from "../../ui/components/popover/PopoverPanel";
import { mdiTune } from "@mdi/js";

<Popover>
    <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiTune} size="sm" />

    <PopoverPanel>{/* pickers, switches, buttons, … */}</PopoverPanel>
</Popover>;
```

> **Positioning note:** the panel is placed by Headless UI's `anchor` prop, which uses Floating UI to flip and shift it into view and portals it out of any clipping ancestor. It defaults to `bottom end` with a 4px gap; pass `anchor` to place it elsewhere.

For a panel of settings rather than free-form content, fill it with `PopoverPanelGroup`s. Groups are separated from one another by a rule and the last ends in padding, so a panel never finishes on a divider — state the separator on the groups, not the rows, and a trailing element can't leave a dangling rule. Each group holds `PopoverPanelGroupItem` rows: `label` on the left, control on the right; omit `label` for a control-only row and place it with a `justify-*` class.

```tsx
<PopoverPanel>
    <PopoverPanelGroup>
        <PopoverPanelGroupItem label={t("Display as")}>
            <Picker options={layouts} value={layout} onChange={setLayout} />
        </PopoverPanelGroupItem>
    </PopoverPanelGroup>

    <PopoverPanelGroup>
        <PopoverPanelGroupItem className="justify-end">
            <TypographyLink onClick={onReset}>{t("Reset to default")}</TypographyLink>
        </PopoverPanelGroupItem>
    </PopoverPanelGroup>
</PopoverPanel>
```

### PopoverMenu

A menu of actions filling a `PopoverPanel`. Use it over [`Dropdown`](#dropdown) when a row has to open a surface of its own — a submenu, or a panel of settings. A `Dropdown` is a Headless UI `Menu`, and a `Menu` closes the moment focus reaches anything nested inside it; a `Popover` registers a child's portal as part of itself, so reaching into it doesn't read as leaving. What `Menu` would have given for free is supplied instead: the menu roles, focus on open, and arrow-key navigation.

Rows are `IMenuAction`s — the same shape as an `IToolbarAction` minus the toolbar's own layout concerns, so an action can be handed to either. Actions arrive as **groups**, separated by a rule; an empty group is dropped rather than drawn, so a conditional group can go in as-is without leaving a rule with nothing under it.

A row takes the same [`brand`](#button) a `Button` does, so an action reads the same on a toolbar as it does in the overflow menu it collapsed into. A row tints only its icon, leaving the labels an even column of text to read down — except `danger`, which colours the whole row.

```tsx
<PopoverPanel className="nxm-popover-panel-dropdown">
    {({ close }) => (
        <PopoverMenu
            actions={[extensionActions, [helpCentre, viewLogs, about]]}
            label={t("Help")}
            onSelect={close}
        />
    )}
</PopoverPanel>
```

**Props:** `actions` and `label` (the menu's accessible name) are required, as is `onSelect` — a row was activated, so put the menu away. `onClose` is only for a menu nested inside another: it closes this one and hands focus back to the row that opened it, the counterpart to `→`.

Give the panel `nxm-popover-panel-dropdown`. The base panel is sized for label-and-control rows and carries no block padding, which a list of rows needs.

**For a submenu**, give the row `panelRole: "menu"` alongside its `panel` — that's what tells the control it's advertising a menu rather than a settings surface, and sizes the panel to match. Nesting is a row's `panel` rendering another `PopoverMenu`; depth beyond two levels isn't exercised anywhere.

```tsx
const helpAction: IMenuAction = {
    label: t("Help"),
    iconPath: mdiHelpCircleOutline,
    panelRole: "menu",
    panel: ({ close, dismiss }) => (
        <PopoverMenu actions={helpRows} label={t("Help")} onClose={close} onSelect={dismiss} />
    ),
};
```

Pass `dismiss` as the submenu's `onSelect`, not `close`: choosing a row there ends the interaction, so the menu it was opened from should go with it. Rows are focused as one flat list across group boundaries, so arrowing runs through the whole menu rather than stopping at a rule.

Any row with a `panel` advertises it: a chevron on the right says the row opens a surface rather than running something, and pointing at the row opens it after a short delay — long enough that sweeping past on the way elsewhere doesn't flick panels open. Leaving the row closes it again, unless the pointer arrives in the panel; the panel is portalled, so travelling across the gap between the two fires the row's `mouseleave` and the panel has to call the close off. Clicking a row the pointer has already opened is inert rather than a toggle. `→` still opens from the keyboard, `←` and `Escape` back out.

### DisplayOptions

The controls for how a listing is shown (layout, what's included, …), as a tune-icon action for that page's `Toolbar`. `useDisplayOptionsAction` returns an `IToolbarAction`, so the display options ride the toolbar's overflow with every other action instead of sitting beside it — there is no standalone version. Compose the rows from `PopoverPanelGroup` and `PopoverPanelGroupItem` (see [Popover](#popover)). The panel ends in a reset link whenever `canReset` says something has been changed from its default: `onReset` puts the defaults back, and the panel stays open so the rows above visibly move with it.

```tsx
import { PopoverPanelGroup } from "../../ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "../../ui/components/popover/PopoverPanelGroupItem";
import { useDisplayOptionsAction } from "../../ui/components/display_options/useDisplayOptionsAction.hook";

const displayOptions = useDisplayOptionsAction({
    canReset: showHidden,
    children: (
        <PopoverPanelGroup>
            <PopoverPanelGroupItem label={t("Show hidden items")}>
                <Switch checked={showHidden} onChange={onToggleHidden} />
            </PopoverPanelGroupItem>
        </PopoverPanelGroup>
    ),
    onReset,
});

<Toolbar>
    <ToolbarGroup actions={[refreshAction, displayOptions]} />
</Toolbar>;
```

**Props:** `canReset`, `onReset` and `children` are required. `label` (names the trigger — used as both its tooltip and `aria-label`) and `resetLabel` default to translated "Display options" and "Reset to default"; pass them only to say something else. The hook appends the reset link as a final group of its own, so `children` should be the setting groups only.

`canReset` is the caller's to compute, because only it knows what its defaults are — compare each setting the panel shows against the value `onReset` returns it to, and keep the two in step by naming that value once. Nothing to undo means no link, rather than one that would do nothing; because a group states its own separator, the last settings group stops drawing a rule as soon as the reset group goes away. So the link removes itself as it takes effect, while the panel stays open.

The toolbar owns the trigger and anchors the panel: under the button while the action is in the row, beside its row once the action has collapsed into the overflow menu. See [Toolbar](#toolbar) for panel actions in general.

### Tooltip

Rich, collision-aware tooltip built on `@floating-ui/react`. `content` is arbitrary React — headings, lists, icons — not just a string. Position is resolved against the window continuously: it flips to the opposite side when the preferred one would overflow, slides along an edge when a corner would, and clamps its own width and height to the room that is left. It renders into the `#overlays` host, so tables, dashlets and scroll panes cannot clip it.

**For new tooltips only.** The existing `controls/TooltipControls` components (`Button`, `IconButton`, `Icon`, `NavItem`) are untouched — don't migrate call sites to this without a deliberate decision to do so.

**Defaults:** `placement="top"`, `delay={{ open: 250, close: 50 }}`, `showArrow`, non-interactive.

```tsx
import { Tooltip } from "../../ui/components/tooltip/Tooltip";

// Plain label
<Tooltip content="Deploys every enabled mod to the game folder">
  <Button>Deploy</Button>
</Tooltip>

// Rich content — customContent gets no padding, so give it its own
<Tooltip customContent={<ModHealthSummary mod={mod} />} placement="right">
  <Button appearance="subdued" brand="neutral">Details</Button>
</Tooltip>

// Interactive — the pointer can travel in and use a link inside
<Tooltip interactive customContent={<div className="px-4 py-3">…<TypographyLink>Manage it</TypographyLink></div>}>
  <Button>Why is this hidden?</Button>
</Tooltip>

// Conditional — e.g. only explain the name when it's actually truncated
<Tooltip content={mod.name} disabled={!isTruncated}>
  <span className="truncate">{mod.name}</span>
</Tooltip>
```

**Props:** `children` (the trigger), plus exactly one of `content` / `customContent`; `placement` (any Floating UI placement, e.g. `"top"`, `"right-start"`), `delay` (number, or `{ open, close }`), `disabled` (render the trigger with no tooltip), `interactive`, `showArrow`, `className` (applied to the tooltip bubble).

**`content` is styled, `customContent` is not** — the same split as Button's `children`/`customContent`, and an `XOr`, so passing both (or neither) is a type error.

| prop            | type        | styling                                                                     |
| --------------- | ----------- | --------------------------------------------------------------------------- |
| `content`       | `string`    | gets `.nxm-tooltip-content` — the tooltip's padding, font size, line height |
| `customContent` | `ReactNode` | rendered unstyled; **you supply the padding**                               |

Which prop you pass decides the styling, so the call site states its intent rather than the component sniffing the type. An always-present `.nxm-tooltip-body` wrapper carries the scroll clamp in both cases (it can't sit on `.nxm-tooltip` without clipping the arrow).

> Because it's an `XOr`, a dynamically-built props object won't spread in — branch on the two cases instead. Static call sites are unaffected.

Width is CSS, not a prop. `.nxm-tooltip` caps at 320px; pass a utility class to widen a specific tooltip — Tailwind sits in a higher layer than `components`, so it wins:

```tsx
<Tooltip className="max-w-lg" customContent={<LongChangelog />}>
    …
</Tooltip>
```

That only moves the design cap. The positioner around the bubble is still clamped to the space left in the window, so a wider cap can't push the tooltip off an edge.

> **The trigger must forward a ref to a DOM node.** `Button` does; `Icon`, `Pill` and bare text do not — wrap those in a `<span className="inline-flex">`.

`placement` is a preference, not a guarantee: the collision middleware treats it as the starting point and moves the tooltip if it wouldn't fit. Tooltips also open on keyboard focus and dismiss on Escape, and are non-interactive by default so they can never swallow a click aimed at what's underneath.

#### TooltipDelayGroup

Shares one hover delay across every `Tooltip` inside it. The first tooltip waits out the open delay; while one is showing, moving to a sibling swaps straight over. Wrap rows of icon buttons in this — without it, scanning a toolbar costs a fresh 250ms pause per button.

```tsx
import { TooltipDelayGroup } from "../../ui/components/tooltip/TooltipDelayGroup";

<TooltipDelayGroup>
    {actions.map((action) => (
        <Tooltip key={action.label} content={action.label}>
            <Button aria-label={action.label} leftIconPath={action.iconPath} />
        </Tooltip>
    ))}
</TooltipDelayGroup>;
```

It renders no DOM of its own. Where the row needs a layout element anyway, pass `as` and that element's props instead of nesting a second node inside:

```tsx
<TooltipDelayGroup as="div" className="flex items-center gap-x-1">
    {actions.map((action) => (
        <Tooltip key={action.label} content={action.label}>
            <Button aria-label={action.label} leftIconPath={action.iconPath} />
        </Tooltip>
    ))}
</TooltipDelayGroup>
```

`as` takes any element type and forwards the rest of the props to it. Props are typed as `HTMLAttributes`, so `className`, `style` and the like are covered — element-specific ones (`href`, say) are not, and are dropped with no wrapper to receive them if `as` is omitted.

### Listbox

Select component built on Headless UI `Listbox`.

```tsx
import { Listbox } from "../../ui/components/listbox/Listbox";
import { ListboxButton } from "../../ui/components/listbox/ListboxButton";
import { ListboxOption } from "../../ui/components/listbox/ListboxOption";
import { ListboxOptions } from "../../ui/components/listbox/ListboxOptions";
```

### CollectionTile

Collection card with cover image, metadata, tags, and action buttons.

```tsx
import { CollectionTile } from "../../ui/components/collectiontile/CollectionTile";
import { CollectionTileSkeleton } from "../../ui/components/collectiontile/CollectionTileSkeleton";
```

### Pagination

```tsx
import { Pagination } from "../../ui/components/pagination/Pagination";
```

### Table

Reusable, column-driven data table. Declare the columns and pass the data; sorting, per-column filtering, column show/hide, grouping, optional pagination and an empty state are handled internally.

**Defaults:** filters and the column toggle auto-enable when a column opts in; pagination is **off** unless `pageSize` is set; headers are always left-aligned.

```tsx
import { Table } from "../../ui/components/table/Table";
import type { IColumnDef } from "../../ui/components/table/Table.types";

const columns: Array<IColumnDef<Mod>> = [
    { id: "name", header: "Name", getValue: (m) => m.name, sortable: true, filter: { type: "text" } },
    {
        id: "category",
        header: "Category",
        getValue: (m) => m.category,
        groupable: true,
        filter: { type: "select", options: [{ label: "UI", value: "UI" }] },
    },
    {
        id: "downloads",
        header: "Downloads",
        getValue: (m) => m.downloads,
        sortable: true,
        align: "right",
        cell: (m) => m.downloads.toLocaleString(),
    },
];

// No pageSize → renders every row, no pager
<Table columns={columns} data={mods} getRowId={(m) => m.id} />

// With pagination
<Table columns={columns} data={mods} getRowId={(m) => m.id} pageSize={50} />
```

**`ITableProps` fields:** `columns`, `data`, `getRowId` (required); `pageSize` (set to paginate), `caption`, `enableFilters`, `enableColumnToggle`, `enableColumnResize` (default `true`), `columnWidths` / `onColumnWidthsChange` (restore/persist resized widths), `emptyState`, `className`.

**`IColumnDef` fields:** `id`, `header` (required); `getValue` (value used for sorting/filtering and the default cell), `cell` (custom renderer), `sortable`/`sortFn`, `filter` (`text` or `select`), `align` (body cells — headers are always left), `width`, `resizable` (drag-to-resize, default `true`), `hideable`/`defaultHidden` (column toggle), `groupable`/`groupValue`/`groupLabel`.

**Notes:** grouping is one column at a time — collapsible groups across the full dataset, with the pager hidden while active. Columns use fixed widths, so when their total exceeds the container the table scrolls horizontally. Users can drag a header's right edge to resize a column (never narrower than its configured `width`) via the `useColumnResize` hook, and the column menu offers a "Reset column widths" action. The table itself stays state-store-agnostic: pass `columnWidths` to restore widths and handle `onColumnWidthsChange` (fired on resize-end and reset with the full px map) to persist them. All interactive state lives in the `useTableState` hook.

### Listing / ListingLoader / NoResults

```tsx
import { Listing } from "../../ui/components/listing/Listing";
import { ListingLoader } from "../../ui/components/listing_loader/ListingLoader";
import { NoResults } from "../../ui/components/no_results/NoResults";
```

### Modal

Dialog component built on Headless UI `Dialog`. Use `Modal` for the common case (wrapper + panel combined), or `ModalWrapper` and `ModalPanel` separately for custom layouts.

**Defaults:** `size="md"`, `showCloseButton={true}`

```tsx
import { Modal, ModalWrapper, ModalPanel } from "../../ui/components/modal/Modal";

// Simple modal
<Modal isOpen={isOpen} title="Confirm" onClose={handleClose}>
  <p>Are you sure?</p>

  <Button onClick={handleClose}>Cancel</Button>
  <Button onClick={handleConfirm}>Confirm</Button>
</Modal>

// Custom size, no close button
<Modal isOpen={isOpen} size="lg" showCloseButton={false} onClose={handleClose}>
  <p>Full content here</p>
</Modal>

// Separate wrapper + panel for custom layouts
<ModalWrapper isOpen={isOpen} size="xl" onClose={handleClose}>
  <ModalPanel title="Details" onClose={handleClose}>
    <p>Panel content</p>
  </ModalPanel>
</ModalWrapper>
```

**Sizes:** `sm`, `md`, `lg`, `xl`

### Pictogram

Decorative SVG pictograms loaded from `assets/pictograms/`. Used for illustrative purposes in empty states, onboarding, etc.

**Defaults:** `size="md"`, `brand="primary"`

```tsx
import { Pictogram } from "../../ui/components/pictogram/Pictogram";

<Pictogram name="health-check" />
<Pictogram brand="premium" name="health-check" size="lg" />
```

**Sizes:** `4xs` (16px), `3xs` (24px), `2xs` (36px), `xs` (48px), `sm` (56px), `md` (80px), `lg` (96px), `xl` (112px), `2xl` (160px)

**Brands:** `primary`, `premium`, `none`

**Adding a new pictogram:**

The source pictogram library is the **flamework** repo at `apps/next/public/assets/images/pictograms/`.

1. Add the SVG file to `assets/pictograms/` (the filename becomes the pictogram name)
2. Set the SVG dimensions to `width="200" height="200" viewBox="0 0 200 200"`
3. Replace the main fill colour with `style="fill: currentColor"` so it responds to the `brand` prop
4. Add the filename (without `.svg`) to the `IPictogramName` type in `Pictogram.tsx`

> Migrating a whole page to the new `Page` layout (header + pictogram + tabs)? See
> [`docs/design-system/page-migration.md`](../../../../docs/design-system/page-migration.md).

### Picker

Single-value selector built on Headless UI `Listbox` — the chosen option shows in the trigger button. Use it when the user picks one value from a list (as opposed to `Dropdown`, which fires actions). `value` is generic, so options can carry strings, numbers, or objects.

```tsx
import { Picker } from "../../ui/components/picker/Picker";
import { mdiViewGrid } from "@mdi/js";

<Picker options={options} value={value} onChange={setValue} />

// Style the trigger via `button` — it forwards all Button props (+ showChevron)
<Picker
  button={{ size: "xs", leftIconPath: mdiViewGrid }}
  options={options}
  value={value}
  onChange={setValue}
/>
```

**Props:** `options` (`{ label, value, iconPath?/icon? }[]`), `value`, `onChange` (required); `button` (props forwarded to the trigger `ListboxButton` — Button props + `showChevron`; any `children` is ignored, the label is always the selected option), `placement` (`"left"`/`"right"`, default `"right"` — which edge of the trigger the panel aligns to), `className`.

### Pill

Compact, rounded label for tags and statuses. Renders as a non-interactive `div` by default, or as a `button` when given `as="button"`. Accepts an icon via either `iconPath` (an MDI/Nexus path string) or `icon` (a custom node) — not both.

**Defaults:** `pillType="default"`

```tsx
import { Pill } from "../../ui/components/pill/Pill";
import { mdiCheckCircleOutline, mdiTag } from "@mdi/js";

// Variants
<Pill>Default</Pill>
<Pill pillType="success" iconPath={mdiCheckCircleOutline}>Success</Pill>
<Pill pillType="none">Unstyled</Pill>

// With an icon (path or custom node)
<Pill iconPath={mdiTag}>Tagged</Pill>
<Pill icon={<Icon path={mdiTag} size="none" />}>Custom node</Pill>

// As an interactive button
<Pill as="button" onClick={handleClick}>Clickable</Pill>
<Pill as="button" disabled>Disabled</Pill>
```

**Types:** `default`, `success`, `none` (opts out of styling) — more variants to come

### Image

Image wrapper with predefined aspect ratios, optional blur, and a fallback icon shown when the source fails to load. Resetting `src` clears the previous error state.

**Defaults:** `imageType="other"`

```tsx
import { Image } from "../../ui/components/image/Image";

<Image alt="Cover" src={url} imageType="collection" />
<Image alt="Preview" src={url} imageType="mod" isBlurred />
```

**Image types:** `collection` (4:5 portrait), `mod` (16:9 landscape), `other` (sized by container)

#### AdultAwareImage

Wraps `Image` for Nexus content (mods, collections, gallery, …) and blurs adult content according to the logged-in user's `adultBlurImages` preference. When no one is logged in (or the preference is unknown) it blurs by default, so adult content is never shown to a user who hasn't opted into seeing it. The base `Image` stays presentational; this wrapper owns the adult-content policy.

`isAdult` is **required** so the blur decision can never be forgotten at a call site. All other `Image` props (including `imageType`) pass straight through.

```tsx
import { AdultAwareImage } from "../../ui/components/image/AdultAwareImage";

<AdultAwareImage isAdult={file.adultContent} imageType="mod" alt="Preview" src={url} />
<AdultAwareImage isAdult={revision.adultContent} imageType="collection" alt="Cover" src={url} />
```

### PremiumBadge

Small diamond badge denoting premium membership.

```tsx
import { PremiumBadge } from "../../ui/components/premium_badge/PremiumBadge";

<PremiumBadge />;
```

### Bullet

Small rotated-square dot used as an inline marker or separator (e.g. between a label and an "Adult" tag). Defaults (`size-0.75`, 45° rotation, translucent-subdued colour) come from the `.nxm-bullet` class; pass `className` to override any of them — Tailwind utilities sit in a higher layer than `components`, so they win over the defaults.

```tsx
import { Bullet } from "../../ui/components/bullet/Bullet";

// Default
<Bullet />

// Override size and colour
<Bullet className="size-1 bg-neutral-subdued" />
```

## Adding New Components

1. Create a folder under `components/` for the component
2. Use `nxm-` prefixed CSS class names for styling
3. Import shared utilities from `../../utils/join_classes/joinClasses`, `../../utils/types`, etc.
4. Export the component directly from the source file (no barrel `index.ts` files)
5. Add a `*Demo.tsx` component if the component has visual states worth showcasing
