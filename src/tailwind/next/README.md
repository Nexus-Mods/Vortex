# Web Team Components ("next" Project)

This folder contains components adapted from the web team's "next" project for use in Vortex.

## Organization

Components are organized by domain/feature:
- `typography/` - Typography system components

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
- `@/utils/join-classes` → Local `utils.ts`
- `@/types/x-or.types` → Local `utils.ts`
- `@/domains/ui/icon` → Not yet implemented (stub needed)
- `@/domains/ui/link` → Not yet implemented (stub needed)
- Next.js routing → Removed (Electron doesn't use Next.js)

### 3. **CSS Classes**
Custom typography classes are defined in `src/stylesheets/tailwind-v4.css`:
- `.tw\:typography-heading-2xl` through `.tw\:typography-heading-xs`
- `.tw\:typography-title-md` through `.tw\:typography-title-xs`
- `.tw\:typography-body-2xl` through `.tw\:typography-body-xs`

### 4. **Colors**
Semantic colors defined in `@theme`:
- `--color-neutral-inverted`, `--color-neutral-strong`, etc.
- `--color-translucent-*` for dark backgrounds

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

## Adding New Components

When adding new components from the web team:

1. **Create a folder** under `src/tailwind/next/` for the component
2. **Add `tw:` prefix** to all Tailwind classes
3. **Replace web dependencies** with local equivalents or stubs
4. **Add CSS definitions** to `src/stylesheets/tailwind-v4.css` if needed
5. **Create a demo component** to showcase the component
6. **Update this README** with the new component

## Components

### Typography

Located in `typography/`

**Files:**
- `Typography.tsx` - Main Typography component
- `TypographyDemo.tsx` - Demo showcasing all typography styles
- `utils.ts` - Utility functions (joinClasses, XOr type, etc.)
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

## Testing

After making changes:

1. Run `yarn build` to compile TypeScript and generate Tailwind CSS
2. Launch Vortex and navigate to the Dashboard
3. Verify components render correctly
4. Check for console errors

## Future Work

- [ ] Implement Icon component for TypographyLink
- [ ] Implement Link component for TypographyLink
- [ ] Add more components from the web team (Button, Input, etc.)
- [ ] Consider extracting common utilities to a shared location
