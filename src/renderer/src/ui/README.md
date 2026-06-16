# Design System Components

Components adapted from the web team's "next" project for use in Vortex.

## Directory Structure

```
ui/
├── components/
│   ├── bullet/          - Small rotated-square dot used as an inline marker/separator
│   ├── button/          - Button system (brand × appearance matrix)
│   ├── collectiontile/  - Collection card with image, metadata, and actions
│   ├── dropdown/        - Dropdown menu (Headless UI Menu)
│   ├── form/            - Form components
│   │   ├── formfield/   - Form field wrapper with labels and validation
│   │   ├── input/       - Text input with validation
│   │   └── select/      - Select dropdown with custom styling
│   ├── icon/            - Icon rendering (MDI + Nexus custom icons)
│   ├── image/           - Image wrapper with aspect ratios and fallback (+ adult-aware variant)
│   ├── listbox/         - Listbox select (Headless UI Listbox)
│   ├── listing/         - List display component
│   ├── modal/           - Modal dialog (Headless UI Dialog)
│   ├── pictogram/       - Decorative SVG pictograms
│   ├── listing_loader/  - Loading skeleton for lists
│   ├── no_results/      - Empty state component
│   ├── pagination/      - Pagination controls with jump-to-page
│   ├── picker/          - Picker component
│   ├── pill/            - Compact rounded label for tags and statuses
│   ├── premium_badge/   - Premium diamond badge
│   ├── tabs/            - Tabbed interface with context-based state
│   ├── toolbar/         - Horizontal toolbar; groups collapse overflow into a kebab dropdown
│   └── typography/      - Typography system (heading, title, body)
├── lib/
│   └── icon_paths/      - 34 custom Nexus Mods SVG icon paths
├── utils/
│   ├── get_tab_id/      - Converts tab names to valid HTML element IDs
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
import { getTabId } from "../../ui/utils/get_tab_id/getTabId";
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
<Button size="xs">Small</Button>
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

**Brands:** `primary`, `info`, `neutral`, `success`, `premium`
**Appearances:** `strong` (solid fill), `moderate` (subtle surface), `subdued` (outline), `weak` (text only)
**Sizes:** `xs`, `sm`, `md`

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

**Defaults:** `as="p"`, `appearance="strong"`, `typographyType` inferred from `as` — only set these when you need something different.

When `typographyType` is omitted it falls back based on `as`: `h1`→`heading-2xl`, `h2`→`heading-xl`, `h3`→`heading-lg`, `h4`→`heading-md`, `h5`→`heading-sm`, `h6`→`heading-xs`, everything else→`body-md`.

```tsx
import { Typography } from "../../ui/components/typography/Typography";

// Defaults to <p> with body-md and strong appearance
<Typography>Some body text</Typography>

// Only override what differs
<Typography as="h1">Page Heading</Typography>
<Typography appearance="subdued">Muted text</Typography>
<Typography as="span" typographyType="body-sm">Inline small text</Typography>

// Responsive
<Typography typographyType={{ default: "body-sm", md: "body-md", lg: "body-lg" }}>
  Responsive text
</Typography>
```

**Elements:** `h1`–`h6`, `p`, `span`, `div`, `ul`
**Types:** `heading-2xl` through `heading-xs`, `title-md` through `title-xs`, `body-2xl` through `body-xs`
**Appearances:** `strong`, `moderate`, `subdued`, `weak`, `inverted`, `none`

### Tabs

Context-based tab system with keyboard navigation.

```tsx
import { TabButton } from "../../ui/components/tabs/Tab";
import { TabBar } from "../../ui/components/tabs/TabBar";
import { TabPanel } from "../../ui/components/tabs/TabPanel";
import { TabProvider } from "../../ui/components/tabs/tabs.context";

function MyTabs() {
    const [selectedTab, setSelectedTab] = useState("overview");

    return (
        <TabProvider tab={selectedTab} tabListId="my-tabs" onSetSelectedTab={setSelectedTab}>
            <TabBar>
                <TabButton name="Overview" />
                <TabButton name="Files" count={42} />
                <TabButton name="Settings" disabled />
            </TabBar>

            <TabPanel name="Overview">Overview content</TabPanel>
            <TabPanel name="Files">Files content</TabPanel>
            <TabPanel name="Settings">Settings content</TabPanel>
        </TabProvider>
    );
}
```

**Keyboard:** Arrow Left/Right (navigate, wraps), Home/End (jump to first/last)
**Tab types:** `primary` (default), `secondary` (count displayed with parentheses)

### Toolbar

Horizontal toolbar made of one or more rounded `ToolbarGroup` "pills". A group is **data-driven**: pass it an array of `IToolbarAction` descriptors and it renders each as an icon `Button`. When a group has more than `maxVisible` actions (default `7`), the trailing slot becomes a kebab (`⋮`) menu and the overflow actions move into its dropdown — the same descriptor renders as a `Button` while visible and a `DropdownItem` once collapsed.

**Defaults:** `maxVisible={7}`. Pass `maxVisible={null}` to disable collapsing and always render every action.

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

    {/* Never collapse — show every action regardless of count */}
    <ToolbarGroup actions={contextualActions} maxVisible={null} />
</Toolbar>;
```

**`IToolbarAction` fields:** `label` (required — the accessible name, dropdown label, and button text when `showLabel`), `iconPath`, `onClick`, `disabled`, `brand` (defaults to `neutral`), `showLabel` (render the label as visible button text instead of icon-only, e.g. a "1 selected" pill).

Actions are keyed internally by `label`, so labels should be unique within a group. The kebab is generated automatically — callers never author it.

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

### Dropdown

Menu component built on Headless UI `Menu`.

```tsx
import { Dropdown } from "../../ui/components/dropdown/Dropdown";
import { DropdownItem } from "../../ui/components/dropdown/DropdownItem";
import { DropdownItems } from "../../ui/components/dropdown/DropdownItems";
import { DropdownDivider } from "../../ui/components/dropdown/DropdownDivider";
```

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

**Defaults:** `size="md"`, `theme="primary"`

```tsx
import { Pictogram } from "../../ui/components/pictogram/Pictogram";

<Pictogram name="health-check" />
<Pictogram name="health-check" size="lg" theme="premium" />
```

**Sizes:** `4xs` (16px), `3xs` (24px), `2xs` (36px), `xs` (48px), `sm` (56px), `md` (80px), `lg` (96px), `xl` (112px), `2xl` (160px)

**Themes:** `primary`, `premium`, `creator`, `info`, `none`

**Adding a new pictogram:**

1. Add the SVG file to `assets/pictograms/` (the filename becomes the pictogram name)
2. Set the SVG dimensions to `width="200" height="200" viewBox="0 0 200 200"`
3. Replace the main fill colour with `style="fill: currentColor"` so it responds to the `theme` prop
4. Add the filename (without `.svg`) to the `PictogramName` type in `Pictogram.tsx`

### Picker

```tsx
import { Picker } from "../../ui/components/picker/Picker";
```

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
