// Motion and transition tokens
export const transitionTokens = {
  none: '',
  base: 'tw:transition-colors tw:duration-200',
  all: 'tw:transition-all tw:duration-200',
  fast: 'tw:transition-colors tw:duration-150',
  slow: 'tw:transition-colors tw:duration-300',
  transform: 'tw:transition-transform tw:duration-200'
} as const;

export const animationTokens = {
  none: '',
  spin: 'tw:animate-spin',
  pulse: 'tw:animate-pulse',
  bounce: 'tw:animate-bounce'
} as const;

export type TransitionVariant = keyof typeof transitionTokens;
export type AnimationVariant = keyof typeof animationTokens;