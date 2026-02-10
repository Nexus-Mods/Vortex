# Web Team Components ("next" Project)

This folder contains components adapted from the web team's "next" project for use in Vortex.

## Importing Components (Namespace Usage)

**IMPORTANT**: All Tailwind components are exported under the `Tailwind` namespace to avoid conflicts with existing Vortex components.

### Usage in Extensions

```tsx
// Import the Tailwind namespace
import { Tailwind } from "vortex-api";

// Use components via the namespace
function MyExtension() {
    return (
        <div>
            <Tailwind.Icon path="nxmVortex" size="lg" />
            <Tailwind.Button buttonType="primary">Click Me</Tailwind.Button>
            <Tailwind.Typography as="h1" typographyType="heading-2xl">
                My Extension
            </Tailwind.Typography>
        </div>
    );
}
```

### Destructuring for Convenience

```tsx
import { Tailwind } from "vortex-api";

// Destructure the components you need
const { Icon, Button, Typography } = Tailwind;

function MyExtension() {
    return (
        <div>
            <Icon path="nxmVortex" size="lg" />
            <Button buttonType="primary">Click Me</Button>
            <Typography as="h1" typographyType="heading-2xl">
                Title
            </Typography>
        </div>
    );
}
```

### Direct Development Imports (Within Vortex Source)

When developing within the Vortex source code, you can import directly:

```tsx
// Direct import from source (for development within Vortex)
import { Icon } from "../../../tailwind/components/next/icon";
import { Button } from "../../../tailwind/components/next/button";
import { Typography } from "../../../tailwind/components/next/typography";
```

### Available Components

All components are available under the `Tailwind` namespace:

- `Tailwind.Icon` - Icon rendering (MDI + Nexus custom icons)
- `Tailwind.Button` - Button component
- `Tailwind.Typography` - Typography component
- `Tailwind.Link` - Link wrapper
- `Tailwind.CollectionTile` - Collection card
- `Tailwind.FormField` - Form field wrapper with labels and validation
- `Tailwind.FormFieldWrap` - Helper for spacing multiple form fields
- `Tailwind.Input` - Input component with validation
- `Tailwind.Select` - Select dropdown with custom styling
- `Tailwind.TabProvider` - Tabs context provider
- `Tailwind.TabBar` - Tabs container
- `Tailwind.TabButton` - Selectable tab
- `Tailwind.TabLink` - Link tab (non-selectable)
- `Tailwind.TabPanel` - Tab content panel
- `Tailwind.nxm*` - All 34 Nexus icon paths (e.g., `Tailwind.nxmVortex`)

### Type Exports

TypeScript types are also exported:

```tsx
import { Tailwind, type IconSize, type ButtonType } from "vortex-api";

// Use the types
const mySize: IconSize = "lg";
const myButtonType: ButtonType = "primary";
```

## Organization

Components are organized by domain/feature:

- `typography/` - Typography system components
- `button/` - Button system components
- `icon/` - Icon rendering system (MDI + Nexus custom icons)
- `link/` - Link component for navigation
- `collectiontile/` - Collection card components for browsing
- `form/` - Form components (FormField wrapper, Input component)

## Adaptations Made

All components have been adapted to work with Vortex's Tailwind v4 setup:

### 1. **Tailwind Prefix**

All Tailwind classes use the `tw:` prefix to avoid conflicts with existing Bootstrap/SASS styles:

```tsx
// Web team original:
<div className="text-neutral-strong">

// Vortex adapted:
<div className="tw:text-neutral-strong">
```

**CRITICAL: Prefix Syntax with Variants**

With the `tw:` prefix in Tailwind v4, the prefix must come **FIRST**, then the variant, then the utility:

```tsx
// ❌ WRONG - This will NOT work:
<button className="hover:tw:text-neutral-moderate">

// ✅ CORRECT - Prefix comes first:
<button className="tw:hover:text-neutral-moderate">

// Pattern: [prefix]:[variant]:[utility]
// Examples:
tw:hover:bg-surface-high
tw:focus:border-primary-moderate
tw:disabled:opacity-40
tw:aria-selected:text-neutral-strong
```

