// Spacing and sizing tokens
export const spacingTokens = {
  xs: 'tw:px-2 tw:py-1 tw:text-xs tw:h-6',
  sm: 'tw:px-3 tw:py-1.5 tw:text-sm tw:h-8',
  md: 'tw:px-4 tw:py-2 tw:text-sm tw:h-10',
  lg: 'tw:px-6 tw:py-3 tw:text-base tw:h-12',
  xl: 'tw:px-8 tw:py-4 tw:text-lg tw:h-14'
} as const;

export const radiusTokens = {
  none: 'tw:rounded-none',
  sm: 'tw:rounded-sm',
  md: 'tw:rounded-md',
  lg: 'tw:rounded-lg',
  xl: 'tw:rounded-xl',
  full: 'tw:rounded-full'
} as const;

export const shadowTokens = {
  none: 'tw:shadow-none',
  sm: 'tw:shadow-sm',
  md: 'tw:shadow-md',
  lg: 'tw:shadow-lg',
  xl: 'tw:shadow-xl'
} as const;

export type SizeVariant = keyof typeof spacingTokens;
export type RadiusVariant = keyof typeof radiusTokens;
export type ShadowVariant = keyof typeof shadowTokens;