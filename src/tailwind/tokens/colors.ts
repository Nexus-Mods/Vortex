// Color tokens for Vortex design system
export const colorTokens = {
  primary: {
    base: 'tw:bg-blue-600 tw:text-white',
    hover: 'tw:hover:bg-blue-700',
    focus: 'tw:focus:ring-blue-500',
    disabled: 'tw:disabled:bg-blue-300'
  },
  secondary: {
    base: 'tw:bg-gray-200 tw:text-gray-900 tw:dark:bg-gray-700 tw:dark:text-white',
    hover: 'tw:hover:bg-gray-300 tw:dark:hover:bg-gray-600',
    focus: 'tw:focus:ring-gray-500',
    disabled: 'tw:disabled:bg-gray-100 tw:disabled:dark:bg-gray-800'
  },
  danger: {
    base: 'tw:bg-red-600 tw:text-white',
    hover: 'tw:hover:bg-red-700',
    focus: 'tw:focus:ring-red-500',
    disabled: 'tw:disabled:bg-red-300'
  },
  ghost: {
    base: 'tw:bg-transparent tw:text-gray-700 tw:dark:text-gray-300',
    hover: 'tw:hover:bg-gray-100 tw:dark:hover:bg-gray-800',
    focus: 'tw:focus:ring-gray-500',
    disabled: 'tw:disabled:text-gray-400'
  },
  accent: {
    base: 'tw:bg-accent tw:text-white',
    hover: 'tw:hover:bg-primary',
    focus: 'tw:focus:ring-2 tw:focus:ring-accent',
    disabled: 'tw:disabled:bg-gray-300'
  },
  success: {
    base: 'tw:bg-green-600 tw:text-white',
    hover: 'tw:hover:bg-green-700',
    focus: 'tw:focus:ring-green-500',
    disabled: 'tw:disabled:bg-green-300'
  },
  warning: {
    base: 'tw:bg-yellow-600 tw:text-white',
    hover: 'tw:hover:bg-yellow-700',
    focus: 'tw:focus:ring-yellow-500',
    disabled: 'tw:disabled:bg-yellow-300'
  }
} as const;

export type ColorVariant = keyof typeof colorTokens;