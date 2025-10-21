# Web Team Components ("next" Project)

This folder contains components adapted from the web team's "next" project for use in Vortex.

## Importing Components (Namespace Usage)

**IMPORTANT**: All Tailwind components are exported under the `Tailwind` namespace to avoid conflicts with existing Vortex components.

### Usage in Extensions

```tsx
// Import the Tailwind namespace
import { Tailwind } from 'vortex-api';

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
import { Tailwind } from 'vortex-api';

// Destructure the components you need
const { Icon, Button, Typography } = Tailwind;

function MyExtension() {
  return (
    <div>
      <Icon path="nxmVortex" size="lg" />
      <Button buttonType="primary">Click Me</Button>
      <Typography as="h1" typographyType="heading-2xl">Title</Typography>
    </div>
  );
}
```

### Direct Development Imports (Within Vortex Source)

When developing within the Vortex source code, you can import directly:

```tsx
// Direct import from source (for development within Vortex)
import { Icon } from '../../../tailwind/components/next/icon';
import { Button } from '../../../tailwind/components/next/button';
import { Typography } from '../../../tailwind/components/next/typography';
```

### Available Components

All components are available under the `Tailwind` namespace:
- `Tailwind.Icon` - Icon rendering (MDI + Nexus custom icons)
- `Tailwind.Button` - Button component
- `Tailwind.Typography` - Typography component
- `Tailwind.Link` - Link wrapper
- `Tailwind.CollectionTile` - Collection card
- `Tailwind.nxm*` - All 34 Nexus icon paths (e.g., `Tailwind.nxmVortex`)

### Type Exports

TypeScript types are also exported:

```tsx
import { Tailwind, type IconSize, type ButtonType } from 'vortex-api';

// Use the types
const mySize: IconSize = 'lg';
const myButtonType: ButtonType = 'primary';
```

## Organization

Components are organized by domain/feature:
- `typography/` - Typography system components
- `button/` - Button system components
- `icon/` - Icon rendering system (MDI + Nexus custom icons)
- `link/` - Link component for navigation
- `collectiontile/` - Collection card components for browsing

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
Semantic colors defined in `@theme`:
- `--color-neutral-inverted`, `--color-neutral-strong`, `--color-neutral-moderate`, `--color-neutral-subdued`, `--color-neutral-weak`
- `--color-neutral-800` - For filled buttons
- `--color-translucent-*` - For dark backgrounds
- `--color-primary-moderate`, `--color-primary-400` - Primary button and element colors
- `--color-stroke-moderate`, `--color-stroke-strong` - Border colors
- `--color-stroke-neutral-translucent-weak`, `--color-stroke-neutral-translucent-moderate` - Translucent borders
- `--color-surface-mid`, `--color-surface-high` - Card and panel backgrounds
- `--color-info-strong` - Informational tag color
- `--color-danger-400` - Warning/adult tag color
- `--color-success-moderate` - Success button color
- `--color-premium-moderate` - Premium button color

## Usage Example

```tsx
import { Typography } from '../../../tailwind/next/typography';

function MyComponent() {
  return (
    <Typography
      as="h1"
      typographyType="heading-2xl"
      appearance="strong"
    >
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
import { joinClasses, XOr, ResponsiveScreenSizes } from '../utils';
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
Icons are fully supported using Material Design Icons from `@mdi/js`:
```tsx
// With icon name (automatically looks up in @mdi/js)
<Button buttonType="primary" leftIconPath="mdiDownload">
  Download
</Button>

// With right icon
<Button buttonType="secondary" rightIconPath="mdiChevronRight">
  Next
</Button>

// With both icons
<Button buttonType="tertiary" leftIconPath="mdiCog" rightIconPath="mdiChevronDown">
  Settings
</Button>
```

Available icon names can be found at: https://pictogrammers.com/library/mdi/

**Nexus Mods Custom Icons:**
In addition to Material Design Icons, the Icon component supports 34 custom Nexus Mods icons:
```tsx
// Using Nexus Mods custom icons
<Button buttonType="primary" leftIconPath="nxmVortex">
  Launch Vortex
</Button>