**Common Mistakes to Avoid:**

- `hover:tw:*` ❌ → `tw:hover:*` ✅
- `focus:tw:*` ❌ → `tw:focus:*` ✅
- `disabled:tw:*` ❌ → `tw:disabled:*` ✅
- `group-hover:tw:*` ❌ → `tw:group-hover:*` ✅

**Note**: Named group variants like `group/name` and `group-hover/name:tw:*` are not supported with our prefix setup. Use standard `:hover` selectors instead.

### 2. **Dependencies**

Web-specific dependencies have been replaced or adapted:

- `@/utils/join-classes` → **Shared `utils.ts`** at `src/tailwind/components/next/utils.ts`
- `@/types/x-or.types` → **Shared `utils.ts`** at `src/tailwind/components/next/utils.ts`
- `@/domains/ui/icon` → `Icon.tsx` using Material Design Icons from `@mdi/js` + Nexus custom icons from `lib/icon-paths/`
- `@/lib/icon-paths` → **Icon paths library** at `src/tailwind/lib/icon-paths/` with 34 custom Nexus icons
- `@/domains/ui/link` → `Link.tsx` simple wrapper (anchor tag for Electron)
- `@/domains/ui/typography` → Converted Typography component
- Next.js routing → Removed (Electron doesn't use Next.js)

### 3. **CSS Classes**

Custom classes are defined in `src/stylesheets/tailwind-v4.css`:

**Typography:**

- `.tw\:typography-heading-2xl` through `.tw\:typography-heading-xs`
- `.tw\:typography-title-md` through `.tw\:typography-title-xs`
- `.tw\:typography-body-2xl` through `.tw\:typography-body-xs`

**Button:**

- `.tw\:hover-overlay` - Light hover effect overlay
- `.tw\:hover-dark-overlay` - Dark hover effect overlay

### 4. **Colors**

Semantic colors defined in `@theme` in `src/stylesheets/tailwind-v4.css`:

**Neutral Colors:**

- `--color-neutral-inverted`, `--color-neutral-strong`, `--color-neutral-moderate`, `--color-neutral-subdued`, `--color-neutral-weak`
- `--color-neutral-800` - For filled buttons

**Stroke/Border Colors:**

- `--color-stroke-moderate` - #d4d4d8 (Neutral-300) - **Use for borders and dividers**
- `--color-stroke-strong` - #a1a1aa (Neutral-400)
- `--color-stroke-neutral-translucent-weak` - rgba(255, 255, 255, 0.1)
- `--color-stroke-neutral-translucent-subdued` - rgba(255, 255, 255, 0.2)
- `--color-stroke-neutral-translucent-moderate` - rgba(255, 255, 255, 0.3)
- `--color-stroke-neutral-translucent-strong` - rgba(255, 255, 255, 0.6)

**⚠️ Note**: There is **NO** `--color-stroke-subdued` - use `stroke-moderate` or `stroke-neutral-translucent-subdued` instead.

**Surface Colors:**

- `--color-surface-mid`, `--color-surface-high` - Card and panel backgrounds
- `--color-surface-low` - Select/input backgrounds
- `--color-translucent-*` - For dark backgrounds

**Semantic Colors:**

- `--color-primary-moderate`, `--color-primary-400` - Primary button and element colors
- `--color-info-strong` - Informational tag color
- `--color-danger-400`, `--color-danger-strong` - Warning/error colors
- `--color-success-moderate` - Success button color
- `--color-premium-moderate` - Premium button color

## Usage Example

```tsx
import { Typography } from "../../../tailwind/next/typography";

function MyComponent() {
    return (
        <Typography as="h1" typographyType="heading-2xl" appearance="strong">
            Hello World
        </Typography>
    );
}
```

## Shared Utilities

All components share common utilities from `utils.ts`:

- **`joinClasses()`** - Joins class names, filtering falsy values, supports conditional classes
- **`XOr<T, U>`** - TypeScript utility type for exclusive OR type constraints
- **`ResponsiveScreenSizes`** - Type for Tailwind responsive breakpoints

Import from the shared file:

```tsx
import { joinClasses, XOr, ResponsiveScreenSizes } from "../utils";
```

## Adding New Components

When adding new components from the web team:

1. **Create a folder** under `src/tailwind/components/next/` for the component
2. **Add `tw:` prefix** to all Tailwind classes
3. **Import shared utilities** from `../utils` instead of creating new utils files
4. **Replace web dependencies** with local equivalents or stubs
5. **Add CSS definitions** to `src/stylesheets/tailwind-v4.css` if needed
6. **Create a demo component** to showcase the component
7. **Update this README** with the new component

## Components

### Typography

Located in `typography/`

**Files:**

- `Typography.tsx` - Main Typography component
- `TypographyDemo.tsx` - Demo showcasing all typography styles
- `index.ts` - Public exports

**Features:**

- Predefined typography sizes (heading, title, body)
- Color appearances (strong, moderate, subdued, weak)
- Responsive typography (different sizes per breakpoint)
- Semantic HTML elements (h1-h6, p, span, div, ul)

**Usage:**

```tsx
import { Typography } from '../../../tailwind/next/typography';

// Basic usage
<Typography as="h1" typographyType="heading-2xl">
  My Heading
</Typography>

// With appearance
<Typography appearance="subdued" typographyType="body-md">
  Subdued text
</Typography>

// Responsive
<Typography
  typographyType={{
    default: 'body-sm',
    md: 'body-md',
    lg: 'body-lg',
  }}
>
  Responsive text
</Typography>
```

**Demo:** See `TypographyDemo` component on the Dashboard page

### Button

Located in `button/`

**Files:**

- `Button.tsx` - Main Button component
- `ButtonDemo.tsx` - Demo showcasing all button types and states
- `index.ts` - Public exports

**Dependencies:**

- Uses `Icon` component from `../icon/`
- Uses `Link` component from `../link/`

**Features:**

- Multiple button types (primary, secondary, tertiary, success, premium)
- Two sizes (sm, md) with responsive support
- Loading states (visual spinner pending icon implementation)
- Disabled states
- Filled variants for secondary/tertiary buttons
- Can render as button, link, or anchor tag
- Custom content support

**Usage:**

```tsx
import { Button } from '../../../tailwind/next/button';

// Basic button
<Button buttonType="primary" size="md">
  Click Me
</Button>

// Secondary with filled variant
<Button buttonType="secondary" size="md" filled="strong">
  Filled Button
</Button>

// Success button
<Button buttonType="success" size="sm">
  Success
</Button>

// Loading state
<Button buttonType="primary" isLoading>
  Processing...
</Button>

// As a link
<Button as="link" buttonType="primary" href="https://example.com" isExternal>
  External Link
</Button>

// Responsive size
<Button buttonType="primary" size="sm" isResponsive>
  Responsive Button
</Button>
```

**Demo:** See `ButtonDemo` component

**Icon Support:**
Icons are supported using Material Design Icons from `@mdi/js` and custom Nexus icons from `tailwind/lib/icon-paths`. The `path` prop accepts a full SVG path string, so you must import the icon path first:

```tsx
import { mdiDownload, mdiChevronRight, mdiCog, mdiChevronDown } from "@mdi/js";
import { nxmVortex, nxmCollection, nxmInstall } from "../../../tailwind/lib/icon-paths";

// With left icon
<Button buttonType="primary" leftIconPath={mdiDownload}>
  Download
</Button>

// With right icon
<Button buttonType="secondary" rightIconPath={mdiChevronRight}>
  Next
</Button>

// With both icons
<Button buttonType="tertiary" leftIconPath={mdiCog} rightIconPath={mdiChevronDown}>
  Settings
</Button>

// With Nexus Mods custom icons
<Button buttonType="primary" leftIconPath={nxmVortex}>
  Launch Vortex
</Button>
```

Available MDI icons can be found at: https://pictogrammers.com/library/mdi/

Nexus icons are located in `src/tailwind/lib/icon-paths/` and include icons for brand, actions, stats, social, navigation, and more.

### Icon

Located in `icon/`

**Files:**

- `Icon.tsx` - Icon rendering component
- `index.ts` - Public exports

**Features:**

- Accepts full SVG path strings (import from `@mdi/js` or `tailwind/lib/icon-paths`)
- Named size system matching web team (xs, sm, md, lg, xl, 2xl, none)
- Accessibility support with title attribute

**Size System:**

- `xs`: 0.75rem (12px) - Extra small icons
- `sm`: 1rem (16px) - Small icons
- `md`: 1.25rem (20px) - Medium icons (**DEFAULT**)
- `lg`: 1.5rem (24px) - Large icons
- `xl`: 2rem (32px) - Extra large icons
- `2xl`: 3rem (48px) - 2X extra large icons
- `none`: Size controlled via className

**Usage:**

```tsx
import { Icon } from '../../../tailwind/components/next/icon';
import { mdiAccount, mdiDownload } from "@mdi/js";
import { nxmVortex } from "../../../tailwind/lib/icon-paths";

// Material Design Icon with named size
<Icon path={mdiAccount} size="md" />

// Nexus Mods Icon with named size
<Icon path={nxmVortex} size="lg" />

// Custom size with className (use size="none")
<Icon path={mdiDownload} size="none" className="tw:size-6" />

// With accessibility
<Icon path={mdiAccount} size="md" title="User Account" />
```

### Link

Located in `link/`

**Files:**

- `Link.tsx` - Link wrapper component
- `index.ts` - Public exports

**Features:**

- Simple anchor tag wrapper for Electron
- External link support with `rel` and `target` attributes
- Ref forwarding support
- TypeScript-typed props

**Usage:**

```tsx
import { Link } from '../../../tailwind/components/next/link';

// Internal link
<Link href="/dashboard">Dashboard</Link>

// External link
<Link href="https://nexusmods.com" isExternal>
  Nexus Mods
</Link>

// With className
<Link href="/settings" className="tw:text-primary-moderate">
  Settings
</Link>
```

**Note:** This component is a simple wrapper and does not use Next.js routing since Vortex is an Electron app.

### CollectionTile

Located in `collectiontile/`

**Files:**

- `CollectionTile.tsx` - Collection card component
- `CollectionTileDemo.tsx` - Demo with sample collection data
- `index.ts` - Public exports

**Features:**

- Fixed dimensions (465x288px) matching Figma design
- Collection cover image (166x207px)
- Title, author with avatar placeholder
- Tag system (max 2 tags, "Adult" tag uses danger-400 color)
- Stats display (downloads, size, endorsements) with icon placeholders
- Description truncation (3 lines max with line-clamp-3)
- Action buttons (primary "Add collection", tertiary "View page")
- Surface-mid/high backgrounds for dark theme

**Usage:**

```tsx
import { CollectionTile } from "../../../tailwind/next/collectiontile";

<CollectionTile
    id="collection-1"
    title="Ultimate Civil War Reloaded"
    author={{ name: "RyukanoHi" }}
    coverImage="https://example.com/cover.jpg"
    tags={["Total Overhaul", "Adult"]}
    stats={{
        downloads: 320,
        size: "540MB",
        endorsements: 320,
    }}
    description="The story of Stardew Valley expands..."
    onAddCollection={() => console.log("Add")}
    onViewPage={() => console.log("View")}
/>;
```

**Demo:** See `CollectionTileDemo` component

**Note:** Icons are placeholder divs (no actual icons rendered). Avatar uses simple img tag or colored circle if no avatar provided.

### Form

Located in `form/` with subcomponents in `formfield/`, `input/`, and `select/`

**Files:**

- `formfield/FormField.tsx` - Form field wrapper component
- `formfield/index.ts` - FormField exports
- `input/Input.tsx` - Input component
- `input/InputDemo.tsx` - Demo showcasing all input variants
- `input/index.ts` - Input exports
- `select/Select.tsx` - Select dropdown component
- `select/SelectDemo.tsx` - Demo showcasing all select variants
- `select/index.ts` - Select exports
- `index.ts` - Main form exports

**Dependencies:**

- Uses Typography from `../typography`
- Uses Icon from `../icon` (Select dropdown icon)
- Uses shared utilities from `../utils`
- Input and Select components use FormField wrapper
- Select uses mdiMenuDown icon from @mdi/js

**Features:**

- **FormField wrapper**: Labels (visible/hidden), hints (single/multiple), error messages, character counter
- **Input types**: text, email, password, url, number, time, date
- **Select dropdown**: Custom styled select with dropdown icon, supports optgroup
- **Validation states**: Error messages with red border styling
- **Accessibility**: `aria-describedby`, `aria-invalid`, `sr-only` labels
- **Character counter**: Shows remaining characters with color-coded warnings (Input only)
- **Required fields**: Automatic "(Required)" label suffix
- **States**: Disabled, read-only, with placeholder, with value
- **FormFieldWrap**: Helper component for vertical spacing between form fields

**Usage:**

```tsx
import { Input } from '../../../tailwind/components/next/form/input';

// Basic input
<Input
  id="username"
  label="Username"
  type="text"
  placeholder="Enter username..."
/>

// With validation
<Input
  id="email"
  label="Email Address"
  type="email"
  required
  errorMessage="Please enter a valid email address"
/>

// With hints
<Input
  id="password"
  label="Password"
  type="password"
  hints={[
    'Must be at least 8 characters',
    'Must contain uppercase and lowercase',
    'Must contain at least one number',
  ]}
/>

// With character counter
<Input
  id="bio"
  label="Bio"
  type="text"
  maxLength={200}
  placeholder="Tell us about yourself..."
  hints="Keep it short and sweet"
/>

// Multiple fields with spacing
import { FormFieldWrap } from '../../../tailwind/components/next/form/formfield';

<FormFieldWrap>
  <Input id="firstName" label="First Name" type="text" required />
  <Input id="lastName" label="Last Name" type="text" required />
  <Input id="email" label="Email" type="email" required />
</FormFieldWrap>

// Using Tailwind namespace
import { Tailwind } from 'vortex-api';

<Tailwind.FormFieldWrap>
  <Tailwind.Input id="name" label="Name" type="text" />
  <Tailwind.Input id="email" label="Email" type="email" />
</Tailwind.FormFieldWrap>

// Select dropdown
import { Select } from '../../../tailwind/components/next/form/select';

<Select id="country" label="Country">
  <option value="">Select a country...</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
</Select>

// Select with validation
<Select
  id="role"
  label="Role"
  required
  errorMessage="Please select a role"
>
  <option value="">Select role...</option>
  <option value="admin">Admin</option>
  <option value="user">User</option>
</Select>

// Select with hints
<Select
  id="language"
  label="Language"
  hints="Choose your preferred language"
>
  <option value="en">English</option>
  <option value="es">Spanish</option>
  <option value="fr">French</option>
</Select>

// Select with optgroups
<Select id="game" label="Select Game">
  <optgroup label="Bethesda Games">
    <option value="skyrim">Skyrim</option>
    <option value="fallout4">Fallout 4</option>
  </optgroup>
  <optgroup label="CD Projekt Games">
    <option value="witcher3">The Witcher 3</option>
    <option value="cyberpunk">Cyberpunk 2077</option>
  </optgroup>
</Select>

// Using Tailwind namespace
<Tailwind.Select id="priority" label="Priority">
  <option value="high">High</option>
  <option value="medium">Medium</option>
  <option value="low">Low</option>
</Tailwind.Select>
```

**Demo:** See `InputDemo` and `SelectDemo` components showcasing all input and select variants

**Props:**

**FormField:**

- `label` (string) - Field label text
- `hideLabel` (boolean) - Hides label visually (still accessible to screen readers)
- `hints` (string | string[]) - Helper text shown below input
- `hintsTypographyType` (TypographyTypes) - Typography size for hints (default: 'body-md')
- `errorMessage` (string) - Error message (applies error styling to input)
- `showRequiredLabel` (boolean) - Shows "(Required)" suffix in label
- `disabled` (boolean) - Disables the field
- `maxLength` (number) - Shows character counter with remaining count
- `inputLength` (number) - Current input length (for character counter)

**Input:**

- Extends all `FormField` props
- Extends all native HTML `input` attributes
- `type` ('text' | 'email' | 'password' | 'url' | 'number' | 'time' | 'date')
- `fieldClassName` (string) - Additional className for FormField wrapper
- `value` (string | number) - Controlled input value
- `defaultValue` (string | number) - Uncontrolled initial value
- `readOnly` (boolean) - Makes input read-only

**Select:**

- Extends all `FormField` props
- Extends all native HTML `select` attributes
- `children` (ReactNode) - `<option>` and `<optgroup>` elements
- Supports `value`, `defaultValue`, `onChange`, `multiple`, etc.
- Custom dropdown icon (mdiMenuDown) with hover/focus states
- Styled appearance with `tw:appearance-none` for custom design

**Colors Used (Input & Select):**

- `--color-neutral-strong` - Input/select text
- `--color-neutral-moderate` - Character counter (normal)
- `--color-neutral-subdued` - Placeholder text, hint text, dropdown icon
- `--color-danger-strong` - Error border, error text, character counter (critical)
- `--color-warning-strong` - Character counter (warning threshold)
- `--color-surface-translucent-mid` - Focus background (Input), error background
- `--color-surface-translucent-low` - Hover background (Input)
- `--color-surface-low` - Select background
- `--color-translucent-dark-400` - Default input background
- `--color-stroke-subdued` - Default border
- `--color-stroke-strong` - Focus border
- `--color-stroke-moderate` - Hover border
- `--color-pure-white` - Select hover/focus border, dropdown icon hover/focus

### Tabs

Located in `tabs/` with subcomponents in `tab-bar/`, `tab/`, and `tab-panel/`

**Files:**

- `tabs/tabs.context.tsx` - TabProvider and useTabContext hook
- `tabs/tab-bar/TabBar.tsx` - Container with tablist role
- `tabs/tab/Tab.tsx` - TabButton, TabLink, and TabContent components
- `tabs/tab-panel/TabPanel.tsx` - Content panel (show/hide)
- `tabs/TabsDemo.tsx` - Demo showcasing all tab features
- `tabs/index.ts` - Main tabs exports

**Dependencies:**

- Uses Typography from `../typography`
- Uses shared utilities from `../utils` (joinClasses, getTabId)
- Uses `numeral` library for formatting count badges
- Uses React Context for state management

**Features:**

- **Context-based state management**: TabProvider wrapper required
- **Two tab types**: TabButton (selectable) and TabLink (focusable, for navigation)
- **Keyboard navigation**: Arrow Left/Right, Home, End keys with wrapping
- **Count badges**: Optional number display with formatting
- **Accessibility**: Full ARIA support (roles, aria-controls, aria-selected)
- **Focus management**: Automatic focus handling for keyboard users
- **Horizontal scrolling**: Custom scrollbar for overflow tabs

**Architecture:**
The tabs system uses React Context to manage state across all tab components:

1. **TabProvider**: Context provider that wraps the entire tab system
2. **TabBar**: Container with `role="tablist"` and bottom border
3. **TabButton**: Selectable tab that changes content when clicked
4. **TabLink**: Focusable tab that acts as a link (doesn't change content)
5. **TabPanel**: Content panel that shows/hides based on selected tab

**Usage:**

```tsx
import { Tailwind } from "vortex-api";

const { TabProvider, TabBar, TabButton, TabLink, TabPanel } = Tailwind;

function MyTabs() {
    const [selectedTab, setSelectedTab] = useState("overview");

    return (
        <TabProvider
            tab={selectedTab}
            tabListId="my-tabs"
            onSetSelectedTab={setSelectedTab}
        >
            <TabBar>
                <TabButton name="Overview" />
                <TabButton name="Files" count={42} />
                <TabButton name="Settings" />
                <TabLink name="Docs" href="https://nexusmods.com" />
            </TabBar>

            <TabPanel name="Overview">
                <p>Overview content...</p>
            </TabPanel>

            <TabPanel name="Files">
                <p>Files content with 42 items...</p>
            </TabPanel>

            <TabPanel name="Settings">
                <p>Settings content...</p>
            </TabPanel>
        </TabProvider>
    );
}
```

**TabButton vs TabLink:**

- **TabButton**: Changes content when clicked, selectable, `type="button"`
- **TabLink**: Navigates to URL when clicked, not selectable, `<a>` element
- Both are focusable with keyboard navigation (Arrow keys)

**Keyboard Navigation:**

- **Arrow Left/Right**: Navigate between tabs (wraps around)
- **Home**: Jump to first tab
- **End**: Jump to last tab
- **Tab button behavior**: Selecting with arrows changes content
- **Link tab behavior**: Focusing with arrows doesn't change content (must click)

**Count Badges:**

```tsx
// With count badge
<TabButton name="Comments" count={1543} />
// Displays as: "Comments 1,543" (formatted with locale separators)

// Without count badge
<TabButton name="Overview" />
```

**Props:**

**TabProvider:**

- `tab` (string, required) - Currently selected tab name
- `tabListId` (string, required) - Unique ID for this tab list
- `onSetSelectedTab` (function, optional) - Callback when tab changes
- `children` (ReactNode) - Tab components

**TabBar:**

- `children` (ReactNode) - Tab components (TabButton, TabLink)
- `className` (string, optional) - Additional CSS classes

**TabButton:**

- `name` (string, required) - Tab display name (used as ID via getTabId)
- `count` (number, optional) - Count badge number
- `disabled` (boolean, optional) - Disable the tab
- `className` (string, optional) - Additional CSS classes
- Extends all native `<button>` attributes

**TabLink:**

- `name` (string, required) - Tab display name
- `count` (number, optional) - Count badge number
- `href` (string) - Link URL
- `target` (string, optional) - Link target (\_blank, etc.)
- `className` (string, optional) - Additional CSS classes
- Extends all native `<a>` attributes

**TabPanel:**

- `name` (string, required) - Panel name (matches tab name)
- `children` (ReactNode) - Panel content

**Demo:** See `TabsDemo` component showcasing all features

**Colors Used:**

- `--color-neutral-subdued` - Default tab text, scrollbar
- `--color-neutral-moderate` - Hover tab text, scrollbar hover
- `--color-neutral-strong` - Selected tab text
- `--color-primary-moderate` - Selected tab border
- `--color-surface-mid` - Count badge background
- `--color-surface-high` - Count badge hover/selected background
- `--color-stroke-subdued` - TabBar bottom border

**Custom CSS:**

- `.tw\:scrollbar` - Custom scrollbar for horizontal overflow in TabBar

**React 16 Compatibility:**
The tabs system has been adapted for React 16 compatibility by replacing the React 19 `use()` hook with `useContext()`.

## Testing

After making changes:

1. Run `yarn build` to compile TypeScript and generate Tailwind CSS
2. Launch Vortex and navigate to the Dashboard
3. Verify components render correctly
4. Check for console errors

## Future Work

- [x] Extract common utilities to a shared location (`utils.ts`)
- [x] Implement proper Icon component with MDI path support
- [x] Add icon rendering to Button component (left/right icons)
- [x] Add Input component with FormField wrapper
- [x] Add Select dropdown component
- [x] Add Tabs component system with keyboard navigation
- [ ] Add loading spinner animation to Button component
- [ ] Add more components from the web team (Textarea, Checkbox, Radio, Toggle, etc.)
- [ ] Implement TypographyLink component
