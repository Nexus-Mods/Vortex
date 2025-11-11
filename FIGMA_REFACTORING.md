# Figma to Vortex: Refactoring Guide

This guide documents the rules and patterns for refactoring Figma copy-paste code to use Vortex's Typography component and Tailwind design system.

## Table of Contents

1. [Typography Component Reference](#typography-component-reference)
2. [Design System Color Tokens](#design-system-color-tokens)
3. [Tailwind `tw:` Prefix Rules](#tailwind-tw-prefix-rules)
4. [Refactoring Rules](#refactoring-rules)
5. [Real Examples](#real-examples)
6. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
7. [Quick Reference Card](#quick-reference-card)

---

## Typography Component Reference

**Location**: `src/tailwind/components/next/typography/Typography.tsx`

### TypeScript Interface

```typescript
export interface TypographyProps extends AllHTMLAttributes<HTMLElement> {
  /**
   * The text colour appearance
   */
  appearance?: 'inverted' | 'moderate' | 'strong' | 'subdued' | 'weak' | 'none';
  
  /**
   * HTML element to render as
   */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'ul';
  
  /**
   * Use translucent color variants (for dark backgrounds)
   */
  isTranslucent?: boolean;
  
  /**
   * Reference to the HTML element
   */
  ref?: Ref<HTMLElement>;
  
  /**
   * Typography size type (string or responsive object)
   */
  typographyType?: TypographyTypes | TypographyTypeObject;
}
```

### Available `typographyType` Values

#### Heading Styles (Bold, Large Text)
- `'heading-2xl'` - 60px, 700 weight, -0.02em letter-spacing
- `'heading-xl'` - 48px, 700 weight, -0.01em letter-spacing
- `'heading-lg'` - 36px, 700 weight
- `'heading-md'` - 30px, 700 weight
- `'heading-sm'` - 24px, 600 weight
- `'heading-xs'` - 18px, 600 weight

#### Title Styles (Uppercase, Bold, Compact)
- `'title-md'` - 14px, 600 weight, UPPERCASE
- `'title-sm'` - 12px, 600 weight, UPPERCASE
- `'title-xs'` - 10px, 600 weight, UPPERCASE

#### Body Styles (Regular Text)
- `'body-2xl'` - 20px, 1.6 line-height
- `'body-xl'` - 18px, 1.6 line-height
- `'body-lg'` - 16px, 1.6 line-height
- `'body-md'` - 14px, 1.6 line-height (DEFAULT)
- `'body-sm'` - 13px, 1.6 line-height
- `'body-xs'` - 12px, 1.5 line-height

#### Responsive Typography Object

```typescript
// Define different sizes per breakpoint
typographyType={{
  default: 'body-sm',   // Mobile
  md: 'body-md',        // Tablet (768px+)
  lg: 'body-lg',        // Desktop (1024px+)
  xl: 'body-xl',        // Large desktop (1280px+)
  '2xl': 'body-2xl'     // Extra large (1536px+)
}}
```

### Available `appearance` Values

**Color mappings** (from `src/stylesheets/tailwind-v4.css`):

| Appearance | Regular Color | Translucent Color (isTranslucent=true) |
|------------|---------------|----------------------------------------|
| `'inverted'` | `--color-neutral-inverted` (#0f0f10 - dark on light) | `--color-translucent-dark-950` |
| `'strong'` | `--color-neutral-strong` (#f4f4f5 - bright) | `--color-neutral-translucent-strong` (rgba 95%) |
| `'moderate'` | `--color-neutral-moderate` (#d4d4d8) | `--color-neutral-translucent-moderate` (rgba 70%) |
| `'subdued'` | `--color-neutral-subdued` (#a1a1aa) | `--color-neutral-translucent-subdued` (rgba 50%) |
| `'weak'` | `--color-neutral-weak` (#71717a - dim) | `--color-neutral-translucent-weak` (rgba 40%) |
| `'none'` | No color applied | No color applied |

**Default**: `appearance="inverted"` (dark text)

---

## Design System Color Tokens

**Reference**: `src/stylesheets/tailwind-v4.css` lines 43-62

### 3-Layer Color System

#### Layer 1: Primitives (Raw Palette)
- `--color-zinc-*` (50-950) - Base neutral colors
- `--color-orange-*` - Primary/CTA colors
- `--color-blue-*` - Info/Link colors
- `--color-red-*` - Danger/Error colors
- `--color-green-*` - Success colors
- `--color-yellow-*` - Warning colors
- `--color-violet-*` - Premium colors
- `--color-teal-*` - Creators colors
- `--color-amber-*` - Paid/Premium colors

#### Layer 2: Brand Colors (Semantic Mapping)
- `--color-neutral-*` (50-950) → Maps to Zinc
- `--color-primary-*` (50-950) → Maps to Orange
- `--color-info-*` (50-950) → Maps to Blue
- `--color-success-*` (50-950) → Maps to Green
- `--color-warning-*` (50-950) → Maps to Yellow
- `--color-danger-*` (50-950) → Maps to Red
- `--color-premium-*` (50-950) → Maps to Violet
- `--color-creators-*` (50-950) → Maps to Teal

#### Layer 3: Element Tokens (PREFERRED - Use These!)

**Surface Colors** (Backgrounds):
```css
--color-surface-base: #0f0f10           /* Darkest background */
--color-surface-low: #1d1d21            /* Low elevation */
--color-surface-mid: #29292e            /* Mid elevation - cards */
--color-surface-high: #3e3e47           /* High elevation - raised cards */
--color-surface-inverted: #fafafa       /* Light backgrounds */
--color-surface-translucent-low: rgba(255, 255, 255, 0.05)
--color-surface-translucent-mid: rgba(255, 255, 255, 0.1)
--color-surface-translucent-high: rgba(255, 255, 255, 0.2)
```

**Neutral Text Colors** (Typography):
```css
--color-neutral-strong: #f4f4f5         /* Primary text */
--color-neutral-moderate: #d4d4d8       /* Secondary text */
--color-neutral-subdued: #a1a1aa        /* Tertiary text */
--color-neutral-weak: #71717a           /* Disabled text */
--color-neutral-inverted: #0f0f10       /* Text on light bg */
```

**Stroke/Border Colors**:
```css
--color-stroke-moderate: #d4d4d8        /* Standard borders */
--color-stroke-strong: #a1a1aa          /* Emphasized borders */
--color-stroke-neutral-translucent-weak: rgba(255, 255, 255, 0.1)
--color-stroke-neutral-translucent-subdued: rgba(255, 255, 255, 0.2)
--color-stroke-neutral-translucent-moderate: rgba(255, 255, 255, 0.3)
--color-stroke-neutral-translucent-strong: rgba(255, 255, 255, 0.6)
```

**⚠️ NOTE**: There is **NO** `--color-stroke-subdued` - use `stroke-moderate` or `stroke-neutral-translucent-subdued` instead.

**Semantic Colors** (Actions/States):
```css
/* Success */
--color-success-weak: #166534
--color-success-subdued: #16a34a
--color-success-moderate: #22c55e
--color-success-strong: #86efac

/* Info */
--color-info-weak: #1d4ed8
--color-info-subdued: #3b82f6
--color-info-moderate: #60a5fa
--color-info-strong: #93c5fd

/* Danger/Error */
--color-danger-weak: #991b1b
--color-danger-subdued: #dc2626
--color-danger-moderate: #ef4444
--color-danger-strong: #f87171

/* Warning */
--color-warning-weak: #ca8a04
--color-warning-subdued: #facc15
--color-warning-moderate: #fde047
--color-warning-strong: #fef08a

/* Primary/CTA */
--color-primary-weak: #c2410c
--color-primary-subdued: #f97316
--color-primary-moderate: #fb923c
--color-primary-strong: #fdba74
```

### Accessing Color Tokens in Tailwind

All color tokens are available via Tailwind utilities:

```tsx
// Background colors
className="tw:bg-surface-mid"
className="tw:bg-primary-moderate"
className="tw:bg-danger-strong"

// Text colors
className="tw:text-neutral-strong"
className="tw:text-success-moderate"
className="tw:text-info-subdued"

// Border colors
className="tw:border tw:border-stroke-moderate"
className="tw:border-danger-strong"
```

---

## Tailwind `tw:` Prefix Rules

**Configuration**: `@import "tailwindcss" prefix(tw);` in `src/stylesheets/tailwind-v4.css` (line 1)

### CRITICAL: Prefix Syntax Rules

**Pattern**: `[prefix]:[variant]:[utility]`

✅ **CORRECT**:
```tsx
className="tw:hover:text-neutral-moderate"
className="tw:focus:border-primary-moderate"
className="tw:disabled:opacity-40"
className="tw:aria-selected:text-neutral-strong"
className="tw:group-hover:bg-surface-high"
```

❌ **WRONG** (Will NOT work):
```tsx
className="hover:tw:text-neutral-moderate"  // ❌ Prefix must come first
className="focus:tw:border-primary"         // ❌ Prefix must come first
className="disabled:tw:opacity-40"          // ❌ Prefix must come first
```

**Rule**: The `tw:` prefix **ALWAYS** comes first, before any variants (hover, focus, disabled, etc.).

---

## Refactoring Rules

### Rule 1: Add `tw:` Prefix to All Tailwind Classes

**BEFORE (Figma copy-paste)**:
```tsx
<div className="flex flex-col gap-4 px-6 py-4 bg-zinc-800 rounded">
```

**AFTER (Refactored)**:
```tsx
<div className="tw:flex tw:flex-col tw:gap-4 tw:px-6 tw:py-4 tw:bg-surface-mid tw:rounded">
```

### Rule 2: Replace `inline-flex` with `tw:flex`

**BEFORE**:
```tsx
<div className="inline-flex justify-start items-center gap-2">
```

**AFTER**:
```tsx
<div className="tw:flex tw:justify-start tw:items-center tw:gap-2">
```

**Why**: `inline-flex` is rarely needed and complicates layout. Use `tw:flex` unless you have a specific reason for inline-flex behavior.

### Rule 3: Convert Text to Typography Components

**BEFORE**:
```tsx
<div className="text-sm font-semibold font-['Inter'] text-neutral-strong">
  Auto-fix dependencies
</div>
```

**AFTER**:
```tsx
<Typography as="div" typographyType="body-md" appearance="strong" className="tw:font-semibold">
  Auto-fix dependencies
</Typography>
```

### Rule 4: Remove Hardcoded Font Families

**BEFORE**:
```tsx
<div className="font-['Inter']">Text</div>
```

**AFTER**:
```tsx
<Typography as="div" typographyType="body-md">Text</Typography>
```

**Why**: Typography component handles font family automatically. Never use `font-['Inter']` or similar hardcoded fonts.

### Rule 5: Replace Arbitrary Font Sizes with Design System

**BEFORE**:
```tsx
<div className="text-[10px] uppercase">BETA</div>
```

**AFTER**:
```tsx
<Typography as="div" typographyType="title-xs">BETA</Typography>
```

**Why**: Arbitrary values like `text-[10px]` bypass the design system. Use `typographyType` values instead.

### Rule 6: Map Figma Colors to Design System Tokens

**BEFORE**:
```tsx
<div className="bg-zinc-800 text-zinc-200">
```

**AFTER**:
```tsx
<div className="tw:bg-surface-mid">
  <Typography as="div" appearance="moderate">
```

**Color Mapping Reference**:

| Figma Color | Design Token |
|-------------|--------------|
| `#0f0f10` (darkest) | `tw:bg-surface-base` |
| `#1d1d21` | `tw:bg-surface-low` |
| `#29292e` | `tw:bg-surface-mid` |
| `#3e3e47` | `tw:bg-surface-high` |
| `#f4f4f5` (text) | `appearance="strong"` |
| `#d4d4d8` | `appearance="moderate"` |
| `#a1a1aa` | `appearance="subdued"` |
| `#71717a` | `appearance="weak"` |

### Rule 7: Add Missing `tw:flex` for Flexbox

**BEFORE**:
```tsx
<div className="flex-col justify-start items-center gap-4">
```

**AFTER**:
```tsx
<div className="tw:flex tw:flex-col tw:justify-start tw:items-center tw:gap-4">
```

**Why**: Flexbox utilities like `flex-col`, `justify-*`, `items-*` only work if `tw:flex` is present.

---

## Real Examples

### Example 1: HealthCheckPage Header

**BEFORE (Figma copy-paste)**:
```tsx
<div className="self-stretch flex-col justify-center items-start">
  <div className="text-Neutral-Strong text-2xl font-semibold font-['Inter'] leading-8">
    Health Check
  </div>
  <div className="self-stretch text-violet-200/95 text-sm font-normal font-['Inter'] leading-5">
    Monitor your mods and game setup for issues.
  </div>
</div>
```

**AFTER (Refactored)**:
```tsx
<div className="tw:flex tw:self-stretch tw:flex-col tw:justify-center tw:items-start">
  <Typography as="div" typographyType="heading-sm" appearance="moderate" className="tw:m-0">
    {t('health_check:title')}
  </Typography>
  <Typography as="p" typographyType="body-md" appearance="moderate">
    {t('health_check:description')}
  </Typography>
</div>
```

### Example 2: Feature Card with Badge

**BEFORE (Figma copy-paste)**:
```tsx
<div className="self-stretch px-4 py-3 bg-gradient-to-br from-violet-600/20 to-violet-600/10 rounded shadow-2xl border-t border-b border-violet-600/25 inline-flex justify-start items-center gap-3">
  <div className="flex-1 inline-flex flex-col justify-start items-start gap-3">
    <div className="self-stretch inline-flex justify-start items-center gap-1.5">
      <div className="text-Neutral-Strong text-sm font-semibold font-['Inter'] leading-5">
        Auto-fix dependencies
      </div>
      <div className="px-1 py-px rounded outline outline-1 outline-violet-200/60 flex justify-center items-center">
        <div className="text-Neutral-Strong text-[10px] font-semibold font-['Inter'] uppercase leading-4 tracking-wide">
          BETA
        </div>
      </div>
    </div>
  </div>
</div>
```

**AFTER (Refactored)**:
```tsx
<div className="tw:flex tw:self-stretch tw:px-4 tw:py-3 tw:bg-gradient-to-br tw:from-violet-600/20 tw:to-violet-600/10 tw:rounded tw:shadow-2xl tw:border-t tw:border-b tw:border-violet-600/25 tw:justify-start tw:items-center tw:gap-3">
  <div className="tw:flex-1 tw:flex tw:flex-col tw:justify-start tw:items-start tw:gap-3">
    <div className="tw:self-stretch tw:flex tw:justify-start tw:items-center tw:gap-1.5">
      <Typography as="div" typographyType="body-md" appearance="strong" className="tw:font-semibold">
        Auto-fix dependencies
      </Typography>
      <div className="tw:px-1 tw:py-px tw:rounded tw:outline tw:outline-1 tw:outline-violet-200/60 tw:flex tw:justify-center tw:items-center">
        <Typography as="div" typographyType="body-xs" appearance="strong" className="tw:uppercase tw:tracking-wide">
          BETA
        </Typography>
      </div>
    </div>
  </div>
</div>
```

### Example 3: Button with Icon and Text

**BEFORE (Figma copy-paste)**:
```tsx
<div className="h-6 px-1.5 bg-Neutral-Strong rounded flex justify-start items-center gap-0.5">
  <div className="w-4 h-4 relative">
    {/* Icon SVG */}
  </div>
  <div className="text-center text-Neutral-Inverted text-xs font-normal font-['Inter'] tracking-tight">
    Install all
  </div>
</div>
```

**AFTER (Refactored)**:
```tsx
<div className="tw:h-6 tw:px-1.5 tw:bg-neutral-strong tw:rounded tw:flex tw:justify-start tw:items-center tw:gap-0.5">
  <div className="tw:w-4 tw:h-4 tw:relative">
    {/* Icon SVG */}
  </div>
  <Typography as="div" typographyType="body-xs" appearance="inverted" className="tw:text-center tw:tracking-tight">
    Install all
  </Typography>
</div>
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Wrong Prefix Order

❌ **WRONG**:
```tsx
className="hover:tw:text-neutral-moderate"
className="focus:tw:border-primary"
```

✅ **CORRECT**:
```tsx
className="tw:hover:text-neutral-moderate"
className="tw:focus:border-primary"
```

**Solution**: Always put `tw:` prefix **before** variants like `hover:`, `focus:`, `disabled:`.

### Pitfall 2: Using Non-Existent Color Token

❌ **WRONG**:
```tsx
className="tw:border-stroke-subdued"  // This token doesn't exist!
```

✅ **CORRECT**:
```tsx
className="tw:border-stroke-moderate"
// OR
className="tw:border-stroke-neutral-translucent-subdued"
```

**Solution**: Reference the color token list above. `stroke-subdued` doesn't exist.

### Pitfall 3: Forgetting `appearance="none"` for Custom Colors

❌ **WRONG**:
```tsx
<Typography typographyType="body-md" className="tw:text-violet-200/95">
  Custom color text
</Typography>
// Default appearance color will override your custom color!
```

✅ **CORRECT**:
```tsx
<Typography 
  typographyType="body-md" 
  appearance="none"
  className="tw:text-violet-200/95"
>
  Custom color text
</Typography>
```

**Solution**: When using custom text colors, set `appearance="none"` to prevent default color override.

### Pitfall 4: Not Using Semantic Colors

❌ **WRONG**:
```tsx
className="tw:bg-zinc-800"  // Direct primitive color
className="tw:text-zinc-200"
```

✅ **CORRECT**:
```tsx
className="tw:bg-surface-mid"  // Semantic element token
appearance="moderate"           // Semantic text color
```

**Solution**: Always use Layer 3 element tokens (surface-*, neutral-*, stroke-*) instead of primitive colors (zinc-*, orange-*).

### Pitfall 5: Hardcoding Font Sizes

❌ **WRONG**:
```tsx
<div className="tw:text-sm tw:font-semibold">
  Heading
</div>
```

✅ **CORRECT**:
```tsx
<Typography as="div" typographyType="body-sm" appearance="strong" className="tw:font-semibold">
  Heading
</Typography>
```

**Solution**: Use Typography component with `typographyType` instead of Tailwind text size utilities.

---

## Quick Reference Card

### Typography Props Cheat Sheet

```tsx
<Typography
  as="h1"                           // HTML element: h1-h6, p, span, div, ul
  typographyType="heading-2xl"      // Size: heading-*, title-*, body-*
  appearance="strong"               // Color: inverted, moderate, strong, subdued, weak, none
  isTranslucent={false}             // Use translucent colors for dark backgrounds
  className="tw:font-bold"          // Additional Tailwind classes
>
  Content
</Typography>
```

### Size Selection Guide

| Use Case | Typography Type |
|----------|----------------|
| Page titles | `heading-2xl` to `heading-lg` |
| Section headers | `heading-md` to `heading-xs` |
| Labels/buttons | `title-md` to `title-xs` |
| Body text | `body-md` (default) |
| Secondary text | `body-sm` to `body-xs` |

### Color Selection Guide

| Use Case | Appearance Value |
|----------|------------------|
| Primary content | `appearance="strong"` |
| Secondary content | `appearance="moderate"` |
| Tertiary/hints | `appearance="subdued"` |
| Disabled/muted | `appearance="weak"` |
| Light backgrounds | `appearance="inverted"` |
| Custom colors | `appearance="none"` + className |

### Figma CSS to Typography Conversion

| Figma CSS | Typography Props |
|-----------|------------------|
| `font-size: 60px` | `typographyType="heading-2xl"` |
| `font-size: 48px` | `typographyType="heading-xl"` |
| `font-size: 36px` | `typographyType="heading-lg"` |
| `font-size: 24px` | `typographyType="heading-sm"` |
| `font-size: 14px` | `typographyType="body-md"` |
| `font-size: 12px` | `typographyType="body-xs"` or `title-sm` |
| `color: #f4f4f5` | `appearance="strong"` |
| `color: #d4d4d8` | `appearance="moderate"` |
| `color: #a1a1aa` | `appearance="subdued"` |
| `color: #71717a` | `appearance="weak"` |
| `text-transform: uppercase` | Use `title-*` types |

### Layout Class Conversion

| Figma CSS | Tailwind Class |
|-----------|----------------|
| `display: flex` | `tw:flex` |
| `flex-direction: column` | `tw:flex-col` |
| `gap: 16px` | `tw:gap-4` |
| `padding: 24px` | `tw:p-6` |
| `padding: 16px 16px` | `tw:px-4` |
| `background: #29292e` | `tw:bg-surface-mid` |
| `border: 1px solid #d4d4d8` | `tw:border tw:border-stroke-moderate` |
| `border-radius: 8px` | `tw:rounded` |

### Common Patterns

```tsx
{/* Page Heading */}
<Typography as="h1" typographyType="heading-xl" appearance="strong">
  Page Title
</Typography>

{/* Section Heading */}
<Typography as="h2" typographyType="heading-md" appearance="moderate">
  Section Title
</Typography>

{/* Body Text */}
<Typography as="p" typographyType="body-md" appearance="moderate">
  Regular paragraph text.
</Typography>

{/* Label */}
<Typography as="label" typographyType="title-sm" appearance="subdued">
  FIELD LABEL
</Typography>

{/* Button Text */}
<Typography as="span" typographyType="body-md" appearance="strong">
  Button Text
</Typography>

{/* Custom Color */}
<Typography as="div" typographyType="body-md" appearance="none" className="tw:text-success-moderate">
  Success message
</Typography>
```

---

## Refactoring Workflow

### Step-by-Step Process

1. **Copy Figma code** → Paste into component
2. **Add `tw:` prefix** → All Tailwind classes
3. **Replace `inline-flex`** → Change to `tw:flex`
4. **Add missing `tw:flex`** → For containers using flexbox utilities
5. **Convert text elements** → Replace `<div>` with `<Typography>`
6. **Remove hardcoded fonts** → Delete `font-['Inter']`
7. **Map colors** → Replace hex/primitives with design tokens
8. **Replace arbitrary values** → Use design system tokens
9. **Test rendering** → Verify layout and styles

### Checklist

- [ ] All Tailwind classes have `tw:` prefix
- [ ] No `inline-flex` classes remain
- [ ] All text uses Typography component
- [ ] No hardcoded fonts (`font-['Inter']`)
- [ ] No arbitrary values (`text-[10px]`)
- [ ] Colors use design system tokens
- [ ] Flexbox containers have `tw:flex`
- [ ] Prefix order is correct (`tw:hover:*` not `hover:tw:*`)

---

## Additional Resources

- **Typography Component**: `src/tailwind/components/next/typography/Typography.tsx`
- **Tailwind Config**: `src/stylesheets/tailwind-v4.css`
- **Color Tokens**: `src/stylesheets/tailwind-v4.css` (lines 43-62)
- **Example Component**: `src/extensions/health_check/views/HealthCheckPage.tsx`

---

**Last Updated**: 2025-11-11