<Button buttonType="secondary" leftIconPath="nxmCollection">
  Collections
</Button>

<Button buttonType="tertiary" leftIconPath="nxmInstall">
  Install Mod
</Button>
```

**Available Nexus Icons:**
- **Brand/App**: `nxmVortex`, `nxmMod`, `nxmModOutline`, `nxmCollection`, `nxmCollections`
- **Actions**: `nxmInstall`, `nxmDataCheck`, `nxmClipboard`, `nxmUnblock`
- **Stats/Display**: `nxmUniqueDownloads`, `nxmFileSize`, `nxmHandHeartOutline` (endorsement), `nxmRosette` (featured), `nxmStar`
- **Social/Publishers**: `nxmDiscord`, `nxmTikTok`, `nxmTwitch`, `nxmX`, `nxmElectronicArts`, `nxmEpicGames`, `nxmPayPal`
- **UI/Navigation**: `nxmBackArrow`, `nxmGridStandard`, `nxmGridCompact`, `nxmGridList`
- **Support**: `nxmBug`, `nxmShieldQuestion`, `nxmShieldCross`, `nxmTrackingCentre`
- **Gaming**: `nxmJoystick`

All Nexus icons are located in `src/tailwind/lib/icon-paths/` and can be imported directly:
```tsx
import { nxmVortex, nxmCollection } from '../../../tailwind/lib/icon-paths';
// or
import { nxmVortex, nxmCollection } from 'tailwind';
```

### Icon

Located in `icon/`

**Files:**
- `Icon.tsx` - Icon rendering component
- `index.ts` - Public exports

**Features:**
- Supports Material Design Icons from `@mdi/js` (5000+ icons)
- Supports 34 custom Nexus Mods icons
- Auto-resolution of icon names to SVG paths
- Named size system matching web team (xs, sm, md, lg, xl, 2xl, none)
- Custom size override with rem units
- Type-safe XOr constraint prevents conflicting size props
- Accessibility support with title attribute
- Direct SVG path data support

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

// Material Design Icon with named size
<Icon path="mdiAccount" size="md" />

// Nexus Mods Icon with named size
<Icon path="nxmVortex" size="lg" />

// Custom size with className (use size="none")
<Icon path="mdiDownload" size="none" className="tw:size-6" />

// Custom rem size with sizeOverride
<Icon path="mdiAccount" sizeOverride="1.75rem" />

// Direct SVG path
<Icon path="M12 2L2 7L12 12L22 7L12 2Z" size="sm" />

// With accessibility
<Icon path="mdiAccount" size="md" title="User Account" />
```

**Icon Resolution:**
The Icon component automatically resolves icon names:
1. Icons starting with `mdi` are looked up in `@mdi/js`
2. Icons starting with `nxm` are looked up in custom Nexus icon paths
3. Strings starting with `M` or `m` are treated as direct SVG path data

**Type Safety:**
The component uses an XOr type constraint - you can use either `size` OR `sizeOverride`, but not both:
```tsx
// ✅ Valid
<Icon path="mdiAccount" size="md" />
<Icon path="mdiAccount" sizeOverride="1.5rem" />

// ❌ TypeScript error - cannot use both
<Icon path="mdiAccount" size="md" sizeOverride="1.5rem" />
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
import { CollectionTile } from '../../../tailwind/next/collectiontile';

<CollectionTile
  id="collection-1"
  title="Ultimate Civil War Reloaded"
  author={{ name: 'RyukanoHi' }}
  coverImage="https://example.com/cover.jpg"
  tags={['Total Overhaul', 'Adult']}
  stats={{
    downloads: 320,
    size: '540MB',
    endorsements: 320
  }}
  description="The story of Stardew Valley expands..."
  onAddCollection={() => console.log('Add')}
  onViewPage={() => console.log('View')}
/>
```

**Demo:** See `CollectionTileDemo` component

**Note:** Icons are placeholder divs (no actual icons rendered). Avatar uses simple img tag or colored circle if no avatar provided.

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
- [ ] Add loading spinner animation to Button component
- [ ] Add more components from the web team (Input, Card, etc.)
- [ ] Implement TypographyLink component
