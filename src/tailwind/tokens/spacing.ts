// Pure spacing scale from Figma design system
// Based on 4px grid system
export const spacingScale = {
  none: 'tw:p-0',
  px: 'tw:p-px',        // 1px
  '0.5': 'tw:p-0.5',    // 2px
  '1': 'tw:p-1',        // 4px
  '1.5': 'tw:p-1.5',    // 6px
  '2': 'tw:p-2',        // 8px
  '2.5': 'tw:p-2.5',    // 10px
  '3': 'tw:p-3',        // 12px
  '3.5': 'tw:p-3.5',    // 14px
  '4': 'tw:p-4',        // 16px
  '5': 'tw:p-5',        // 20px
  '6': 'tw:p-6',        // 24px
  '7': 'tw:p-7',        // 28px
  '8': 'tw:p-8',        // 32px
  '9': 'tw:p-9',        // 36px
  '10': 'tw:p-10',      // 40px
  '11': 'tw:p-11',      // 44px
  '12': 'tw:p-12',      // 48px
  '14': 'tw:p-14',      // 56px
  '16': 'tw:p-16',      // 64px
  '20': 'tw:p-20',      // 80px
  '24': 'tw:p-24',      // 96px
  '28': 'tw:p-28',      // 112px
  '32': 'tw:p-32',      // 128px
  '36': 'tw:p-36',      // 144px
  '40': 'tw:p-40',      // 160px
  '44': 'tw:p-44',      // 176px
  '48': 'tw:p-48',      // 192px
  '52': 'tw:p-52',      // 208px
  '56': 'tw:p-56',      // 224px
  '60': 'tw:p-60',      // 240px
  '64': 'tw:p-64',      // 256px
  '72': 'tw:p-72',      // 288px
  '80': 'tw:p-80',      // 320px
  '96': 'tw:p-96'       // 384px
} as const;

// Component spacing tokens (combining multiple spacing values)
export const spacingTokens = {
  xs: 'tw:px-2 tw:py-1 tw:text-xs tw:h-6',
  sm: 'tw:px-3 tw:py-1.5 tw:text-sm tw:h-8',
  md: 'tw:px-4 tw:py-2 tw:text-sm tw:h-10',
  lg: 'tw:px-6 tw:py-3 tw:text-base tw:h-12',
  xl: 'tw:px-8 tw:py-4 tw:text-lg tw:h-14'
} as const;

// Border radius tokens from Figma design system
export const radiusTokens = {
  none: 'tw:rounded-none',      // 0px
  sm: 'tw:rounded-sm',          // 2px
  base: 'tw:rounded',           // 4px
  md: 'tw:rounded-md',          // 6px
  lg: 'tw:rounded-lg',          // 8px
  xl: 'tw:rounded-xl',          // 12px
  '2xl': 'tw:rounded-2xl',      // 16px
  '3xl': 'tw:rounded-3xl',      // 24px
  full: 'tw:rounded-full'       // 9999px
} as const;

export const shadowTokens = {
  none: 'tw:shadow-none',
  sm: 'tw:shadow-sm',
  md: 'tw:shadow-md',
  lg: 'tw:shadow-lg',
  xl: 'tw:shadow-xl'
} as const;

export type SpacingScale = keyof typeof spacingScale;
export type SizeVariant = keyof typeof spacingTokens;
export type RadiusVariant = keyof typeof radiusTokens;
export type ShadowVariant = keyof typeof shadowTokens;