# Web Team Components ("next" Project)

This folder contains components adapted from the web team's "next" project for use in Vortex.

## Organization

Components are organized by domain/feature:
- `typography/` - Typography system components
- `button/` - Button system components

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
Web-specific dependencies have been replaced or stubbed:
- `@/utils/join-classes` → **Shared `utils.ts`** at `src/tailwind/components/next/utils.ts`
- `@/types/x-or.types` → **Shared `utils.ts`** at `src/tailwind/components/next/utils.ts`
- `@/domains/ui/icon` → `Icon.tsx` stub (returns null, icons won't render)
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
- `--color-primary-moderate` - Primary button color
- `--color-stroke-moderate`, `--color-stroke-strong` - Border colors
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
- `Icon.tsx` - Icon stub (placeholder, icons won't render)
- `Link.tsx` - Simple Link wrapper for Electron
- `index.ts` - Public exports

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

**Note:** Icon support (leftIcon, rightIcon, loading spinner) is stubbed out. The Icon component returns null, so icons won't visually render. Text-only buttons work fully.

## Testing

After making changes:

1. Run `yarn build` to compile TypeScript and generate Tailwind CSS
2. Launch Vortex and navigate to the Dashboard
3. Verify components render correctly
4. Check for console errors

## Future Work

- [x] Extract common utilities to a shared location (`utils.ts`)
- [ ] Implement proper Icon component with MDI path support
- [ ] Add icon rendering to Button component (loading spinner, left/right icons)
- [ ] Add more components from the web team (Input, Card, etc.)
- [ ] Implement TypographyLink once Icon component is ready
